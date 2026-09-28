import { getDb } from './database';
import logger from '../logger';

export interface CompanyRecord {
  id: string;
  name: string;
  name_normalized: string;
  website?: string;
  linkedin_url?: string;
  sector?: string;
  city?: string;
  state?: string;
  country: string;
  size_range?: string;
  is_actively_hiring: boolean;
  hiring_sources?: string[];
  notes?: string;
  source: string;
  source_confidence: string;
  created_at: string;
  updated_at: string;
}

export function upsertCompany(c: Omit<CompanyRecord, 'created_at' | 'updated_at'>): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO companies (id, name, name_normalized, website, linkedin_url, sector, city, state, country,
        size_range, is_actively_hiring, hiring_sources, notes, source, source_confidence, created_at, updated_at)
       VALUES (@id, @name, @name_normalized, @website, @linkedin_url, @sector, @city, @state, @country,
        @size_range, @is_actively_hiring, @hiring_sources, @notes, @source, @source_confidence, @created_at, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
        is_actively_hiring = excluded.is_actively_hiring,
        hiring_sources = excluded.hiring_sources,
        website = excluded.website,
        updated_at = excluded.updated_at`
    )
    .run({
      id: c.id,
      name: c.name,
      name_normalized: c.name_normalized,
      website: c.website ?? null,
      linkedin_url: c.linkedin_url ?? null,
      sector: c.sector ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      country: c.country,
      size_range: c.size_range ?? null,
      is_actively_hiring: c.is_actively_hiring ? 1 : 0,
      hiring_sources: c.hiring_sources ? JSON.stringify(c.hiring_sources) : null,
      notes: c.notes ?? null,
      source: c.source,
      source_confidence: c.source_confidence,
      created_at: now,
      updated_at: now,
    });
}

export function listCompanies(filters?: { sector?: string; hiring?: boolean; limit?: number }): CompanyRecord[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters?.sector) {
    conditions.push('sector = ?');
    params.push(filters.sector);
  }
  if (filters?.hiring !== undefined) {
    conditions.push('is_actively_hiring = ?');
    params.push(filters.hiring ? 1 : 0);
  }

  let query = 'SELECT * FROM companies';
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY name_normalized';
  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = getDb().prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    ...(r as unknown as CompanyRecord),
    is_actively_hiring: Boolean(r.is_actively_hiring),
    hiring_sources: r.hiring_sources ? (JSON.parse(r.hiring_sources as string) as string[]) : [],
  }));
}

export function seedCompaniesIfEmpty(companies: Omit<CompanyRecord, 'created_at' | 'updated_at'>[]): number {
  const count = (getDb().prepare('SELECT COUNT(*) as n FROM companies').get() as { n: number }).n;
  if (count > 0) return 0;
  for (const c of companies) upsertCompany(c);
  logger.info({ action: 'seed_companies', inserted: companies.length });
  return companies.length;
}
