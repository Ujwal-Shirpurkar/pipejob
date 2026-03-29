import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import logger from '../logger';

type DownloadParams = { jobId: string; type: string };

const router = Router();

// GET /api/cv
router.get('/', (_req: Request, res: Response) => {
  try {
    const cvPath = path.resolve(config.masterCVPath);
    const cv = JSON.parse(fs.readFileSync(cvPath, 'utf-8'));
    res.json(cv);
  } catch (err) {
    logger.error({ action: 'get_cv', error: String(err) });
    res.status(500).json({ error: 'Failed to load master CV' });
  }
});

// POST /api/cv
router.post('/', (req: Request<Record<string, never>>, res: Response) => {
  try {
    const cvPath = path.resolve(config.masterCVPath);
    fs.writeFileSync(cvPath, JSON.stringify(req.body, null, 2), 'utf-8');
    logger.info({ action: 'update_cv', result: 'ok' });
    res.json({ saved: true });
  } catch (err) {
    logger.error({ action: 'update_cv', error: String(err) });
    res.status(500).json({ error: 'Failed to save master CV' });
  }
});

// GET /api/cv/download/:jobId/:type
router.get('/download/:jobId/:type', (req: Request<DownloadParams>, res: Response) => {
  const { jobId, type } = req.params;
  if (type !== 'cv' && type !== 'cover-letter') {
    res.status(400).json({ error: 'type must be cv or cover-letter' });
    return;
  }

  const filename = type === 'cv' ? 'cv.docx' : 'cover-letter.docx';
  const filePath = path.join(path.resolve(config.outputDir), jobId, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  logger.info({ action: 'download_file', jobId, type, filePath });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  fs.createReadStream(filePath).pipe(res);
});

export default router;
