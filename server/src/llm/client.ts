import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { config, isLlmConfigured } from '../config';
import { recordLlmCall } from '../db/llmCalls';
import logger from '../logger';
import type { Effort } from '../types/config';
import type { LlmPurpose } from '../types/index';

export class LlmNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set. Add it to server/.env to enable AI features.');
    this.name = 'LlmNotConfiguredError';
  }
}

export class LlmRefusalError extends Error {
  constructor(category?: string | null) {
    super(`The model declined this request${category ? ` (${category})` : ''}.`);
    this.name = 'LlmRefusalError';
  }
}

let client: Anthropic | undefined;

export function getClient(): Anthropic {
  if (!isLlmConfigured()) throw new LlmNotConfiguredError();
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 3 });
  return client;
}

// USD per million tokens (input, output). Cache reads bill at 10% of input, cache writes at 125%.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function estimateCostUsd(model: string, usage: UsageLike): number {
  const price = PRICING[model] ?? PRICING['claude-opus-5'];
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cost =
    usage.input_tokens * price.input +
    cacheRead * price.input * 0.1 +
    cacheWrite * price.input * 1.25 +
    usage.output_tokens * price.output;
  return cost / 1_000_000;
}

// Server-side refusal fallbacks are supported on the newest models; route by refusal category.
const FALLBACK_MODELS = new Set(['claude-opus-5', 'claude-opus-5-5', 'claude-fable-5-1']);

export function fallbackParams(model: string): { betas?: string[]; fallbacks?: 'default' } {
  return FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};
}

export function trackUsage(
  purpose: LlmPurpose,
  model: string,
  usage: UsageLike,
  meta: { jobId?: string; runId?: string; latencyMs: number; stopReason?: string | null }
): number {
  const costUsd = estimateCostUsd(model, usage);
  recordLlmCall({
    purpose,
    model,
    jobId: meta.jobId,
    runId: meta.runId,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    costUsd,
    latencyMs: meta.latencyMs,
    stopReason: meta.stopReason,
  });
  return costUsd;
}

export interface StructuredCallOptions<S extends z.ZodType> {
  purpose: LlmPurpose;
  schema: S;
  system: string;
  user: string;
  effort?: Effort;
  maxTokens?: number;
  jobId?: string;
  runId?: string;
  signal?: AbortSignal;
}

/**
 * One schema-constrained Claude call. Structured outputs guarantee the JSON shape, and the
 * SDK validates it against the Zod schema, so callers receive a typed object — no regex
 * stripping of markdown fences or hand-rolled JSON.parse.
 */
export async function structuredCall<S extends z.ZodType>(
  opts: StructuredCallOptions<S>
): Promise<{ data: z.infer<S>; costUsd: number }> {
  const anthropic = getClient();
  const model = config.model;
  const started = Date.now();

  const response = await anthropic.beta.messages.parse(
    {
      model,
      max_tokens: opts.maxTokens ?? 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: opts.effort ?? config.evalEffort, format: betaZodOutputFormat(opts.schema) },
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: opts.user }],
      ...fallbackParams(model),
    },
    { signal: opts.signal }
  );

  const latencyMs = Date.now() - started;
  const costUsd = trackUsage(opts.purpose, model, response.usage, {
    jobId: opts.jobId,
    runId: opts.runId,
    latencyMs,
    stopReason: response.stop_reason,
  });

  logger.info({
    action: 'llm_call',
    purpose: opts.purpose,
    model: response.model,
    jobId: opts.jobId,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheRead: response.usage.cache_read_input_tokens,
    latencyMs,
    stopReason: response.stop_reason,
  });

  if (response.stop_reason === 'refusal') throw new LlmRefusalError(response.stop_details?.category);
  if (response.stop_reason === 'max_tokens') throw new Error(`${opts.purpose}: response truncated at max_tokens`);
  if (!response.parsed_output) throw new Error(`${opts.purpose}: model returned no parseable output`);

  return { data: response.parsed_output as z.infer<S>, costUsd };
}
