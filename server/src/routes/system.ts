import { Router } from 'express';
import type { Request, Response } from 'express';
import { config, isLlmConfigured } from '../config';
import { listRuns } from '../db/agentRuns';
import { listApplications } from '../db/applications';
import { summarizeLlmUsage } from '../db/llmCalls';
import { appEvents, type AppEvent } from '../events';
import { dailyApplicationBudget } from '../services/pipeline';
import { loadPortals } from '../services/sources/search';

const router = Router();

// GET /api/system — capabilities and configuration the UI adapts to
router.get('/system', (_req: Request, res: Response) => {
  res.json({
    llmConfigured: isLlmConfigured(),
    model: config.model,
    agentEffort: config.agentEffort,
    evalEffort: config.evalEffort,
    agentLimits: config.agentLimits,
    limits: config.limits,
    autopilotCron: config.autopilotCron ?? null,
    notificationsConfigured: Boolean(config.telegramToken && config.telegramChatId),
    portals: loadPortals(),
  });
});

// GET /api/stats — funnel, grade distribution and LLM spend for the overview page
router.get('/stats', (_req: Request, res: Response) => {
  const apps = listApplications();
  const byStatus: Record<string, number> = {};
  const byGrade: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const byArchetype: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const a of apps) {
    byStatus[a.job.status] = (byStatus[a.job.status] ?? 0) + 1;
    bySource[a.job.source] = (bySource[a.job.source] ?? 0) + 1;
    if (a.grade) byGrade[a.grade]++;
    if (a.evaluation) byArchetype[a.evaluation.archetype] = (byArchetype[a.evaluation.archetype] ?? 0) + 1;
  }

  const evaluated = apps.filter((a) => a.evaluation);
  const reached = (statuses: string[]) => apps.filter((a) => statuses.includes(a.job.status) || a.statusHistory.some((h) => statuses.includes(h.status))).length;

  res.json({
    total: apps.length,
    byStatus,
    byGrade,
    byArchetype,
    bySource,
    funnel: [
      { stage: 'Discovered', count: apps.length },
      { stage: 'Evaluated', count: evaluated.length },
      { stage: 'Documents ready', count: reached(['documents_ready', 'applied', 'interview', 'offer']) },
      { stage: 'Applied', count: reached(['applied', 'interview', 'offer']) },
      { stage: 'Interview', count: reached(['interview', 'offer']) },
      { stage: 'Offer', count: reached(['offer']) },
    ],
    reviewQueue: apps.filter((a) => a.reviewRequested).length,
    averageScore: evaluated.length ? evaluated.reduce((s, a) => s + (a.score ?? 0), 0) / evaluated.length : null,
    budget: dailyApplicationBudget(),
    llm: {
      allTime: summarizeLlmUsage(),
      last7Days: summarizeLlmUsage(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    },
    recentRuns: listRuns(5),
  });
});

// GET /api/events — one SSE stream for job updates and live agent traces
router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: AppEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  appEvents.on('event', send);
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date().toISOString() })}\n\n`);

  // Heartbeat keeps proxies from closing idle connections.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    appEvents.off('event', send);
  });
});

export default router;
