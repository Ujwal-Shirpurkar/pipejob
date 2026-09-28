import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { appendStep, createRun, finishRun, getRun, updateRunProgress } from '../db/agentRuns';
import { emitEvent } from '../events';
import { fallbackParams, getClient, trackUsage } from '../llm/client';
import logger from '../logger';
import type { AgentRun, AgentStep, AgentTrigger } from '../types/index';
import { AGENT_SYSTEM_PROMPT } from './prompts';
import { executeTool, toolDefinitions, type ToolContext } from './tools';

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.BetaContentBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

const active = new Map<string, AbortController>();

// Several evaluate_job calls may arrive in one turn; run them concurrently but bounded.
const TOOL_CONCURRENCY = 3;

export function isRunActive(): boolean {
  return active.size > 0;
}

export function cancelRun(id: string): boolean {
  const controller = active.get(id);
  if (!controller) return false;
  controller.abort();
  return true;
}

function step(runId: string, turn: number, s: Omit<AgentStep, 'id' | 'seq' | 'ts' | 'runId' | 'turn'>): AgentStep {
  const saved = appendStep({ runId, turn, ...s });
  emitEvent({ type: 'agent_step', runId, step: saved });
  return saved;
}

function publishRun(id: string): void {
  const run = getRun(id);
  if (run) emitEvent({ type: 'agent_run', run });
}

/** Starts an agent run in the background and returns immediately; progress streams over SSE. */
export function startAgentRun(goal: string, trigger: AgentTrigger = 'user'): AgentRun {
  getClient(); // throws LlmNotConfiguredError early, before a run record exists
  const run = createRun({ id: randomUUID(), goal, trigger, model: config.model });
  const controller = new AbortController();
  active.set(run.id, controller);
  publishRun(run.id);

  runLoop(run, controller.signal)
    .catch((err) => logger.error({ action: 'agent_run_crash', runId: run.id, error: String(err) }))
    .finally(() => {
      active.delete(run.id);
      publishRun(run.id);
    });

  return run;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

function truncateForModel(value: unknown, max = 12_000): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? text.slice(0, max) + '…[truncated]' : text;
}

async function runLoop(run: AgentRun, signal: AbortSignal): Promise<void> {
  const client = getClient();
  const model = config.model;
  const { maxTurns, maxEvaluations, maxTailored } = config.agentLimits;
  const tools = toolDefinitions();
  const ctx: ToolContext = {
    runId: run.id,
    signal,
    counters: { evaluations: 0, tailored: 0 },
    limits: { maxEvaluations, maxTailored },
  };

  const today = new Date().toISOString().slice(0, 10);
  const messages: BetaMessageParam[] = [
    {
      role: 'user',
      content: `Today is ${today}. Budgets for this run: ${maxTurns} turns, ${maxEvaluations} evaluations, ${maxTailored} tailored applications.\n\nGoal: ${run.goal}`,
    },
  ];

  let finalText = '';

  try {
    for (let turn = 1; turn <= maxTurns; turn++) {
      const lastTurn = turn === maxTurns;
      const started = Date.now();

      const response = await client.beta.messages.create(
        {
          model,
          max_tokens: 16000,
          thinking: { type: 'adaptive', display: 'summarized' },
          output_config: { effort: config.agentEffort },
          system: [{ type: 'text', text: AGENT_SYSTEM_PROMPT }],
          tools,
          // On the final turn the model must stop calling tools and write its report.
          tool_choice: lastTurn ? { type: 'none' } : { type: 'auto' },
          messages,
          // Auto-caching: the growing conversation prefix is re-read from cache every turn.
          cache_control: { type: 'ephemeral' },
          ...fallbackParams(model),
        },
        { signal }
      );

      const latencyMs = Date.now() - started;
      const costUsd = trackUsage('agent', model, response.usage, { runId: run.id, latencyMs, stopReason: response.stop_reason });
      updateRunProgress(run.id, {
        turns: 1,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        costUsd,
      });

      // Record what the model did this turn, in order.
      const toolUses: Anthropic.Beta.BetaToolUseBlock[] = [];
      const texts: string[] = [];
      for (const block of response.content as BetaContentBlock[]) {
        if (block.type === 'thinking' && block.thinking.trim()) {
          step(run.id, turn, { type: 'thinking', content: block.thinking });
        } else if (block.type === 'text' && block.text.trim()) {
          texts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolUses.push(block);
        }
      }
      if (toolUses.length && texts.length) step(run.id, turn, { type: 'text', content: texts.join('\n\n') });

      // Append the full assistant content (including thinking blocks) unchanged.
      messages.push({ role: 'assistant', content: response.content });
      publishRun(run.id);

      if (response.stop_reason === 'refusal') {
        throw new Error(`Model declined to continue${response.stop_details?.category ? ` (${response.stop_details.category})` : ''}`);
      }
      if (response.stop_reason === 'pause_turn') continue;

      if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
        finalText = texts.join('\n\n').trim();
        break;
      }

      for (const t of toolUses) {
        step(run.id, turn, { type: 'tool_call', toolName: t.name, toolUseId: t.id, content: JSON.stringify(t.input), data: t.input });
      }
      updateRunProgress(run.id, { toolCalls: toolUses.length });

      const results = await mapLimit(toolUses, TOOL_CONCURRENCY, async (t) => {
        const t0 = Date.now();
        const { output, isError } = await executeTool(t.name, t.input, ctx);
        const durationMs = Date.now() - t0;
        step(run.id, turn, {
          type: 'tool_result',
          toolName: t.name,
          toolUseId: t.id,
          content: truncateForModel(output, 4000),
          data: output,
          isError,
          durationMs,
        });
        const result: ToolResult = { type: 'tool_result', tool_use_id: t.id, content: truncateForModel(output), is_error: isError };
        return result;
      });

      // All tool results go back in a single user message (keeps parallel tool use working).
      const content: Anthropic.Beta.BetaContentBlockParam[] = [...results];
      if (turn === maxTurns - 1) {
        content.push({ type: 'text', text: 'Turn budget nearly exhausted: do not call more tools; write your final report now.' });
      }
      messages.push({ role: 'user', content });
      publishRun(run.id);
    }

    if (!finalText) finalText = '_The agent stopped without a final report (turn budget exhausted)._';
    step(run.id, getRun(run.id)?.turns ?? 0, { type: 'final', content: finalText });
    finishRun(run.id, 'completed', { summary: finalText });
    logger.info({ action: 'agent_run_done', runId: run.id });
  } catch (err) {
    const cancelled = signal.aborted || err instanceof Anthropic.APIUserAbortError;
    const message = cancelled ? 'Cancelled by user' : err instanceof Error ? err.message : String(err);
    step(run.id, getRun(run.id)?.turns ?? 0, { type: 'error', content: message, isError: true });
    finishRun(run.id, cancelled ? 'cancelled' : 'failed', { error: message });
    logger[cancelled ? 'info' : 'error']({ action: 'agent_run_end', runId: run.id, status: cancelled ? 'cancelled' : 'failed', error: message });
  }
}
