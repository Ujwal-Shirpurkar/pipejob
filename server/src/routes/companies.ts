import { Router } from 'express';
import type { Request, Response } from 'express';
import { listCompanies, upsertCompany } from '../db/schema';

const router = Router();

// GET /api/companies
router.get('/', (req: Request, res: Response) => {
  const { sector, hiring, limit } = req.query;
  const companies = listCompanies({
    sector: sector as string | undefined,
    hiring: hiring === 'true' ? true : hiring === 'false' ? false : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json(companies);
});

// POST /api/companies — add or update a company
router.post('/', (req: Request, res: Response) => {
  const { v4: uuidv4 } = require('uuid') as { v4: () => string };
  const body = req.body as Record<string, unknown>;
  if (!body.name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  upsertCompany({
    id: (body.id as string) ?? uuidv4(),
    name: body.name as string,
    name_normalized: (body.name as string).toLowerCase().trim(),
    website: body.website as string | undefined,
    linkedin_url: body.linkedin_url as string | undefined,
    sector: body.sector as string | undefined,
    city: body.city as string | undefined,
    state: body.state as string | undefined,
    country: (body.country as string) ?? 'DE',
    size_range: body.size_range as string | undefined,
    is_actively_hiring: Boolean(body.is_actively_hiring),
    hiring_sources: body.hiring_sources as string[] | undefined,
    notes: body.notes as string | undefined,
    source: (body.source as string) ?? 'manual',
    source_confidence: (body.source_confidence as string) ?? 'medium',
  });
  res.json({ saved: true });
});

export default router;
