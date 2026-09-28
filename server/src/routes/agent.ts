import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getRun, listRuns, listSteps } from '../db/agentRuns';
import { cancelRun, isRunActive, startAgentRun } from '../agent/orchestrator';
import { PipelineError } from '../services/pipeline';

type IdParams = { id: string };
const router = Router();

router.get('/runs', (req: Request, res: Response) => {
  res.json(listRuns(req.query.limit ? Number(req.query.limit) : 30));
});

router.post('/runs', (req: Request, res: Response) => {
  const { goal } = z.object({ goal: z.string().trim().min(5).max(2000) }).parse(req.body);
  // One run at a time keeps spend predictable and the trace easy to follow.
  if (isRunActive()) throw new PipelineError('An agent run is already in progress. Wait for it to finish or cancel it.', 409);
  res.status(202).json(startAgentRun(goal, 'user'));
});

router.get('/runs/:id', (req: Request<IdParams>, res: Response) => {
  const run = getRun(req.params.id);
  if (!run) throw new PipelineError('Run not found', 404);
  res.json({ run, steps: listSteps(run.id) });
});

router.post('/runs/:id/cancel', (req: Request<IdParams>, res: Response) => {
  if (!cancelRun(req.params.id)) throw new PipelineError('Run is not active', 409);
  res.json({ cancelled: true });
});

export default router;
