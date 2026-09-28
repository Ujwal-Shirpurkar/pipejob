import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../db/database';
import { insertApplication } from '../db/applications';
import { executeTool, toolDefinitions, type ToolContext } from './tools';

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    runId: 'test',
    signal: new AbortController().signal,
    counters: { evaluations: 0, tailored: 0 },
    limits: { maxEvaluations: 2, maxTailored: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  initDb(':memory:');
  insertApplication({
    id: 'job-1',
    title: 'Working Student AI',
    company: 'Acme',
    location: 'Berlin',
    url: 'https://example.com/1',
    source: 'ashby',
    rawJD: 'Build agents',
    discoveredAt: new Date().toISOString(),
    status: 'discovered',
  });
});
afterEach(() => closeDb());

describe('agent tools', () => {
  it('generates a JSON schema for every tool', () => {
    const defs = toolDefinitions();
    expect(defs.map((d) => d.name)).toEqual([
      'get_candidate_profile',
      'search_jobs',
      'list_pipeline',
      'get_job_details',
      'import_job',
      'evaluate_job',
      'tailor_application',
      'shortlist_for_review',
      'skip_job',
    ]);
    for (const d of defs) expect(d.input_schema.type).toBe('object');
  });

  it('exposes no tool that could submit an application', () => {
    const names = toolDefinitions().map((d) => d.name).join(' ');
    expect(names).not.toMatch(/apply|submit|send/);
  });

  it('rejects invalid input before running the tool', async () => {
    const result = await executeTool('search_jobs', { keywords: [] }, ctx());
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.output)).toMatch(/Invalid input/);
  });

  it('returns a recoverable error for unknown job ids', async () => {
    const result = await executeTool('get_job_details', { job_id: 'nope' }, ctx());
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.output)).toMatch(/No job with id/);
  });

  it('enforces the per-run evaluation budget without calling the model', async () => {
    const result = await executeTool('evaluate_job', { job_id: 'job-1' }, ctx({ counters: { evaluations: 2, tailored: 0 } }));
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.output)).toMatch(/budget/);
  });

  it('refuses to shortlist a job that was never evaluated', async () => {
    const result = await executeTool('shortlist_for_review', { job_id: 'job-1', note: 'great' }, ctx());
    expect(result.isError).toBe(true);
  });

  it('lets the agent skip a job with a reason', async () => {
    const result = await executeTool('skip_job', { job_id: 'job-1', reason: 'Requires 5 years experience' }, ctx());
    expect(result).toEqual({ output: { job_id: 'job-1', skipped: true }, isError: false });
  });
});
