import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { loadMasterCV, loadPreferences, MasterCVSchema, PreferencesSchema, saveMasterCV, savePreferences } from '../profile';
import type { MasterCV, Preferences } from '../types/index';
import logger from '../logger';

const router = Router();

router.get('/cv', (_req: Request, res: Response) => {
  res.json(loadMasterCV());
});

router.put('/cv', (req: Request, res: Response) => {
  const parsed = MasterCVSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid CV data', details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  saveMasterCV(parsed.data as MasterCV);
  logger.info({ action: 'update_cv' });
  res.json(parsed.data);
});

router.get('/preferences', (_req: Request, res: Response) => {
  res.json(loadPreferences());
});

router.put('/preferences', (req: Request, res: Response) => {
  const parsed = PreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid preferences', details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  savePreferences(parsed.data as Preferences);
  logger.info({ action: 'update_preferences' });
  res.json(parsed.data);
});

export default router;
