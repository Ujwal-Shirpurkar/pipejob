import type { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import type { DiscoveredJob } from '../../types/index';
import { isDuplicate } from '../../db/schema';
import logger from '../../logger';
import { humanDelay, randomMouseMove } from './index';
import { config } from '../../config';

interface StepstoneApiJob {
  jobId?: string;
  id?: string;
  title?: string;
  job?: { title?: string };
  employer?: { name?: string };
  company?: string;
  location?: { name?: string; city?: string };
  url?: string;
  applyUrl?: string;
  jobUrl?: string;
  description?: string;
  snippet?: string;
}

export async function scrapeStepstone(
  keywords: string[],
  location: string,
  page: Page
): Promise<DiscoveredJob[]> {
  const results: DiscoveredJob[] = [];
  const keyword = keywords.join(' ');

  const interceptedJobs: StepstoneApiJob[] = [];

  await page.route('**/search/api/**', async (route) => {
    const url = route.request().url();
    logger.info({ action: 'stepstone_intercept', url });
    const response = await route.fetch();
    try {
      const body = await response.json() as { jobs?: StepstoneApiJob[]; results?: StepstoneApiJob[] };
      const jobs = body.jobs ?? body.results ?? [];
      interceptedJobs.push(...jobs);
    } catch {
      // non-JSON response, ignore
    }
    await route.fulfill({ response });
  });

  await page.route('**api.stepstone.de**', async (route) => {
    const url = route.request().url();
    logger.info({ action: 'stepstone_api_intercept', url });
    const response = await route.fetch();
    try {
      const body = await response.json() as { jobs?: StepstoneApiJob[]; results?: StepstoneApiJob[] };
      const jobs = body.jobs ?? body.results ?? [];
      interceptedJobs.push(...jobs);
    } catch {
      // non-JSON response, ignore
    }
    await route.fulfill({ response });
  });

  const searchUrl = `https://www.stepstone.de/jobs/${encodeURIComponent(keyword)}/in-${encodeURIComponent(location)}`;
  logger.info({ action: 'stepstone_navigate', url: searchUrl });

  await humanDelay(...config.rateLimits.scrapeDelayMs);
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await randomMouseMove(page);
  await humanDelay(...config.rateLimits.scrapeDelayMs);

  // Scroll to trigger lazy-loaded XHR requests
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await humanDelay(1000, 2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await humanDelay(1000, 2000);

  logger.info({ action: 'stepstone_intercepted', count: interceptedJobs.length });

  for (const apiJob of interceptedJobs) {
    const jobUrl = apiJob.url ?? apiJob.applyUrl ?? apiJob.jobUrl ?? '';
    if (!jobUrl) continue;
    if (isDuplicate(jobUrl)) continue;

    const job: DiscoveredJob = {
      id: uuidv4(),
      title: apiJob.title ?? apiJob.job?.title ?? 'Unknown',
      company: apiJob.employer?.name ?? apiJob.company ?? 'Unknown',
      location: apiJob.location?.name ?? apiJob.location?.city ?? location,
      url: jobUrl,
      source: 'stepstone',
      rawJD: apiJob.description ?? apiJob.snippet ?? '',
      discoveredAt: new Date().toISOString(),
      status: 'discovered',
    };

    results.push(job);

    if (results.length >= config.rateLimits.maxJobsPerRun) break;
  }

  logger.info({ action: 'stepstone_done', jobsFound: results.length });
  return results;
}
