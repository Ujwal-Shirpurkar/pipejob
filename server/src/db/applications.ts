import { getDb } from './database';
import logger from '../logger';
import type {
  DiscoveredJob,
  Grade,
  JobApplication,
  JobEvaluation,
  JobStatus,
  StatusHistoryEntry,
  TailoredContent,
  TailoredOutput,
} from '../types/index';

type Row = Record<string, unknown>;

/** Inserts a job unless its URL is already tracked. Returns true when a new row was created. */
export function insertApplication(job: DiscoveredJob): boolean {
  const now = new Date().toISOString();
  const history: StatusHistoryEntry[] = [{ status: job.status, ts: job.discoveredAt, actor: 'system' }];
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO applications
        (id, job_url, job_title, company, location, apply_url, remote, posted_at, source, raw_jd, status,
         status_history, discovered_at, updated_at)
       VALUES
        (@id, @url, @title, @company, @location, @applyUrl, @remote, @postedAt, @source, @rawJD, @status,
         @statusHistory, @discoveredAt, @updatedAt)`
    )
    .run({
      id: job.id,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      applyUrl: job.applyUrl ?? null,
      remote: job.remote === undefined || job.remote === null ? null : job.remote ? 1 : 0,
      postedAt: job.postedAt ?? null,
      source: job.source,
      rawJD: job.rawJD,
      status: job.status,
      statusHistory: JSON.stringify(history),
      discoveredAt: job.discoveredAt,
      updatedAt: now,
    });
  return result.changes > 0;
}

export function findByUrl(url: string): JobApplication | undefined {
  const row = getDb().prepare('SELECT * FROM applications WHERE job_url = ?').get(url) as Row | undefined;
  return row ? rowToApplication(row) : undefined;
}

export function isDuplicate(url: string): boolean {
  return Boolean(getDb().prepare('SELECT 1 FROM applications WHERE job_url = ?').get(url));
}

export function updateApplicationStatus(
  id: string,
  status: JobStatus,
  note?: string,
  actor: StatusHistoryEntry['actor'] = 'system'
): void {
  const db = getDb();
  const row = db.prepare('SELECT status_history FROM applications WHERE id = ?').get(id) as
    | { status_history: string }
    | undefined;

  if (!row) {
    logger.warn({ action: 'update_status', jobId: id, result: 'not_found' });
    return;
  }

  const history: StatusHistoryEntry[] = JSON.parse(row.status_history || '[]');
  history.push({ status, ts: new Date().toISOString(), actor, ...(note ? { note } : {}) });

  db.prepare(
    `UPDATE applications
     SET status = ?, status_history = ?, error = ?, updated_at = ?
     WHERE id = ?`
  ).run(status, JSON.stringify(history), status === 'error' ? note ?? null : null, new Date().toISOString(), id);

  logger.info({ action: 'update_status', jobId: id, status, actor });
}

export function saveEvaluation(id: string, evaluation: JobEvaluation): void {
  getDb()
    .prepare(
      `UPDATE applications
       SET evaluation_json = ?, grade = ?, score = ?, match_score = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      JSON.stringify(evaluation),
      evaluation.grade,
      evaluation.overallScore,
      Math.round((evaluation.overallScore / 5) * 100),
      new Date().toISOString(),
      id
    );
}

export function saveTailoring(id: string, tailoring: TailoredContent, output: TailoredOutput): void {
  getDb()
    .prepare(
      `UPDATE applications
       SET tailoring_json = ?, cv_path = ?, cover_letter_path = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      JSON.stringify({ ...tailoring, _output: output }),
      output.cvPath,
      output.coverLetterPath,
      new Date().toISOString(),
      id
    );
}

export function setReviewRequest(id: string, requested: boolean, note?: string): void {
  getDb()
    .prepare('UPDATE applications SET review_requested = ?, review_note = ?, updated_at = ? WHERE id = ?')
    .run(requested ? 1 : 0, note ?? null, new Date().toISOString(), id);
}

export function setApproved(id: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare('UPDATE applications SET approved_at = ?, review_requested = 0, updated_at = ? WHERE id = ?')
    .run(now, now, id);
}

export function setApplied(id: string, formFieldsUsed?: Record<string, string>): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE applications
       SET applied_at = ?, form_fields_used = COALESCE(?, form_fields_used), review_requested = 0, updated_at = ?
       WHERE id = ?`
    )
    .run(now, formFieldsUsed ? JSON.stringify(formFieldsUsed) : null, now, id);
}

export function setNotes(id: string, notes: string): void {
  getDb().prepare('UPDATE applications SET notes = ?, updated_at = ? WHERE id = ?').run(notes, new Date().toISOString(), id);
}

export function deleteApplication(id: string): boolean {
  return getDb().prepare('DELETE FROM applications WHERE id = ?').run(id).changes > 0;
}

export function getApplication(id: string): JobApplication | undefined {
  const row = getDb().prepare('SELECT * FROM applications WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToApplication(row) : undefined;
}

export interface ListFilters {
  status?: JobStatus | JobStatus[];
  grade?: Grade[];
  reviewRequested?: boolean;
  search?: string;
  limit?: number;
  sort?: 'recent' | 'score';
}

export function listApplications(filters: ListFilters = {}): JobApplication[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (filters.grade?.length) {
    conditions.push(`grade IN (${filters.grade.map(() => '?').join(',')})`);
    params.push(...filters.grade);
  }
  if (filters.reviewRequested !== undefined) {
    conditions.push('review_requested = ?');
    params.push(filters.reviewRequested ? 1 : 0);
  }
  if (filters.search) {
    conditions.push('(job_title LIKE ? OR company LIKE ? OR location LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  let query = 'SELECT * FROM applications';
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query +=
    filters.sort === 'score'
      ? ' ORDER BY score IS NULL, score DESC, discovered_at DESC'
      : ' ORDER BY discovered_at DESC';
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return (getDb().prepare(query).all(...params) as Row[]).map(rowToApplication);
}

export function countAppliedSince(sinceIso: string): number {
  return (
    getDb().prepare('SELECT COUNT(*) AS n FROM applications WHERE applied_at >= ?').get(sinceIso) as { n: number }
  ).n;
}

function parseJson<T>(value: unknown): T | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function rowToApplication(row: Row): JobApplication {
  const status = ((row.status as string) || 'discovered') as JobStatus;
  const tailoringRaw = parseJson<TailoredContent & { _output?: TailoredOutput }>(row.tailoring_json);
  const { _output: storedOutput, ...tailoring } = tailoringRaw ?? {};

  const job: DiscoveredJob = {
    id: row.id as string,
    title: (row.job_title as string) || '',
    company: (row.company as string) || '',
    location: (row.location as string) || '',
    url: row.job_url as string,
    applyUrl: (row.apply_url as string) || undefined,
    source: (row.source as DiscoveredJob['source']) || 'manual',
    rawJD: (row.raw_jd as string) || '',
    remote: row.remote === null || row.remote === undefined ? null : Boolean(row.remote),
    postedAt: (row.posted_at as string) || undefined,
    discoveredAt: (row.discovered_at as string) || '',
    status,
  };

  const legacyScore = typeof row.match_score === 'number' ? Math.round((row.match_score / 20) * 10) / 10 : undefined;

  const application: JobApplication = {
    id: job.id,
    job,
    evaluation: parseJson<JobEvaluation>(row.evaluation_json),
    tailoring: tailoringRaw ? (tailoring as TailoredContent) : undefined,
    score: typeof row.score === 'number' ? row.score : legacyScore,
    grade: (row.grade as Grade) || undefined,
    reviewRequested: Boolean(row.review_requested),
    reviewNote: (row.review_note as string) || undefined,
    approvedAt: (row.approved_at as string) || undefined,
    appliedAt: (row.applied_at as string) || undefined,
    notes: (row.notes as string) || undefined,
    statusHistory: parseJson<StatusHistoryEntry[]>(row.status_history) ?? [],
    formFieldsUsed: parseJson<Record<string, string>>(row.form_fields_used),
    error: (row.error as string) || undefined,
    updatedAt: (row.updated_at as string) || undefined,
  };

  if (row.cv_path) {
    application.output = storedOutput ?? {
      jobId: job.id,
      cvPath: row.cv_path as string,
      coverLetterPath: (row.cover_letter_path as string) || '',
      generatedAt: (row.updated_at as string) || '',
      llmModel: 'unknown',
      promptVersion: '1.0',
    };
  }

  return application;
}
