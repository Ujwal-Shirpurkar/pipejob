/**
 * n8n / automation integration.
 *
 * Lets an external workflow engine schedule scans, trigger agent runs, poll the review
 * queue and push status changes (e.g. an interview invite detected in the inbox).
 * There is deliberately no endpoint that submits applications — that stays with the human.
 *
 * Auth: every request must send `X-Webhook-Secret: <WEBHOOK_SECRET>`.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { config } from '../config';
import { listApplications } from '../db/applications';
import { isRunActive, startAgentRun } from '../agent/orchestrator';
import { PipelineError, setStatus } from '../services/pipeline';
import { searchJobs } from '../services/sources/search';
import { loadPreferences } from '../profile';
import type { JobStatus } from '../types/index';

const router = Router();

function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = config.webhookSecret;
  if (!secret) {
    res.status(503).json({ error: 'Webhook integration disabled: set WEBHOOK_SECRET to enable it.' });
    return;
  }
  const provided = Buffer.from(String(req.headers['x-webhook-secret'] ?? ''));
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }
  next();
}

router.use(webhookAuth);

// POST /api/webhooks/n8n/search — scheduled portal scan (no LLM cost)
router.post('/n8n/search', async (req: Request, res: Response) => {
  const prefs = loadPreferences();
  const body = z
    .object({ keywords: z.array(z.string()).optional(), location: z.string().optional() })
    .parse(req.body ?? {});
  const report = await searchJobs({
    keywords: body.keywords?.length ? body.keywords : prefs.search.keywords,
    location: body.location ?? prefs.search.location,
  });
  res.json({ scanned: report.scanned, newJobs: report.results.filter((r) => r.isNew).map((r) => ({ id: r.job.id, title: r.job.title, company: r.job.company })) });
});

// POST /api/webhooks/n8n/agent-run — start the agent with a goal (defaults to the autopilot goal)
router.post('/n8n/agent-run', (req: Request, res: Response) => {
  const { goal } = z.object({ goal: z.string().optional() }).parse(req.body ?? {});
  if (isRunActive()) throw new PipelineError('An agent run is already in progress', 409);
  const run = startAgentRun(goal || loadPreferences().autopilotGoal, 'webhook');
  res.status(202).json({ runId: run.id, dashboardUrl: `${config.clientUrl}/agent/${run.id}` });
});

// GET /api/webhooks/n8n/review-queue — jobs the agent shortlisted for the human
router.get('/n8n/review-queue', (_req: Request, res: Response) => {
  res.json({
    jobs: listApplications({ reviewRequested: true, sort: 'score' }).map((j) => ({
      id: j.id,
      title: j.job.title,
      company: j.job.company,
      grade: j.grade,
      note: j.reviewNote,
      dashboardUrl: `${config.clientUrl}/jobs/${j.id}`,
    })),
  });
});

// GET /api/webhooks/n8n/status-summary — digest for Slack / e-mail nodes
router.get('/n8n/status-summary', (_req: Request, res: Response) => {
  const all = listApplications();
  const byStatus: Record<string, number> = {};
  for (const j of all) byStatus[j.job.status] = (byStatus[j.job.status] ?? 0) + 1;
  res.json({
    total: all.length,
    byStatus,
    reviewQueue: all.filter((j) => j.reviewRequested).length,
    recentApplied: all
      .filter((j) => j.appliedAt)
      .sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''))
      .slice(0, 5)
      .map((j) => ({ id: j.id, title: j.job.title, company: j.job.company, appliedAt: j.appliedAt })),
  });
});

// POST /api/webhooks/n8n/status-update — e.g. an interview invitation or rejection e-mail arrived
router.post('/n8n/status-update', (req: Request, res: Response) => {
  const { jobId, status, note } = z
    .object({ jobId: z.string(), status: z.enum(['interview', 'offer', 'rejected']), note: z.string().optional() })
    .parse(req.body);
  setStatus(jobId, status as JobStatus, note, 'system');
  res.json({ updated: true, jobId, status });
});

export default router;
