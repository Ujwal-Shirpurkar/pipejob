/**
 * n8n Integration Webhook Routes
 *
 * These endpoints serve as integration points for n8n workflows.
 * n8n can call these to trigger actions, poll state, or receive events.
 *
 * Authentication: All webhook endpoints require the X-Webhook-Secret header
 * matching the WEBHOOK_SECRET env var (set in .env).
 *
 * n8n Integration Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │  n8n Workflow                                           │
 * │                                                         │
 * │  [Schedule Trigger] ─► POST /api/webhooks/n8n/discover │
 * │                              │                          │
 * │                         PipeJob scrapes                 │
 * │                              │                          │
 * │  [Polling] ◄── GET /api/webhooks/n8n/pending-analysis  │
 * │                              │                          │
 * │  [HTTP Request] ─► POST /api/jobs/:id/analyse           │
 * │  [HTTP Request] ─► POST /api/jobs/:id/generate          │
 * │                              │                          │
 * │  [Human Review] ─► review in PipeJob dashboard          │
 * │                              │                          │
 * │  [Conditional] ─► POST /api/webhooks/n8n/approve-apply  │
 * │                         (human approved)                │
 * │                              │                          │
 * │  PipeJob applies ◄── POST /api/jobs/:id/apply           │
 * │                              │                          │
 * │  [Status Push] ◄── GET /api/webhooks/n8n/status-summary │
 * └─────────────────────────────────────────────────────────┘
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { listApplications, getApplication, updateApplicationStatus } from '../db/schema';
import { scrapeJobs } from '../services/scraper/index';
import { insertApplication } from '../db/schema';
import { emitJobEvent } from '../events';
import { config } from '../config';
import logger from '../logger';

const router = Router();

// ── Auth middleware ────────────────────────────────────────────────────────────
function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow in development, block in production
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'Webhook integration not configured (WEBHOOK_SECRET not set)' });
      return;
    }
    next();
    return;
  }
  const provided = req.headers['x-webhook-secret'];
  if (provided !== secret) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }
  next();
}

router.use(webhookAuth);

/**
 * POST /api/webhooks/n8n/discover
 * Trigger a job discovery run from n8n.
 *
 * Body: { keywords: string[], sources?: string[], location?: string }
 * Response: { triggered: true, discovered: number, ids: string[] }
 *
 * n8n node type: HTTP Request
 * Suggested n8n trigger: Schedule (e.g. every 6 hours)
 */
router.post('/n8n/discover', async (req: Request, res: Response) => {
  const { keywords = [], sources = ['indeed'], location } = req.body as {
    keywords?: string[];
    sources?: string[];
    location?: string;
  };

  if (!Array.isArray(keywords) || keywords.length === 0) {
    res.status(400).json({ error: 'keywords array is required' });
    return;
  }

  logger.info({ action: 'webhook_discover', keywords, sources, location });

  try {
    const jobs = await scrapeJobs(sources, keywords, location);
    const ids: string[] = [];
    for (const job of jobs) {
      insertApplication(job);
      ids.push(job.id);
      emitJobEvent(job.id, 'discovered');
    }
    res.json({ triggered: true, discovered: ids.length, ids });
  } catch (err) {
    logger.error({ action: 'webhook_discover', error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/webhooks/n8n/pending-analysis
 * Returns jobs in 'discovered' status that n8n should trigger analysis for.
 *
 * n8n node type: HTTP Request (poll)
 * Suggested n8n trigger: After discover completes, or schedule every 30min
 * Response: { jobs: { id, title, company, source }[] }
 */
router.get('/n8n/pending-analysis', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const jobs = listApplications({ status: 'discovered', limit });
  res.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.job.title,
      company: j.job.company,
      source: j.job.source,
      discoveredAt: j.job.discoveredAt,
      analyseUrl: `${req.protocol}://${req.get('host')}/api/jobs/${j.id}/analyse`,
    })),
  });
});

/**
 * GET /api/webhooks/n8n/pending-review
 * Returns jobs in 'documents_ready' status awaiting human review before applying.
 * This is the human-in-the-loop checkpoint.
 *
 * n8n node type: HTTP Request
 * Suggested usage: n8n polls this, then pauses with a "Wait" node for human approval.
 */
router.get('/n8n/pending-review', (_req: Request, res: Response) => {
  const jobs = listApplications({ status: 'documents_ready' });
  res.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.job.title,
      company: j.job.company,
      matchScore: j.analysis?.matchScore,
      dashboardUrl: `http://localhost:5173/jobs/${j.id}`,
      applyUrl: `http://localhost:3001/api/jobs/${j.id}/apply`,
    })),
  });
});

/**
 * POST /api/webhooks/n8n/approve-apply
 * Called by n8n after human reviews and approves a job for application.
 *
 * Body: { jobId: string, approvedBy?: string }
 * This triggers the apply endpoint internally.
 *
 * n8n node type: HTTP Request (after human approval step)
 */
router.post('/n8n/approve-apply', async (req: Request, res: Response) => {
  const { jobId, approvedBy } = req.body as { jobId?: string; approvedBy?: string };
  if (!jobId) {
    res.status(400).json({ error: 'jobId is required' });
    return;
  }

  const app = getApplication(jobId);
  if (!app) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (app.job.status !== 'documents_ready') {
    res.status(409).json({ error: `Job is in status '${app.job.status}', expected 'documents_ready'` });
    return;
  }

  logger.info({ action: 'webhook_approve_apply', jobId, approvedBy });

  // Delegate to internal apply by making a sub-request via fetch
  try {
    const applyRes = await fetch(`http://localhost:${config.rateLimits.maxApplicationsPerDay ? 3001 : 3001}/api/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await applyRes.json() as unknown;
    res.json({ approved: true, jobId, applyResult: result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/webhooks/n8n/status-summary
 * Returns a high-level summary for n8n dashboards or notification nodes.
 *
 * n8n node type: HTTP Request
 * Suggested usage: Trigger Slack/email notification with summary
 */
router.get('/n8n/status-summary', (_req: Request, res: Response) => {
  const all = listApplications({});
  const summary = {
    total: all.length,
    byStatus: {} as Record<string, number>,
    recentApplied: all
      .filter((j) => j.job.status === 'applied' && j.appliedAt)
      .sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''))
      .slice(0, 5)
      .map((j) => ({ id: j.id, title: j.job.title, company: j.job.company, appliedAt: j.appliedAt })),
  };

  for (const job of all) {
    const s = job.job.status;
    summary.byStatus[s] = (summary.byStatus[s] ?? 0) + 1;
  }

  res.json(summary);
});

/**
 * POST /api/webhooks/n8n/status-update
 * Allows n8n to push a status update (e.g. when it detects an email reply about interview).
 *
 * Body: { jobId: string, status: JobStatus, note?: string }
 */
router.post('/n8n/status-update', (req: Request, res: Response) => {
  const { jobId, status, note } = req.body as { jobId?: string; status?: string; note?: string };
  if (!jobId || !status) {
    res.status(400).json({ error: 'jobId and status are required' });
    return;
  }

  const app = getApplication(jobId);
  if (!app) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  updateApplicationStatus(jobId, status as import('../types/index').JobStatus, note);
  emitJobEvent(jobId, status, note);
  logger.info({ action: 'webhook_status_update', jobId, status, note });
  res.json({ updated: true, jobId, status });
});

export default router;
