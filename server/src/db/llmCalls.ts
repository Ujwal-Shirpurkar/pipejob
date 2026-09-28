import { getDb } from './database';
import type { LlmCallRecord } from '../types/index';

export function recordLlmCall(call: LlmCallRecord): void {
  getDb()
    .prepare(
      `INSERT INTO llm_calls (purpose, model, job_id, run_id, input_tokens, output_tokens, cache_read_tokens,
        cache_write_tokens, cost_usd, latency_ms, stop_reason, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      call.purpose,
      call.model,
      call.jobId ?? null,
      call.runId ?? null,
      call.inputTokens,
      call.outputTokens,
      call.cacheReadTokens,
      call.cacheWriteTokens,
      call.costUsd,
      call.latencyMs,
      call.stopReason ?? null,
      new Date().toISOString()
    );
}

export interface LlmUsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  byPurpose: { purpose: string; calls: number; costUsd: number; avgLatencyMs: number }[];
}

export function summarizeLlmUsage(sinceIso?: string): LlmUsageSummary {
  const db = getDb();
  const where = sinceIso ? 'WHERE ts >= ?' : '';
  const params = sinceIso ? [sinceIso] : [];
  const total = db
    .prepare(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS inputTokens, COALESCE(SUM(output_tokens),0) AS outputTokens,
        COALESCE(SUM(cache_read_tokens),0) AS cacheReadTokens, COALESCE(SUM(cost_usd),0) AS costUsd,
        COALESCE(AVG(latency_ms),0) AS avgLatencyMs
       FROM llm_calls ${where}`
    )
    .get(...params) as Omit<LlmUsageSummary, 'byPurpose'>;
  const byPurpose = db
    .prepare(
      `SELECT purpose, COUNT(*) AS calls, COALESCE(SUM(cost_usd),0) AS costUsd, COALESCE(AVG(latency_ms),0) AS avgLatencyMs
       FROM llm_calls ${where} GROUP BY purpose ORDER BY costUsd DESC`
    )
    .all(...params) as LlmUsageSummary['byPurpose'];
  return { ...total, byPurpose };
}
