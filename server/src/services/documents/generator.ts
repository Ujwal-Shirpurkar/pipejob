import fs from 'fs';
import path from 'path';
import type { MasterCV, JDAnalysis, TailoredOutput } from '../../types/index';
import { buildCVHtml, buildCoverLetterHtml } from './templates/cv';
import { getBrowser } from '../scraper/index';
import logger from '../../logger';

const MODEL = 'claude-sonnet-4-20250514';
const PROMPT_VERSION = '1.1';

export async function generateDocuments(
  masterCV: MasterCV,
  analysis: JDAnalysis,
  outputDir: string
): Promise<TailoredOutput> {
  const jobOutputDir = path.join(outputDir, analysis.jobId);
  if (!fs.existsSync(jobOutputDir)) {
    fs.mkdirSync(jobOutputDir, { recursive: true });
  }

  const cvPath = path.join(jobOutputDir, 'cv.pdf');
  const coverLetterPath = path.join(jobOutputDir, 'cover-letter.pdf');

  logger.info({ action: 'generate_documents_start', jobId: analysis.jobId });

  const browser = await getBrowser();

  // Generate CV PDF
  const cvHtml = buildCVHtml(masterCV, analysis);
  const cvPage = await browser.newPage();
  try {
    await cvPage.setContent(cvHtml, { waitUntil: 'load' });
    const cvBuffer = await cvPage.pdf({ format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' } });
    fs.writeFileSync(cvPath, cvBuffer);
  } finally {
    await cvPage.close();
  }

  // Generate Cover Letter PDF
  const clHtml = buildCoverLetterHtml(masterCV, analysis);
  const clPage = await browser.newPage();
  try {
    await clPage.setContent(clHtml, { waitUntil: 'load' });
    const clBuffer = await clPage.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' } });
    fs.writeFileSync(coverLetterPath, clBuffer);
  } finally {
    await clPage.close();
  }

  const output: TailoredOutput = {
    jobId: analysis.jobId,
    cvPath,
    coverLetterPath,
    generatedAt: new Date().toISOString(),
    llmModel: MODEL,
    promptVersion: PROMPT_VERSION,
  };

  logger.info({ action: 'generate_documents_done', jobId: analysis.jobId, cvPath, coverLetterPath });
  return output;
}
