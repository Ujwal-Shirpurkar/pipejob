import { createHash } from 'crypto';
import { findByUrl, getApplication } from '../../db/applications';
import { structuredCall } from '../../llm/client';
import type { JobApplication } from '../../types/index';
import { ExtractedJobSchema } from '../evaluation/schema';
import { decodeEntities, htmlToText } from './html';
import { USER_AGENT, fetchAshby, fetchGreenhouseJob, fetchLeverJob, type Posting } from './providers';
import { persistPosting } from './search';


export class ImportError extends Error {}

/** Recognises public ATS URLs so we can use their structured APIs instead of parsing HTML. */
export function parseAtsUrl(raw: string): { ats: 'greenhouse' | 'lever' | 'ashby'; slug: string; id: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const host = url.hostname;

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const jobsIdx = parts.indexOf('jobs');
    if (parts.length >= 3 && jobsIdx > 0 && parts[jobsIdx + 1]) return { ats: 'greenhouse', slug: parts[jobsIdx - 1], id: parts[jobsIdx + 1] };
    const ghJid = url.searchParams.get('gh_jid');
    if (ghJid && parts[0]) return { ats: 'greenhouse', slug: parts[0], id: ghJid };
  }
  if (host === 'jobs.lever.co' && parts.length >= 2) return { ats: 'lever', slug: parts[0], id: parts[1] };
  if (host === 'jobs.ashbyhq.com' && parts.length >= 2) return { ats: 'ashby', slug: parts[0], id: parts[1] };
  return null;
}

interface JsonLdJobPosting {
  '@type'?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: { address?: { addressLocality?: string; addressCountry?: string | { name?: string } } } | { address?: { addressLocality?: string } }[];
  jobLocationType?: string;
  datePosted?: string;
}

/** Most careers pages embed schema.org JobPosting data for search engines — use it when present. */
export function extractJsonLdJob(html: string): Omit<Posting, 'url' | 'source' | 'externalId'> | null {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      continue;
    }
    const candidates: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { '@graph'?: unknown[] })['@graph'] ?? [parsed];
    for (const c of candidates) {
      const posting = c as JsonLdJobPosting;
      const types = Array.isArray(posting['@type']) ? posting['@type'] : [posting['@type']];
      if (!types.includes('JobPosting') || !posting.title) continue;
      const loc = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation;
      const country = (loc as { address?: { addressCountry?: string | { name?: string } } })?.address?.addressCountry;
      const location = [loc?.address?.addressLocality, typeof country === 'string' ? country : country?.name].filter(Boolean).join(', ');
      return {
        title: decodeEntities(posting.title),
        company: typeof posting.hiringOrganization === 'string' ? posting.hiringOrganization : posting.hiringOrganization?.name ?? '',
        location,
        remote: posting.jobLocationType === 'TELECOMMUTE' ? true : null,
        description: htmlToText(posting.description ?? ''),
        postedAt: posting.datePosted,
      };
    }
  }
  return null;
}

async function fetchAtsPosting(ats: NonNullable<ReturnType<typeof parseAtsUrl>>): Promise<Posting> {
  switch (ats.ats) {
    case 'greenhouse':
      return fetchGreenhouseJob(ats.slug, ats.id);
    case 'lever':
      return fetchLeverJob(ats.slug, ats.id);
    case 'ashby': {
      const postings = await fetchAshby({ name: ats.slug, ats: 'ashby', slug: ats.slug });
      const hit = postings.find((p) => p.externalId === ats.id);
      if (!hit) throw new ImportError('Posting not found on the Ashby board (it may have been closed).');
      return hit;
    }
  }
}

async function extractWithLlm(text: string, url: string, runId?: string): Promise<Posting> {
  const { data } = await structuredCall({
    purpose: 'extract',
    schema: ExtractedJobSchema,
    effort: 'low',
    maxTokens: 12000,
    system: 'You extract job postings from web page text. Copy the description faithfully; do not summarise or invent details.',
    user: `Page URL: ${url}\n\nPage text:\n${text.slice(0, 40_000)}`,
    runId,
  });
  if (!data.isJobPosting) throw new ImportError('That page does not look like a single job posting.');
  return {
    source: 'manual',
    externalId: url,
    title: data.title,
    company: data.company,
    location: data.location,
    remote: data.remote === 'remote' ? true : data.remote === 'unknown' ? null : false,
    url,
    applyUrl: url,
    description: data.description,
  };
}

export async function importFromUrl(url: string, ctx: { runId?: string } = {}): Promise<{ application: JobApplication; isNew: boolean }> {
  const existing = findByUrl(url);
  if (existing) return { application: existing, isNew: false };

  const ats = parseAtsUrl(url);
  let posting: Posting;
  if (ats) {
    posting = await fetchAtsPosting(ats);
  } else {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new ImportError(`Could not fetch the page (HTTP ${res.status}). Paste the job description text instead.`);
    const html = await res.text();
    const jsonLd = extractJsonLdJob(html);
    posting = jsonLd && jsonLd.description.length > 200
      ? { ...jsonLd, source: 'corporate', externalId: url, url, applyUrl: url }
      : await extractWithLlm(htmlToText(html), url, ctx.runId);
  }

  const { job, isNew } = persistPosting(posting);
  return { application: getApplication(job.id)!, isNew };
}

export async function importFromText(
  input: { text: string; title?: string; company?: string; location?: string; url?: string },
  ctx: { runId?: string } = {}
): Promise<{ application: JobApplication; isNew: boolean }> {
  const text = input.text.trim();
  if (text.length < 100) throw new ImportError('The job description is too short — paste the full posting.');
  // Pasted text has no canonical URL; derive a stable one so re-pasting deduplicates.
  const url = input.url?.trim() || `manual://${createHash('sha256').update(text).digest('hex').slice(0, 16)}`;

  let posting: Posting;
  if (input.title && input.company) {
    posting = {
      source: 'manual',
      externalId: url,
      title: input.title,
      company: input.company,
      location: input.location ?? '',
      remote: null,
      url,
      description: text,
    };
  } else {
    posting = { ...(await extractWithLlm(text, url, ctx.runId)), url, description: text };
  }
  const { job, isNew } = persistPosting(posting);
  return { application: getApplication(job.id)!, isNew };
}
