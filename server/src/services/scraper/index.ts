import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import type { Browser, Page } from 'playwright';
import type { DiscoveredJob } from '../../types/index';
import { config } from '../../config';
import logger from '../../logger';
import { setHumanHeaders, randomViewport } from './fingerprint';
import { scrapeStepstone } from './stepstone';
import { scrapeIndeed } from './indeed';

chromium.use(StealthPlugin());

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    const headless = process.env.NODE_ENV === 'production';
    browserInstance = await chromium.launch({ headless });
    logger.info({ action: 'browser_launch', headless });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info({ action: 'browser_close' });
  }
}

export function humanDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function randomMouseMove(page: Page): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  const moves = Math.floor(Math.random() * 3) + 3;
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * viewport.width);
    const y = Math.floor(Math.random() * viewport.height);
    await page.mouse.move(x, y);
    await humanDelay(100, 300);
  }
}

export async function scrapeJobs(sources: string[], keywords: string[]): Promise<DiscoveredJob[]> {
  const browser = await getBrowser();
  const allJobs: DiscoveredJob[] = [];
  const location = 'Deutschland';

  for (const source of sources) {
    const context = await browser.newContext({
      viewport: randomViewport(),
      locale: 'de-DE',
    });
    const page = await context.newPage();
    await setHumanHeaders(page);

    try {
      let jobs: DiscoveredJob[] = [];

      switch (source) {
        case 'stepstone':
          jobs = await scrapeStepstone(keywords, location, page);
          break;
        case 'indeed':
          jobs = await scrapeIndeed(keywords, location, page);
          break;
        default:
          logger.warn({ action: 'scrape_jobs', source, message: 'Unknown source, skipping' });
      }

      logger.info({ action: 'scrape_jobs', source, jobsFound: jobs.length });
      allJobs.push(...jobs);
    } catch (err) {
      logger.error({ action: 'scrape_jobs', source, error: String(err) });
    } finally {
      await context.close();
    }

    await humanDelay(...config.rateLimits.scrapeDelayMs);
  }

  return allJobs.slice(0, config.rateLimits.maxJobsPerRun);
}
