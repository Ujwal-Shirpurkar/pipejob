import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  insertApplication,
  updateApplicationStatus,
  getApplication,
  listApplications,
  saveAnalysis,
  getDb,
} from '../db/schema';
import { scrapeJobs } from '../services/scraper/index';
import { analyseJD } from '../services/documents/analyser';
import { submitApplication } from '../services/submission/formFiller';
import { applicationRateLimiter, checkDailyLimit, recordApplication } from '../middleware/rateLimiter';
import { config } from '../config';
import logger from '../logger';
import { jobEvents, emitJobEvent } from '../events';
import type { JobStatus } from '../types/index';

type IdParams = { id: string };

const router = Router();

function loadMasterCV() {
  const cvPath = path.resolve(config.masterCVPath);
  return JSON.parse(fs.readFileSync(cvPath, 'utf-8'));
}

// GET /api/jobs
router.get('/', (req: Request, res: Response) => {
  const { status, limit } = req.query;
  const jobs = listApplications({
    status: status as JobStatus | undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json(jobs);
});

// GET /api/jobs/stream  (SSE) — must be before /:id
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  jobEvents.on('job_update', onEvent);
  res.write(`data: ${JSON.stringify({ connected: true, ts: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    jobEvents.off('job_update', onEvent);
  });
});

// GET /api/jobs/:id
router.get('/:id', (req: Request<IdParams>, res: Response) => {
  const { id } = req.params;
  const app = getApplication(id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  res.json(app);
});

// POST /api/jobs/discover
router.post('/discover', async (req: Request, res: Response) => {
  const { keywords, sources } = req.body as { keywords: string[]; sources: string[] };
  if (!Array.isArray(keywords) || !Array.isArray(sources)) {
    res.status(400).json({ error: 'keywords and sources must be arrays' });
    return;
  }

  try {
    const jobs = await scrapeJobs(sources, keywords);
    const ids: string[] = [];
    for (const job of jobs) {
      insertApplication(job);
      ids.push(job.id);
      emitJobEvent(job.id, 'discovered');
    }
    logger.info({ action: 'discover', jobsFound: jobs.length, ids });
    res.json({ discovered: ids.length, ids });
  } catch (err) {
    logger.error({ action: 'discover', error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/jobs/:id/analyse
router.post('/:id/analyse', async (req: Request<IdParams>, res: Response) => {
  const { id } = req.params;
  const app = getApplication(id);
  if (!app) { res.status(404).json({ error: 'Not found' }); return; }

  try {
    const masterCV = loadMasterCV();
    const analysis = await analyseJD(masterCV, app.job.rawJD, app.id);
    saveAnalysis(app.id, analysis);
    updateApplicationStatus(app.id, 'analysed');
    emitJobEvent(app.id, 'analysed', `Match score: ${analysis.matchScore}`);

    getDb().prepare('UPDATE applications SET match_score = ?, updated_at = ? WHERE id = ?')
      .run(analysis.matchScore, new Date().toISOString(), app.id);

    res.json(analysis);
  } catch (err) {
    updateApplicationStatus(app.id, 'error', String(err));
    logger.error({ action: 'analyse', jobId: app.id, error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/jobs/:id/generate
router.post('/:id/generate', async (req: Request<IdParams>, res: Response) => {
  const { id } = req.params;
  const app = getApplication(id);
  if (!app) { res.status(404).json({ error: 'Not found' }); return; }
  if (!app.analysis) { res.status(400).json({ error: 'Job must be analysed first' }); return; }

  try {
    const masterCV = loadMasterCV();
    const { generateDocuments } = await import('../services/documents/generator');
    const output = await generateDocuments(masterCV, app.analysis, config.outputDir);
    updateApplicationStatus(app.id, 'documents_ready');

    getDb().prepare('UPDATE applications SET cv_path = ?, cover_letter_path = ?, updated_at = ? WHERE id = ?')
      .run(output.cvPath, output.coverLetterPath, new Date().toISOString(), app.id);

    emitJobEvent(app.id, 'documents_ready');
    res.json(output);
  } catch (err) {
    updateApplicationStatus(app.id, 'error', String(err));
    logger.error({ action: 'generate', jobId: app.id, error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/jobs/:id/apply
router.post('/:id/apply', applicationRateLimiter, async (req: Request<IdParams>, res: Response) => {
  const { id } = req.params;
  const app = getApplication(id);
  if (!app) { res.status(404).json({ error: 'Not found' }); return; }
  if (!app.output) { res.status(400).json({ error: 'Documents must be generated first' }); return; }

  if (!await checkDailyLimit()) {
    res.status(429).json({ error: 'Daily application limit reached' });
    return;
  }

  try {
    updateApplicationStatus(app.id, 'applying');
    emitJobEvent(app.id, 'applying');

    const result = await submitApplication(app.job, app.output, config);
    recordApplication();

    if (result.success) {
      updateApplicationStatus(app.id, 'applied');
      getDb().prepare('UPDATE applications SET applied_at = ?, form_fields_used = ?, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), JSON.stringify(result.fieldsUsed), new Date().toISOString(), app.id);
      emitJobEvent(app.id, 'applied');
    } else {
      updateApplicationStatus(app.id, 'error', 'Submission failed');
      emitJobEvent(app.id, 'error', 'Submission failed');
    }

    res.json(result);
  } catch (err) {
    updateApplicationStatus(app.id, 'error', String(err));
    logger.error({ action: 'apply', jobId: app.id, error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/jobs/:id/status
router.patch('/:id/status', (req: Request<IdParams>, res: Response) => {
  const { id } = req.params;
  const { status, note } = req.body as { status: JobStatus; note?: string };
  const app = getApplication(id);
  if (!app) { res.status(404).json({ error: 'Not found' }); return; }

  updateApplicationStatus(id, status, note);
  emitJobEvent(id, status, note);
  res.json({ id, status });
});

export default router;
