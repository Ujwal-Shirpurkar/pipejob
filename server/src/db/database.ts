import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from '../logger';

let db: Database.Database | undefined;

export function initDb(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      trigger TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'running',
      model TEXT NOT NULL,
      turns INTEGER NOT NULL DEFAULT 0,
      tool_calls INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      summary TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      turn INTEGER NOT NULL,
      type TEXT NOT NULL,
      tool_name TEXT,
      tool_use_id TEXT,
      content TEXT NOT NULL DEFAULT '',
      data_json TEXT,
      is_error INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      ts TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purpose TEXT NOT NULL,
      model TEXT NOT NULL,
      job_id TEXT,
      run_id TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      stop_reason TEXT,
      ts TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      situation TEXT NOT NULL DEFAULT '',
      task TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT '',
      reflection TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      source_job_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  migrate(db);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_company ON applications(company);
    CREATE INDEX IF NOT EXISTS idx_grade ON applications(grade);
    CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name_normalized);
    CREATE INDEX IF NOT EXISTS idx_companies_hiring ON companies(is_actively_hiring);
    CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);
    CREATE INDEX IF NOT EXISTS idx_steps_run ON agent_steps(run_id, seq);
    CREATE INDEX IF NOT EXISTS idx_llm_calls_ts ON llm_calls(ts);
  `);

  logger.info({ action: 'db_init', dbPath, message: 'Database initialised' });
  return db;
}

/** Additive, idempotent migrations so databases from earlier versions keep working. */
function migrate(database: Database.Database): void {
  const columns = new Set(
    (database.prepare('PRAGMA table_info(applications)').all() as { name: string }[]).map((c) => c.name)
  );
  const add = (name: string, type: string) => {
    if (!columns.has(name)) database.exec(`ALTER TABLE applications ADD COLUMN ${name} ${type}`);
  };

  add('analysis_json', 'TEXT');
  add('location', 'TEXT');
  add('apply_url', 'TEXT');
  add('remote', 'INTEGER');
  add('posted_at', 'TEXT');
  add('evaluation_json', 'TEXT');
  add('tailoring_json', 'TEXT');
  add('grade', 'TEXT');
  add('score', 'REAL');
  add('review_requested', 'INTEGER NOT NULL DEFAULT 0');
  add('review_note', 'TEXT');
  add('approved_at', 'TEXT');
  add('notes', 'TEXT');

  // v1 used 'analysed' for what is now 'evaluated'.
  database.exec(`UPDATE applications SET status = 'evaluated' WHERE status = 'analysed'`);
  // v1 auto-submitted applications; that flow no longer exists.
  database.exec(`UPDATE applications SET status = 'documents_ready' WHERE status = 'applying'`);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

export function closeDb(): void {
  db?.close();
  db = undefined;
}
