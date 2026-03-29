import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import type { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import type { DiscoveredJob, TailoredOutput, MasterCV } from '../../types/index';
import type { AgentConfig } from '../../types/config';
import { humanDelay, randomMouseMove } from '../scraper/index';
import { setHumanHeaders, randomViewport } from '../scraper/fingerprint';
import logger from '../../logger';

chromium.use(StealthPlugin());

const APPLY_SELECTORS = [
  '[data-testid="apply-button"]',
  'a:has-text("Apply")',
  'button:has-text("Bewerben")',
  'a:has-text("Jetzt bewerben")',
];

async function detectAndFillFields(
  page: Page,
  masterCV: MasterCV
): Promise<Record<string, string>> {
  const fieldsUsed: Record<string, string> = {};

  const inputs = await page.$$('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea, select');

  for (const input of inputs) {
    const tag = await input.evaluate((el) => el.tagName.toLowerCase());
    const type = await input.getAttribute('type');
    const name = (await input.getAttribute('name') ?? '').toLowerCase();
    const id = (await input.getAttribute('id') ?? '').toLowerCase();
    const placeholder = (await input.getAttribute('placeholder') ?? '').toLowerCase();
    const ariaLabel = (await input.getAttribute('aria-label') ?? '').toLowerCase();
    const combined = `${name} ${id} ${placeholder} ${ariaLabel}`;

    if (type === 'radio') {
      const label = combined;
      if (label.includes('no') || label.includes('nein')) continue;
      try {
        await input.check();
        fieldsUsed[name || id] = 'radio:first';
      } catch { /* skip */ }
      continue;
    }

    if (tag === 'select') {
      try {
        const options = await input.$$('option');
        if (options.length > 1) {
          const firstValue = await options[1].getAttribute('value') ?? '';
          await page.selectOption(`#${id}`, firstValue).catch(() => {});
          fieldsUsed[name || id] = `select:${firstValue}`;
        }
      } catch { /* skip */ }
      continue;
    }

    let value: string | null = null;

    if (/name|vorname|nachname|first|last|full/.test(combined)) {
      value = masterCV.fullName;
    } else if (/email|e-mail|mail/.test(combined)) {
      value = masterCV.email;
    } else if (/phone|tel|mobil|handy/.test(combined)) {
      value = masterCV.phone;
    } else if (/linkedin/.test(combined)) {
      value = masterCV.linkedin;
    } else if (/github/.test(combined)) {
      value = masterCV.github ?? '';
    } else if (/location|city|stadt|ort/.test(combined)) {
      value = masterCV.location;
    } else if (/salary|gehalt|lohn|compensation/.test(combined)) {
      logger.warn({ action: 'fill_field', field: name || id, message: 'Salary field detected — leaving empty' });
      continue;
    } else if (/cover|anschreiben|motivation/.test(combined)) {
      value = '(see attached cover letter)';
    }

    if (value !== null) {
      try {
        await input.fill(value);
        fieldsUsed[name || id || placeholder] = value;
      } catch { /* skip */ }
    }
  }

  return fieldsUsed;
}

async function uploadFiles(
  page: Page,
  cvPath: string,
  clPath: string
): Promise<void> {
  const fileInputs = await page.$$('input[type="file"]');
  if (fileInputs.length === 0) {
    logger.info({ action: 'upload_files', message: 'No file inputs found' });
    return;
  }

  await humanDelay(500, 1000);
  await fileInputs[0].setInputFiles(cvPath);
  logger.info({ action: 'upload_files', file: 'cv', path: cvPath });

  if (fileInputs.length >= 2) {
    await humanDelay(500, 1000);
    await fileInputs[1].setInputFiles(clPath);
    logger.info({ action: 'upload_files', file: 'cover_letter', path: clPath });
  }
}

export async function submitApplication(
  job: DiscoveredJob,
  output: TailoredOutput,
  config: AgentConfig
): Promise<{ success: boolean; fieldsUsed: Record<string, string> }> {
  const isDev = process.env.NODE_ENV !== 'production';
  const screenshotDir = path.join(config.logDir, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  logger.info({ action: 'submit_application_start', jobId: job.id, url: job.url, isDev });

  const browser = await chromium.launch({ headless: !isDev });
  const context = await browser.newContext({ viewport: randomViewport() });
  const page = await context.newPage();
  await setHumanHeaders(page);

  let fieldsUsed: Record<string, string> = {};

  try {
    await humanDelay(...config.rateLimits.scrapeDelayMs);
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomMouseMove(page);
    await humanDelay(...config.rateLimits.scrapeDelayMs);

    // Click apply button
    let clicked = false;
    for (const selector of APPLY_SELECTORS) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await humanDelay(500, 1200);
          await btn.click();
          clicked = true;
          logger.info({ action: 'click_apply', jobId: job.id, selector });
          break;
        }
      } catch { /* try next */ }
    }

    if (!clicked) {
      logger.warn({ action: 'click_apply', jobId: job.id, message: 'No apply button found' });
    }

    await humanDelay(...config.rateLimits.scrapeDelayMs);

    // Read master CV to get the full object
    const masterCV: MasterCV = JSON.parse(fs.readFileSync(config.masterCVPath, 'utf-8'));

    fieldsUsed = await detectAndFillFields(page, masterCV);
    await uploadFiles(page, output.cvPath, output.coverLetterPath);

    await humanDelay(500, 1000);

    const screenshotPath = path.join(screenshotDir, `${job.id}-before-submit.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info({ action: 'screenshot', jobId: job.id, path: screenshotPath });

    if (isDev) {
      logger.info({ action: 'submit_application', jobId: job.id, message: 'DRY RUN: would have submitted' });
      console.log(`DRY RUN: would have submitted application for job ${job.id} (${job.title} at ${job.company})`);
    } else {
      const submitBtn = await page.$('button[type="submit"], input[type="submit"], [data-testid="submit-button"]');
      if (submitBtn) {
        await humanDelay(500, 1000);
        await submitBtn.click();
        logger.info({ action: 'submit_application', jobId: job.id, result: 'submitted' });
      } else {
        logger.warn({ action: 'submit_application', jobId: job.id, message: 'No submit button found' });
      }
    }

    return { success: true, fieldsUsed };
  } catch (err) {
    logger.error({ action: 'submit_application', jobId: job.id, error: String(err) });
    return { success: false, fieldsUsed };
  } finally {
    await context.close();
    await browser.close();
  }
}
