import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../../config';
import { findByUrl, insertApplication } from '../../db/applications';
import { emitJobEvent } from '../../events';
import logger from '../../logger';
import type { DiscoveredJob } from '../../types/index';
import { fetchArbeitnow, fetchPortal, type PortalCompany, type Posting } from './providers';

export interface PortalsFile {
  companies: PortalCompany[];
}

export function loadPortals(): PortalCompany[] {
  const file = path.resolve(config.portalsPath);
  if (!fs.existsSync(file)) return [];
  return (JSON.parse(fs.readFileSync(file, 'utf-8')) as PortalsFile).companies ?? [];
}

// Boards change slowly; a short cache keeps repeated agent searches cheap and polite.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; postings: Posting[] }>();

async function cached(key: string, load: () => Promise<Posting[]>): Promise<Posting[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.postings;
  const postings = await load();
  cache.set(key, { at: Date.now(), postings });
  return postings;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface SearchOptions {
  keywords: string[];
  location?: string;
  remoteOnly?: boolean;
  sources?: string[]; // 'portals' | 'arbeitnow' | a specific company name
  companies?: string[];
  limit?: number;
}

export interface SearchResult {
  job: DiscoveredJob;
  isNew: boolean;
  relevance: number;
}

export interface SearchReport {
  results: SearchResult[];
  scanned: number;
  sourcesQueried: string[];
  sourceErrors: { source: string; error: string }[];
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word matching, so "AI" matches "AI Engineer" but not "Retail" or "Maintenance".
function keywordRegex(keyword: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(keyword)}(?![\\p{L}\\p{N}])`, 'iu');
}

/**
 * Relevance: title hits dominate (3 each); description hits only break ties (capped at 2),
 * so a long posting that mentions every buzzword can't outrank a precise title.
 */
export function scorePosting(p: Posting, keywords: string[]): number {
  const desc = p.description.slice(0, 8000);
  let titleHits = 0;
  let descHits = 0;
  for (const raw of keywords) {
    const k = raw.trim();
    if (!k) continue;
    const re = keywordRegex(k);
    if (re.test(p.title)) titleHits++;
    else if (re.test(desc)) descHits++;
  }
  return titleHits * 3 + Math.min(descHits, 2);
}

export function matchesLocation(p: Posting, location: string | undefined, remoteOnly: boolean): boolean {
  if (remoteOnly && p.remote !== true) return false;
  if (!location) return true;
  const wanted = location
    .toLowerCase()
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const loc = p.location.toLowerCase();
  const aliases: Record<string, string[]> = {
    germany: ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'cologne', 'köln', 'frankfurt', 'stuttgart', 'düsseldorf', 'nuremberg', 'nürnberg', 'leipzig', 'dresden', 'karlsruhe', 'heidelberg', 'dach', 'europe', 'emea'],
    deutschland: ['germany', 'deutschland'],
    munich: ['munich', 'münchen'],
    cologne: ['cologne', 'köln'],
    nuremberg: ['nuremberg', 'nürnberg'],
  };
  return wanted.some((w) => {
    if (w === 'remote') return p.remote === true || loc.includes('remote');
    const needles = aliases[w] ?? [w];
    return needles.some((n) => loc.includes(n)) || (p.remote === true && (w === 'germany' || w === 'deutschland') && /europe|emea|germany|anywhere|^remote$/i.test(p.location));
  });
}

export async function searchJobs(opts: SearchOptions): Promise<SearchReport> {
  const sources = opts.sources?.length ? opts.sources.map((s) => s.toLowerCase()) : ['portals', 'arbeitnow'];
  const limit = Math.min(opts.limit ?? 20, config.limits.maxJobsPerSearch);
  const portals = loadPortals();

  let selected = portals;
  if (opts.companies?.length) {
    const wanted = opts.companies.map((c) => c.toLowerCase());
    selected = portals.filter((p) => wanted.some((w) => p.name.toLowerCase().includes(w) || p.slug === w));
  } else if (!sources.includes('portals')) {
    selected = portals.filter((p) => sources.includes(p.name.toLowerCase()) || sources.includes(p.ats));
  }

  const sourceErrors: SearchReport['sourceErrors'] = [];
  const sourcesQueried: string[] = [];

  const batches = await mapLimit(selected, 6, async (company) => {
    sourcesQueried.push(company.name);
    try {
      return await cached(`${company.ats}:${company.slug}`, () => fetchPortal(company));
    } catch (err) {
      sourceErrors.push({ source: company.name, error: String(err) });
      return [];
    }
  });

  if (sources.includes('arbeitnow') && !opts.companies?.length) {
    sourcesQueried.push('Arbeitnow');
    try {
      batches.push(await cached('arbeitnow', () => fetchArbeitnow(2)));
    } catch (err) {
      sourceErrors.push({ source: 'Arbeitnow', error: String(err) });
    }
  }

  const all = batches.flat();
  const ranked = all
    .map((p) => ({ p, relevance: opts.keywords.length ? scorePosting(p, opts.keywords) : 1 }))
    .filter(({ p, relevance }) => relevance > 0 && matchesLocation(p, opts.location, Boolean(opts.remoteOnly)))
    .sort((a, b) => b.relevance - a.relevance || (b.p.postedAt ?? '').localeCompare(a.p.postedAt ?? ''));

  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const { p, relevance } of ranked) {
    if (results.length >= limit) break;
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    results.push({ ...persistPosting(p), relevance });
  }

  logger.info({ action: 'search_jobs', keywords: opts.keywords, scanned: all.length, returned: results.length, errors: sourceErrors.length });
  return { results, scanned: all.length, sourcesQueried, sourceErrors };
}

/** Stores a posting as a discovered job unless we already track its URL. */
export function persistPosting(p: Posting): { job: DiscoveredJob; isNew: boolean } {
  const existing = findByUrl(p.url);
  if (existing) return { job: existing.job, isNew: false };

  const job: DiscoveredJob = {
    id: randomUUID(),
    title: p.title,
    company: p.company,
    location: p.location,
    url: p.url,
    applyUrl: p.applyUrl,
    source: p.source,
    rawJD: p.description,
    remote: p.remote,
    postedAt: p.postedAt,
    discoveredAt: new Date().toISOString(),
    status: 'discovered',
  };
  insertApplication(job);
  emitJobEvent(job.id, 'discovered', `${job.title} @ ${job.company}`);
  return { job, isNew: true };
}
