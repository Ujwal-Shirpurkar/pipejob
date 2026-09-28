import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { config } from '../config';
import { deleteApplication, getApplication, listApplications, setNotes } from '../db/applications';
import {
  approve,
  dailyApplicationBudget,
  markApplied,
  PipelineError,
  runEvaluation,
  runTailoring,
  setStatus,
  skip,
} from '../services/pipeline';
import { importFromText, importFromUrl } from '../services/sources/importer';
import { searchJobs } from '../services/sources/search';
import { JOB_STATUSES, type Grade, type JobStatus } from '../types/index';

type IdParams = { id: string };
const router = Router();

const csv = (v: unknown) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

// GET /api/jobs?status=a,b&grade=A,B&review=true&search=&sort=score&limit=
router.get('/', (req: Request, res: Response) => {
  const { review, search, sort, limit } = req.query;
  res.json(
    listApplications({
      status: csv(req.query.status) as JobStatus[] | undefined,
      grade: csv(req.query.grade) as Grade[] | undefined,
      reviewRequested: review === 'true' ? true : review === 'false' ? false : undefined,
      search: typeof search === 'string' && search ? search : undefined,
      sort: sort === 'score' ? 'score' : 'recent',
      limit: limit ? Number(limit) : undefined,
    })
  );
});

router.get('/budget', (_req, res) => {
  res.json(dailyApplicationBudget());
});

const SearchBody = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  location: z.string().optional(),
  remoteOnly: z.boolean().optional(),
  companies: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

// POST /api/jobs/search — scan portals without the agent
router.post('/search', async (req: Request, res: Response) => {
  const body = SearchBody.parse(req.body);
  const report = await searchJobs(body);
  res.json({
    scanned: report.scanned,
    sourcesQueried: report.sourcesQueried.length,
    sourceErrors: report.sourceErrors,
    newCount: report.results.filter((r) => r.isNew).length,
    results: report.results.map((r) => ({ id: r.job.id, title: r.job.title, company: r.job.company, isNew: r.isNew, relevance: r.relevance })),
  });
});

const ImportBody = z.union([
  z.object({ url: z.url() }),
  z.object({
    text: z.string().min(1),
    title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
    url: z.string().optional(),
  }),
]);

// POST /api/jobs/import — from a URL or pasted JD text
router.post('/import', async (req: Request, res: Response) => {
  const body = ImportBody.parse(req.body);
  const result = 'text' in body ? await importFromText(body) : await importFromUrl(body.url);
  res.status(result.isNew ? 201 : 200).json(result);
});

router.get('/:id', (req: Request<IdParams>, res: Response) => {
  const app = getApplication(req.params.id);
  if (!app) throw new PipelineError('Application not found', 404);
  res.json(app);
});

router.post('/:id/evaluate', async (req: Request<IdParams>, res: Response) => {
  res.json(await runEvaluation(req.params.id, { actor: 'human' }));
});

router.post('/:id/tailor', async (req: Request<IdParams>, res: Response) => {
  const { tailoring } = await runTailoring(req.params.id, { actor: 'human' });
  res.json(tailoring);
});

// Human-in-the-loop checkpoint: explicit approval after reviewing documents.
router.post('/:id/approve', (req: Request<IdParams>, res: Response) => {
  approve(req.params.id);
  res.json(getApplication(req.params.id));
});

// The candidate submitted the application themselves on the employer's site.
router.post('/:id/applied', (req: Request<IdParams>, res: Response) => {
  const { note } = z.object({ note: z.string().optional() }).parse(req.body ?? {});
  markApplied(req.params.id, note);
  res.json(getApplication(req.params.id));
});

router.post('/:id/skip', (req: Request<IdParams>, res: Response) => {
  const { reason } = z.object({ reason: z.string().default('Not a fit') }).parse(req.body ?? {});
  skip(req.params.id, reason, 'human');
  res.json(getApplication(req.params.id));
});

router.patch('/:id/status', (req: Request<IdParams>, res: Response) => {
  const { status, note } = z
    .object({ status: z.enum(JOB_STATUSES as [JobStatus, ...JobStatus[]]), note: z.string().optional() })
    .parse(req.body);
  setStatus(req.params.id, status, note, 'human');
  res.json(getApplication(req.params.id));
});

router.patch('/:id/notes', (req: Request<IdParams>, res: Response) => {
  const { notes } = z.object({ notes: z.string() }).parse(req.body);
  if (!getApplication(req.params.id)) throw new PipelineError('Application not found', 404);
  setNotes(req.params.id, notes);
  res.json({ saved: true });
});

router.delete('/:id', (req: Request<IdParams>, res: Response) => {
  const { id } = req.params;
  if (!deleteApplication(id)) throw new PipelineError('Application not found', 404);
  const dir = path.join(path.resolve(config.outputDir), path.basename(id));
  fs.rmSync(dir, { recursive: true, force: true });
  res.status(204).end();
});

// GET /api/jobs/:id/documents/cv|cover-letter[?download=1]
router.get('/:id/documents/:type', (req: Request<IdParams & { type: string }>, res: Response) => {
  const { id, type } = req.params;
  if (type !== 'cv' && type !== 'cover-letter') throw new PipelineError('type must be cv or cover-letter');
  const app = getApplication(id);
  if (!app) throw new PipelineError('Application not found', 404);

  // path.basename guards against traversal via the id parameter.
  const file = path.join(path.resolve(config.outputDir), path.basename(id), `${type}.pdf`);
  if (!fs.existsSync(file)) throw new PipelineError('Document not generated yet', 404);

  const safe = (s: string) => s.replace(/[^\w.-]+/g, '_').slice(0, 60);
  const filename = `${safe(app.job.company)}_${type}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${filename}"`);
  fs.createReadStream(file).pipe(res);
});

export default router;
