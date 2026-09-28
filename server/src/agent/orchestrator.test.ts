import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { closeDb, initDb } from '../db/database';
import { getApplication, insertApplication } from '../db/applications';
import { getRun, listSteps } from '../db/agentRuns';
import { config } from '../config';

type Request = Anthropic.Beta.MessageCreateParamsNonStreaming;
type Block = Anthropic.Beta.BetaContentBlock;

// A scripted stand-in for the Messages API: each call returns the next scripted turn.
const requests: Request[] = [];
let script: ((req: Request, n: number) => { content: unknown[]; stop_reason: string }) | null = null;

vi.mock('../llm/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/client')>();
  return {
    ...actual,
    getClient: () => ({
      beta: {
        messages: {
          create: async (req: Request) => {
            // Snapshot: the loop keeps mutating its messages array after the call.
            requests.push(structuredClone(req));
            const turn = script!(req, requests.length);
            return {
              id: `msg_${requests.length}`,
              model: req.model,
              content: turn.content as Block[],
              stop_reason: turn.stop_reason,
              stop_details: null,
              usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
            };
          },
        },
      },
    }),
  };
});

const { startAgentRun } = await import('./orchestrator');

const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input });
const text = (t: string) => ({ type: 'text', text: t });

async function waitForRun(id: string) {
  for (let i = 0; i < 200; i++) {
    const run = getRun(id);
    if (run && run.status !== 'running') return run;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('run did not finish');
}

beforeEach(() => {
  requests.length = 0;
  initDb(':memory:');
  insertApplication({
    id: 'job-1',
    title: 'Staff Engineer',
    company: 'Acme',
    location: 'Berlin',
    url: 'https://example.com/1',
    source: 'ashby',
    rawJD: 'Requires 10 years of experience',
    discoveredAt: new Date().toISOString(),
    status: 'discovered',
  });
});
afterEach(() => closeDb());

describe('agent loop', () => {
  it('runs tools, returns parallel results in one message and finishes with a report', async () => {
    script = (_req, n) => {
      if (n === 1)
        return {
          stop_reason: 'tool_use',
          content: [
            { type: 'thinking', thinking: 'I should read the profile and the pipeline first.', signature: 'sig' },
            toolUse('t1', 'get_candidate_profile', {}),
            toolUse('t2', 'list_pipeline', { status: 'discovered' }),
          ],
        };
      if (n === 2) return { stop_reason: 'tool_use', content: [toolUse('t3', 'skip_job', { job_id: 'job-1', reason: 'Staff level, far too senior' })] };
      return { stop_reason: 'end_turn', content: [text('## Summary\nSkipped one senior role.')] };
    };

    const run = await waitForRun(startAgentRun('Clean up my pipeline').id);

    expect(run.status).toBe('completed');
    expect(run.summary).toContain('Skipped one senior role');
    expect(run.turns).toBe(3);
    expect(run.toolCalls).toBe(3);
    expect(run.cacheReadTokens).toBe(2700);

    // Both tool results from turn 1 go back together, in order, in a single user message.
    const secondTurnMessages = requests[1].messages;
    const toolResultMsg = secondTurnMessages.at(-1)!;
    expect(toolResultMsg.role).toBe('user');
    const results = toolResultMsg.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results.map((r) => r.tool_use_id)).toEqual(['t1', 't2']);
    // The assistant turn (including its thinking block) is replayed unchanged.
    expect((secondTurnMessages.at(-2)!.content as Block[])[0].type).toBe('thinking');

    // The tool actually ran against the database.
    expect(getApplication('job-1')!.job.status).toBe('skipped');
    expect(getApplication('job-1')!.statusHistory.at(-1)!.actor).toBe('agent');

    const types = listSteps(run.id).map((s) => s.type);
    expect(types).toEqual(['thinking', 'tool_call', 'tool_call', 'tool_result', 'tool_result', 'tool_call', 'tool_result', 'final']);
  });

  it('feeds tool errors back to the model instead of crashing', async () => {
    script = (_req, n) =>
      n === 1
        ? { stop_reason: 'tool_use', content: [toolUse('t1', 'get_job_details', { job_id: 'does-not-exist' })] }
        : { stop_reason: 'end_turn', content: [text('Could not find that job.')] };

    const run = await waitForRun(startAgentRun('Look at a job').id);
    expect(run.status).toBe('completed');
    const result = (requests[1].messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(result.is_error).toBe(true);
  });

  it('forces a final report when the turn budget runs out', async () => {
    const maxTurns = config.agentLimits.maxTurns;
    script = (req) =>
      req.tool_choice?.type === 'none'
        ? { stop_reason: 'end_turn', content: [text('Out of budget — here is what I found.')] }
        : { stop_reason: 'tool_use', content: [toolUse(`t${requests.length}`, 'list_pipeline', {})] };

    const run = await waitForRun(startAgentRun('Loop forever').id);
    expect(run.status).toBe('completed');
    expect(run.turns).toBe(maxTurns);
    expect(requests.at(-1)!.tool_choice).toEqual({ type: 'none' });
    const wrapUp = requests.at(-1)!.messages.at(-1)!.content as { type: string; text?: string }[];
    expect(wrapUp.some((b) => b.type === 'text' && b.text?.includes('write your final report'))).toBe(true);
  });

  it('marks the run failed on a refusal', async () => {
    script = () => ({ stop_reason: 'refusal', content: [] });
    const run = await waitForRun(startAgentRun('Something').id);
    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/declined/);
  });
});
