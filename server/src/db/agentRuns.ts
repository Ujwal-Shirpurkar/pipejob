import { getDb } from './database';
import type { AgentRun, AgentRunStatus, AgentStep, AgentTrigger } from '../types/index';

type Row = Record<string, unknown>;

export function createRun(run: { id: string; goal: string; trigger: AgentTrigger; model: string }): AgentRun {
  const startedAt = new Date().toISOString();
  getDb()
    .prepare(`INSERT INTO agent_runs (id, goal, trigger, status, model, started_at) VALUES (?, ?, ?, 'running', ?, ?)`)
    .run(run.id, run.goal, run.trigger, run.model, startedAt);
  return getRun(run.id)!;
}

export function updateRunProgress(
  id: string,
  delta: { turns?: number; toolCalls?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; costUsd?: number }
): void {
  getDb()
    .prepare(
      `UPDATE agent_runs SET
        turns = turns + @turns,
        tool_calls = tool_calls + @toolCalls,
        input_tokens = input_tokens + @inputTokens,
        output_tokens = output_tokens + @outputTokens,
        cache_read_tokens = cache_read_tokens + @cacheReadTokens,
        cost_usd = cost_usd + @costUsd
       WHERE id = @id`
    )
    .run({
      id,
      turns: delta.turns ?? 0,
      toolCalls: delta.toolCalls ?? 0,
      inputTokens: delta.inputTokens ?? 0,
      outputTokens: delta.outputTokens ?? 0,
      cacheReadTokens: delta.cacheReadTokens ?? 0,
      costUsd: delta.costUsd ?? 0,
    });
}

export function finishRun(id: string, status: Exclude<AgentRunStatus, 'running'>, result: { summary?: string; error?: string }): void {
  getDb()
    .prepare('UPDATE agent_runs SET status = ?, summary = ?, error = ?, finished_at = ? WHERE id = ?')
    .run(status, result.summary ?? null, result.error ?? null, new Date().toISOString(), id);
}

/** Runs left in 'running' by a crashed/restarted process can never finish — mark them failed on boot. */
export function failOrphanedRuns(): number {
  return getDb()
    .prepare(`UPDATE agent_runs SET status = 'failed', error = 'Server restarted during run', finished_at = ? WHERE status = 'running'`)
    .run(new Date().toISOString()).changes;
}

export function getRun(id: string): AgentRun | undefined {
  const row = getDb().prepare('SELECT * FROM agent_runs WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToRun(row) : undefined;
}

export function listRuns(limit = 30): AgentRun[] {
  return (getDb().prepare('SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?').all(limit) as Row[]).map(rowToRun);
}

export function appendStep(step: Omit<AgentStep, 'id' | 'seq' | 'ts'>): AgentStep {
  const db = getDb();
  const { next } = db
    .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM agent_steps WHERE run_id = ?')
    .get(step.runId) as { next: number };
  const ts = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO agent_steps (run_id, seq, turn, type, tool_name, tool_use_id, content, data_json, is_error, duration_ms, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      step.runId,
      next,
      step.turn,
      step.type,
      step.toolName ?? null,
      step.toolUseId ?? null,
      step.content,
      step.data === undefined ? null : JSON.stringify(step.data),
      step.isError ? 1 : 0,
      step.durationMs ?? null,
      ts
    );
  return { ...step, id: Number(info.lastInsertRowid), seq: next, ts };
}

export function listSteps(runId: string): AgentStep[] {
  const rows = getDb().prepare('SELECT * FROM agent_steps WHERE run_id = ? ORDER BY seq').all(runId) as Row[];
  return rows.map((r) => ({
    id: r.id as number,
    runId: r.run_id as string,
    seq: r.seq as number,
    turn: r.turn as number,
    type: r.type as AgentStep['type'],
    toolName: (r.tool_name as string) || undefined,
    toolUseId: (r.tool_use_id as string) || undefined,
    content: r.content as string,
    data: r.data_json ? JSON.parse(r.data_json as string) : undefined,
    isError: Boolean(r.is_error),
    durationMs: (r.duration_ms as number) ?? undefined,
    ts: r.ts as string,
  }));
}

function rowToRun(r: Row): AgentRun {
  return {
    id: r.id as string,
    goal: r.goal as string,
    trigger: r.trigger as AgentTrigger,
    status: r.status as AgentRunStatus,
    model: r.model as string,
    turns: r.turns as number,
    toolCalls: r.tool_calls as number,
    inputTokens: r.input_tokens as number,
    outputTokens: r.output_tokens as number,
    cacheReadTokens: r.cache_read_tokens as number,
    costUsd: r.cost_usd as number,
    summary: (r.summary as string) || undefined,
    error: (r.error as string) || undefined,
    startedAt: r.started_at as string,
    finishedAt: (r.finished_at as string) || undefined,
  };
}
