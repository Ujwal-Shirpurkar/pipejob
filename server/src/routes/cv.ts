import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { config } from '../config';
import logger from '../logger';

type DownloadParams = { jobId: string; type: string };

const router = Router();

const MasterCVSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  linkedin: z.string().url().or(z.literal('')),
  github: z.string().url().or(z.literal('')).optional(),
  location: z.string().min(1),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    bullets: z.array(z.string()),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    field: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    gpa: z.string().optional(),
  })),
  languages: z.array(z.object({
    language: z.string(),
    level: z.string(),
  })),
});

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
  const parsed = MasterCVSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid CV data', details: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const cvPath = path.resolve(config.masterCVPath);
    fs.writeFileSync(cvPath, JSON.stringify(parsed.data, null, 2), 'utf-8');
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

  const baseName = type === 'cv' ? 'cv' : 'cover-letter';
  const jobDir = path.join(path.resolve(config.outputDir), jobId);

  // Try PDF first (new pipeline), fall back to DOCX (legacy)
  const pdfPath = path.join(jobDir, `${baseName}.pdf`);
  const docxPath = path.join(jobDir, `${baseName}.docx`);

  if (fs.existsSync(pdfPath)) {
    logger.info({ action: 'download_file', jobId, type, format: 'pdf' });
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(pdfPath).pipe(res);
  } else if (fs.existsSync(docxPath)) {
    logger.info({ action: 'download_file', jobId, type, format: 'docx' });
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    fs.createReadStream(docxPath).pipe(res);
  } else {
    res.status(404).json({ error: 'File not found. Generate documents first.' });
  }
});

export default router;
