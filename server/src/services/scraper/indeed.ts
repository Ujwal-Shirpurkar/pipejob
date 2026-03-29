import type { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import type { DiscoveredJob } from '../../types/index';
import { isDuplicate } from '../../db/schema';
import logger from '../../logger';
import { humanDelay, randomMouseMove } from './index';
import { config } from '../../config';

export async function scrapeIndeed(
  keywords: string[],
  location: string,
  page: Page
): Promise<DiscoveredJob[]> {
  const results: DiscoveredJob[] = [];
  const keyword = keywords.join(' ');

  for (let pageNum = 0; pageNum < 3; pageNum++) {
    const start = pageNum * 10;
    const url = `https://de.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}&start=${start}`;
    logger.info({ action: 'indeed_navigate', url, page: pageNum + 1 });

    await humanDelay(...config.rateLimits.scrapeDelayMs);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomMouseMove(page);
    await humanDelay(...config.rateLimits.scrapeDelayMs);

    const jobCards = await page.$$eval(
      '[data-jk], .job_seen_beacon, .jobsearch-ResultsList > li',
      (cards) =>
        cards.map((card) => {
          const titleEl = card.querySelector('[class*="jobTitle"] a, h2 a, .title a');
          const companyEl = card.querySelector('[data-testid="company-name"], .companyName, [class*="company"]');
          const locationEl = card.querySelector('[data-testid="text-location"], .companyLocation, [class*="location"]');
          const jk = card.getAttribute('data-jk') ?? '';
          const href = titleEl?.getAttribute('href') ?? '';
          const fullUrl = href.startsWith('http') ? href : `https://de.indeed.com${href}`;

          return {
            title: titleEl?.textContent?.trim() ?? '',
            company: companyEl?.textContent?.trim() ?? '',
            location: locationEl?.textContent?.trim() ?? '',
            url: jk ? `https://de.indeed.com/viewjob?jk=${jk}` : fullUrl,
            rawJD: card.textContent?.trim() ?? '',
          };
        })
    );

    logger.info({ action: 'indeed_cards', page: pageNum + 1, count: jobCards.length });

    for (const card of jobCards) {
      if (!card.url || !card.title) continue;
      if (isDuplicate(card.url)) continue;

      results.push({
        id: uuidv4(),
        title: card.title,
        company: card.company,
        location: card.location,
        url: card.url,
        source: 'indeed',
        rawJD: card.rawJD,
        discoveredAt: new Date().toISOString(),
        status: 'discovered',
      });

      if (results.length >= config.rateLimits.maxJobsPerRun) break;
    }

    if (results.length >= config.rateLimits.maxJobsPerRun) break;

    // Check if there's a next page
    const hasNext = await page.$('[data-testid="pagination-page-next"], .pagination-list .np:last-child');
    if (!hasNext) break;
  }

  logger.info({ action: 'indeed_done', jobsFound: results.length });
  return results;
}
