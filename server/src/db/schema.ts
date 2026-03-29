import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { DiscoveredJob, JobApplication, JobStatus, JDAnalysis } from '../types/index';
import logger from '../logger';

let db: Database.Database;

export function initDb(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_url TEXT UNIQUE NOT NULL,
      job_title TEXT,
      company TEXT,
      source TEXT,
      raw_jd TEXT,
      status TEXT DEFAULT 'discovered',
      match_score INTEGER,
      analysis_json TEXT,
      cv_path TEXT,
      cover_letter_path TEXT,
      applied_at TEXT,
      status_history TEXT,
      form_fields_used TEXT,
      error TEXT,
      discovered_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_normalized TEXT NOT NULL,
      website TEXT,
      linkedin_url TEXT,
      sector TEXT,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'DE',
      size_range TEXT,
      is_actively_hiring INTEGER DEFAULT 0,
      hiring_sources TEXT,
      notes TEXT,
      source TEXT DEFAULT 'seed',
      source_confidence TEXT DEFAULT 'medium',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_company ON applications(company);
    CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name_normalized);
    CREATE INDEX IF NOT EXISTS idx_companies_hiring ON companies(is_actively_hiring);
    CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);
  `);

  // Migration: add analysis_json column to existing DBs that pre-date this column
  try {
    db.exec(`ALTER TABLE applications ADD COLUMN analysis_json TEXT`);
  } catch {
    // Column already exists — nothing to do
  }

  logger.info({ action: 'db_init', dbPath, message: 'Database initialised' });
  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialised. Call initDb() first.');
  }
  return db;
}

export function insertApplication(job: DiscoveredJob): void {
  const database = getDb();
  const initialHistory = JSON.stringify([{ status: job.status, ts: job.discoveredAt }]);
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO applications
      (id, job_url, job_title, company, source, raw_jd, status, status_history, discovered_at, updated_at)
    VALUES
      (@id, @url, @title, @company, @source, @rawJD, @status, @statusHistory, @discoveredAt, @updatedAt)
  `);
  stmt.run({
    id: job.id,
    url: job.url,
    title: job.title,
    company: job.company,
    source: job.source,
    rawJD: job.rawJD,
    status: job.status,
    statusHistory: initialHistory,
    discoveredAt: job.discoveredAt,
    updatedAt: new Date().toISOString(),
  });
  logger.info({ action: 'insert_application', jobId: job.id, company: job.company, result: 'ok' });
}

export function updateApplicationStatus(id: string, status: JobStatus, note?: string): void {
  const database = getDb();
  const row = database.prepare('SELECT status_history FROM applications WHERE id = ?').get(id) as
    | { status_history: string }
    | undefined;

  if (!row) {
    logger.warn({ action: 'update_status', jobId: id, result: 'not_found' });
    return;
  }

  const history: { status: JobStatus; ts: string; note?: string }[] = JSON.parse(row.status_history || '[]');
  history.push({ status, ts: new Date().toISOString(), ...(note ? { note } : {}) });

  database.prepare(`
    UPDATE applications
    SET status = ?, status_history = ?, updated_at = ?
    WHERE id = ?
  `).run(status, JSON.stringify(history), new Date().toISOString(), id);

  logger.info({ action: 'update_status', jobId: id, status, result: 'ok' });
}

export function getApplication(id: string): JobApplication | undefined {
  const database = getDb();
  const row = database.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return rowToApplication(row);
}

// ─── Company Reference CRUD ────────────────────────────────────────────────

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
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO companies (id, name, name_normalized, website, linkedin_url, sector, city, state, country,
      size_range, is_actively_hiring, hiring_sources, notes, source, source_confidence, created_at, updated_at)
    VALUES (@id, @name, @name_normalized, @website, @linkedin_url, @sector, @city, @state, @country,
      @size_range, @is_actively_hiring, @hiring_sources, @notes, @source, @source_confidence, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      is_actively_hiring = excluded.is_actively_hiring,
      hiring_sources = excluded.hiring_sources,
      website = excluded.website,
      updated_at = excluded.updated_at
  `).run({
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
  const database = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters?.sector) { conditions.push('sector = ?'); params.push(filters.sector); }
  if (filters?.hiring !== undefined) { conditions.push('is_actively_hiring = ?'); params.push(filters.hiring ? 1 : 0); }

  let query = 'SELECT * FROM companies';
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY name_normalized';
  if (filters?.limit) { query += ' LIMIT ?'; params.push(filters.limit); }

  const rows = database.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    ...(r as unknown as CompanyRecord),
    is_actively_hiring: Boolean(r.is_actively_hiring),
    hiring_sources: r.hiring_sources ? JSON.parse(r.hiring_sources as string) as string[] : [],
  }));
}

export function seedCompaniesIfEmpty(companies: Omit<CompanyRecord, 'created_at' | 'updated_at'>[]): number {
  const database = getDb();
  const count = (database.prepare('SELECT COUNT(*) as n FROM companies').get() as { n: number }).n;
  if (count > 0) return 0;
  for (const c of companies) upsertCompany(c);
  logger.info({ action: 'seed_companies', inserted: companies.length });
  return companies.length;
}

export function saveAnalysis(id: string, analysis: JDAnalysis): void {
  const database = getDb();
  database.prepare(`
    UPDATE applications SET analysis_json = ?, updated_at = ? WHERE id = ?
  `).run(JSON.stringify(analysis), new Date().toISOString(), id);
}

export function isDuplicate(url: string): boolean {
  const database = getDb();
  const row = database.prepare('SELECT id FROM applications WHERE job_url = ?').get(url);
  return !!row;
}

export function listApplications(filters?: { status?: JobStatus; limit?: number }): JobApplication[] {
  const database = getDb();
  let query = 'SELECT * FROM applications';
  const params: (string | number)[] = [];

  if (filters?.status) {
    query += ' WHERE status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY discovered_at DESC';

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = database.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map(rowToApplication);
}

function rowToApplication(row: Record<string, unknown>): JobApplication {
  const statusHistory = JSON.parse((row.status_history as string) || '[]');
  const formFieldsUsed = row.form_fields_used ? JSON.parse(row.form_fields_used as string) : undefined;

  const job: DiscoveredJob = {
    id: row.id as string,
    title: (row.job_title as string) || '',
    company: (row.company as string) || '',
    location: '',
    url: row.job_url as string,
    source: (row.source as DiscoveredJob['source']) || 'manual',
    rawJD: (row.raw_jd as string) || '',
    discoveredAt: (row.discovered_at as string) || '',
    status: (row.status as JobStatus) || 'discovered',
  };

  const application: JobApplication = {
    id: row.id as string,
    job,
    statusHistory,
    appliedAt: row.applied_at as string | undefined,
    formFieldsUsed,
    error: row.error as string | undefined,
  };

  if (row.analysis_json) {
    application.analysis = JSON.parse(row.analysis_json as string) as JDAnalysis;
  }

  if (row.cv_path) {
    application.output = {
      jobId: row.id as string,
      cvPath: row.cv_path as string,
      coverLetterPath: (row.cover_letter_path as string) || '',
      generatedAt: (row.updated_at as string) || '',
      llmModel: 'claude-sonnet-4-20250514',
      promptVersion: '1.0',
    };
  }

  return application;
}
