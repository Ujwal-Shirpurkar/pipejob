import type { JobSource } from '../../types/index';
import { htmlToText } from './html';

export interface Posting {
  source: JobSource;
  externalId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean | null;
  url: string;
  applyUrl?: string;
  description: string;
  postedAt?: string;
}

export interface PortalCompany {
  name: string;
  ats: 'greenhouse' | 'lever' | 'ashby';
  slug: string;
  tags?: string[];
}

// Identify ourselves honestly. These are official, public job-board APIs that companies
// publish so their openings can be discovered; we call them politely and cache results.
export const USER_AGENT = 'PipeJob/2.0 (personal job-search assistant; +https://github.com/Prof-Larry/pipejob)';

export async function fetchJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

const REMOTE_RE = /\bremote\b|home.?office|work from home|mobiles arbeiten/i;

// ─── Greenhouse — https://developers.greenhouse.io/job-board.html ──────────

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  updated_at?: string;
  first_published?: string;
  company_name?: string;
}

function mapGreenhouse(j: GreenhouseJob, company: string): Posting {
  const location = j.location?.name ?? '';
  return {
    source: 'greenhouse',
    externalId: String(j.id),
    title: j.title,
    company: j.company_name || company,
    location,
    remote: REMOTE_RE.test(location) ? true : null,
    url: j.absolute_url,
    applyUrl: j.absolute_url,
    description: htmlToText(j.content ?? ''),
    postedAt: j.first_published ?? j.updated_at,
  };
}

export async function fetchGreenhouse(c: PortalCompany): Promise<Posting[]> {
  const data = await fetchJson<{ jobs: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(c.slug)}/jobs?content=true`
  );
  return data.jobs.map((j) => mapGreenhouse(j, c.name));
}

export async function fetchGreenhouseJob(slug: string, id: string): Promise<Posting> {
  const j = await fetchJson<GreenhouseJob>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`
  );
  return mapGreenhouse(j, slug);
}

// ─── Lever — https://github.com/lever/postings-api ─────────────────────────

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  categories?: { location?: string; commitment?: string; team?: string };
  workplaceType?: string;
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
  createdAt?: number;
}

function mapLever(j: LeverJob, company: string): Posting {
  const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join('\n\n');
  const location = j.categories?.location ?? '';
  return {
    source: 'lever',
    externalId: j.id,
    title: j.text,
    company,
    location,
    remote: j.workplaceType === 'remote' ? true : REMOTE_RE.test(location) ? true : null,
    url: j.hostedUrl,
    applyUrl: j.applyUrl,
    description: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join('\n\n').trim(),
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
  };
}

export async function fetchLever(c: PortalCompany): Promise<Posting[]> {
  const data = await fetchJson<LeverJob[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(c.slug)}?mode=json`);
  return data.map((j) => mapLever(j, c.name));
}

export async function fetchLeverJob(slug: string, id: string): Promise<Posting> {
  const j = await fetchJson<LeverJob>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}/${encodeURIComponent(id)}?mode=json`
  );
  return mapLever(j, slug);
}

// ─── Ashby — https://developers.ashbyhq.com/docs/public-job-posting-api ───

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  isListed?: boolean;
}

export async function fetchAshby(c: PortalCompany): Promise<Posting[]> {
  const data = await fetchJson<{ jobs: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(c.slug)}`
  );
  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const locations = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean);
      return {
        source: 'ashby' as const,
        externalId: j.id,
        title: j.title,
        company: c.name,
        location: locations.slice(0, 3).join(' · '),
        remote: j.isRemote || j.workplaceType === 'Remote' ? true : null,
        url: j.jobUrl,
        applyUrl: j.applyUrl,
        description: j.descriptionPlain?.trim() || htmlToText(j.descriptionHtml ?? ''),
        postedAt: j.publishedAt,
      };
    });
}

// ─── Arbeitnow — free public job board API for Germany ────────────────────
// https://www.arbeitnow.com/blog/job-board-api

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

export async function fetchArbeitnow(pages = 2): Promise<Posting[]> {
  const out: Posting[] = [];
  for (let page = 1; page <= pages; page++) {
    const data = await fetchJson<{ data: ArbeitnowJob[]; links?: { next?: string | null } }>(
      `https://www.arbeitnow.com/api/job-board-api?page=${page}`
    );
    for (const j of data.data) {
      out.push({
        source: 'arbeitnow',
        externalId: j.slug,
        title: j.title,
        company: j.company_name,
        location: j.location,
        remote: j.remote || REMOTE_RE.test(j.location),
        url: j.url,
        applyUrl: j.url,
        description: htmlToText(j.description),
        postedAt: new Date(j.created_at * 1000).toISOString(),
      });
    }
    if (!data.links?.next) break;
  }
  return out;
}

export async function fetchPortal(c: PortalCompany): Promise<Posting[]> {
  switch (c.ats) {
    case 'greenhouse':
      return fetchGreenhouse(c);
    case 'lever':
      return fetchLever(c);
    case 'ashby':
      return fetchAshby(c);
  }
}
