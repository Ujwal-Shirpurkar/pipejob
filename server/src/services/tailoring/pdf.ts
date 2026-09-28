import fs from 'fs';
import path from 'path';
import { chromium, type Browser } from 'playwright';
import logger from '../../logger';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
    logger.info({ action: 'pdf_browser_launch' });
  }
  return browser;
}

/** Renders HTML to an A4 PDF. Playwright is used purely as a local rendering engine. */
export async function renderPdf(html: string, outPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '13mm', right: '13mm' },
    });
    fs.writeFileSync(outPath, buffer);
  } finally {
    await page.close();
  }
}

export async function closePdfBrowser(): Promise<void> {
  await browser?.close();
  browser = null;
}
