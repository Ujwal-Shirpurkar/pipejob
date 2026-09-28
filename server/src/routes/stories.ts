import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { deleteStory, getStory, listStories, upsertStory } from '../db/stories';
import { PipelineError } from '../services/pipeline';

type IdParams = { id: string };
const router = Router();

const StoryBody = z.object({
  title: z.string().min(1),
  situation: z.string().default(''),
  task: z.string().default(''),
  action: z.string().default(''),
  result: z.string().default(''),
  reflection: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

router.get('/', (_req: Request, res: Response) => {
  res.json(listStories());
});

router.post('/', (req: Request, res: Response) => {
  res.status(201).json(upsertStory(StoryBody.parse(req.body)));
});

router.put('/:id', (req: Request<IdParams>, res: Response) => {
  const existing = getStory(req.params.id);
  if (!existing) throw new PipelineError('Story not found', 404);
  res.json(upsertStory({ ...StoryBody.parse(req.body), id: existing.id, sourceJobId: existing.sourceJobId }));
});

router.delete('/:id', (req: Request<IdParams>, res: Response) => {
  if (!deleteStory(req.params.id)) throw new PipelineError('Story not found', 404);
  res.status(204).end();
});

export default router;
