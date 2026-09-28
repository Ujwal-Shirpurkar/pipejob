import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Coins,
  LoaderCircle,
  Play,
  Search,
  ShieldCheck,
  Square,
  Wrench,
} from 'lucide-react';
import { api } from '../api/client';
import { GradeBadge } from '../components/badges';
import Markdown from '../components/Markdown';
import { Button, Card, Chip, Empty, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { cx } from '../lib/styles';
import { ago, compact, duration, usd } from '../lib/format';
import type { AgentRun, AgentStep, Grade } from '../types/index';

const PRESETS = [
  'Find working-student or intern roles in agentic AI / LLM engineering in Germany or remote, evaluate the promising ones and shortlist the best 3 for me.',
  'Evaluate the jobs in my pipeline that have not been evaluated yet, skip clear mismatches and tell me which ones deserve my time.',
  'Check n8n, Parloa and Langdock specifically. Is there anything I should apply to? Prepare documents for the best match.',
];

const TOOL_LABEL: Record<string, string> = {
  get_candidate_profile: 'Read candidate profile',
  search_jobs: 'Search job boards',
  list_pipeline: 'List pipeline',
  get_job_details: 'Read job posting',
  import_job: 'Import job',
  evaluate_job: 'Evaluate job',
  tailor_application: 'Tailor CV & cover letter',
  shortlist_for_review: 'Shortlist for your review',
  skip_job: 'Skip job',
};

function RunStatus({ run }: { run: AgentRun }) {
  if (run.status === 'running') return <Chip tone="blue"><LoaderCircle className="size-3 animate-spin" /> Running</Chip>;
  if (run.status === 'completed') return <Chip tone="green"><CircleCheck className="size-3" /> Completed</Chip>;
  if (run.status === 'cancelled') return <Chip>Cancelled</Chip>;
  return <Chip tone="red"><CircleX className="size-3" /> Failed</Chip>;
}

function summarizeInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'search_jobs':
      return `${(input.keywords as string[] | undefined)?.join(', ') ?? ''}${input.location ? ` · ${input.location}` : ''}${input.remote_only ? ' · remote only' : ''}`;
    case 'shortlist_for_review':
    case 'skip_job':
      return String(input.note ?? input.reason ?? '');
    case 'import_job':
      return String(input.url ?? 'pasted text');
    case 'list_pipeline':
      return [input.status, input.min_grade && `grade ≥ ${input.min_grade}`].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

interface ToolPair {
  call: AgentStep;
  result?: AgentStep;
}

type TraceItem = { kind: 'step'; step: AgentStep } | { kind: 'tool'; pair: ToolPair };

function buildTrace(steps: AgentStep[]): TraceItem[] {
  const items: TraceItem[] = [];
  const pairs = new Map<string, ToolPair>();
  for (const step of steps) {
    if (step.type === 'tool_call' && step.toolUseId) {
      const pair = { call: step };
      pairs.set(step.toolUseId, pair);
      items.push({ kind: 'tool', pair });
    } else if (step.type === 'tool_result' && step.toolUseId && pairs.has(step.toolUseId)) {
      pairs.get(step.toolUseId)!.result = step;
    } else if (step.type !== 'final') {
      items.push({ kind: 'step', step });
    }
  }
  return items;
}

function ToolCard({ pair, jobNames }: { pair: ToolPair; jobNames: Map<string, string> }) {
  const [open, setOpen] = useState(false);
  const { call, result } = pair;
  const input = (call.data ?? {}) as Record<string, unknown>;
  const output = (result?.data ?? {}) as Record<string, unknown>;
  const jobId = (input.job_id as string) ?? (output.job_id as string);
  const jobName = jobId ? jobNames.get(jobId) : undefined;
  const summary = summarizeInput(call.toolName ?? '', input);

  let resultBadge: ReactNode = null;
  if (result && !result.isError) {
    if (call.toolName === 'evaluate_job' && output.grade) {
      resultBadge = (
        <span className="flex items-center gap-1.5">
          <GradeBadge grade={output.grade as Grade} size="sm" />
          <span className="text-xs text-slate-500">{String(output.recommendation ?? '')}{output.cached ? ' · cached' : ''}</span>
        </span>
      );
    } else if (call.toolName === 'search_jobs') {
      const results = (output.results as unknown[] | undefined) ?? [];
      resultBadge = <span className="text-xs text-slate-500">{results.length} matches of {compact(Number(output.scanned_postings ?? 0))} postings</span>;
    } else if (call.toolName === 'shortlist_for_review') {
      resultBadge = <Chip tone="green">Shortlisted</Chip>;
    } else if (call.toolName === 'tailor_application') {
      const warnings = (output.grounding_warnings as string[] | undefined) ?? [];
      resultBadge = <Chip tone={warnings.length ? 'amber' : 'green'}>{warnings.length ? `${warnings.length} grounding warning(s)` : 'Grounded'}</Chip>;
    }
  }

  return (
    <div className={cx('rounded-lg ring-1', result?.isError ? 'bg-red-50/40 ring-red-200' : 'bg-white ring-slate-200')}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <span className={cx('flex size-6 shrink-0 items-center justify-center rounded-md', result?.isError ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600')}>
          {call.toolName === 'search_jobs' ? <Search className="size-3.5" /> : call.toolName === 'shortlist_for_review' ? <ShieldCheck className="size-3.5" /> : <Wrench className="size-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="shrink-0 whitespace-nowrap font-medium text-slate-800">{TOOL_LABEL[call.toolName ?? ''] ?? call.toolName}</span>
            {jobName && <span className="truncate text-slate-500">{jobName}</span>}
          </div>
          {summary && <div className="truncate text-xs text-slate-500">{summary}</div>}
        </div>
        {!result ? <LoaderCircle className="size-4 animate-spin text-blue-500" /> : resultBadge}
        {result?.isError && <span className="text-xs font-medium text-red-600">error</span>}
        {result?.durationMs !== undefined && <span className="w-12 text-right text-[11px] tabular-nums text-slate-400">{(result.durationMs / 1000).toFixed(1)}s</span>}
        {open ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}
      </button>
      {open && (
        <div className="grid gap-2 border-t border-slate-100 p-3 text-xs md:grid-cols-2">
          <div>
            <div className="mb-1 font-medium text-slate-500">Input</div>
            <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-2 text-slate-700">{JSON.stringify(input, null, 2)}</pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-slate-500">Output</div>
            <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-2 text-slate-700">{result ? JSON.stringify(result.data ?? result.content, null, 2) : 'running…'}</pre>
          </div>
          {jobId && (
            <Link to={`/jobs/${jobId}`} className="text-blue-600 hover:underline md:col-span-2">
              Open job →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Thinking({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  const preview = step.content.length > 220 && !open ? step.content.slice(0, 220) + '…' : step.content;
  return (
    <div className="flex gap-3">
      <Brain className="mt-0.5 size-4 shrink-0 text-violet-400" />
      <button onClick={() => setOpen(!open)} className="whitespace-pre-wrap text-left text-sm italic text-slate-500 hover:text-slate-700">
        {preview}
      </button>
    </div>
  );
}

function RunView({ runId }: { runId: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['run', runId], queryFn: () => api.run(runId) });
  const cancel = useMutation({ mutationFn: () => api.cancelRun(runId) });
  const [, forceTick] = useState(0);

  // Tick the elapsed timer while running.
  useEffect(() => {
    if (data?.run.status !== 'running') return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [data?.run.status]);

  const trace = useMemo(() => buildTrace(data?.steps ?? []), [data?.steps]);
  const jobNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data?.steps ?? []) {
      const d = s.data as { results?: { job_id: string; title: string; company: string }[]; job_id?: string; title?: string; company?: string; jobs?: { job_id: string; title: string; company: string }[] } | undefined;
      for (const r of [...(d?.results ?? []), ...(d?.jobs ?? [])]) m.set(r.job_id, `${r.title} · ${r.company}`);
      if (d?.job_id && d.title) m.set(d.job_id, `${d.title} · ${d.company}`);
    }
    return m;
  }, [data?.steps]);

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNote error={error ?? 'Run not found'} />;
  const { run, steps } = data;
  const final = steps.find((s) => s.type === 'final');

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <RunStatus run={run} />
              <span className="text-xs text-slate-400">
                {run.trigger === 'autopilot' ? 'Autopilot' : run.trigger === 'webhook' ? 'Webhook' : 'You'} · {ago(run.startedAt)}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-800">{run.goal}</p>
          </div>
          {run.status === 'running' && (
            <Button variant="danger" size="sm" icon={<Square className="size-3.5" />} loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Stop
            </Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
          {[
            { icon: <Clock className="size-3.5" />, label: 'Duration', value: duration(run.startedAt, run.finishedAt) },
            { icon: <Bot className="size-3.5" />, label: 'Turns', value: run.turns },
            { icon: <Wrench className="size-3.5" />, label: 'Tool calls', value: run.toolCalls },
            { icon: <Brain className="size-3.5" />, label: 'Tokens in / out', value: `${compact(run.inputTokens + run.cacheReadTokens)} / ${compact(run.outputTokens)}` },
            { icon: <Coins className="size-3.5" />, label: 'Agent cost', value: usd(run.costUsd) },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-1 text-slate-500">{m.icon}{m.label}</div>
              <div className="mt-0.5 font-semibold tabular-nums text-slate-800">{m.value}</div>
            </div>
          ))}
        </div>
        {run.cacheReadTokens > 0 && (
          <p className="mt-2 text-[11px] text-slate-400">
            {Math.round((run.cacheReadTokens / Math.max(1, run.inputTokens + run.cacheReadTokens)) * 100)}% of input tokens served from the prompt cache. Evaluation and tailoring calls are billed separately (see Overview).
          </p>
        )}
      </Card>

      {final && (
        <Card title="Agent report">
          <Markdown>{final.content}</Markdown>
          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
            <Link to="/review"><Button size="sm" icon={<ShieldCheck className="size-3.5" />}>Open review queue</Button></Link>
            <Link to="/pipeline"><Button size="sm" variant="secondary">View pipeline</Button></Link>
          </div>
        </Card>
      )}
      {run.status === 'failed' && run.error && <ErrorNote error={run.error} />}

      <Card title="Trace" action={<span className="text-xs text-slate-400">{steps.length} steps</span>}>
        {trace.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Planning…</div>
        ) : (
          <div className="space-y-2.5">
            {trace.map((item) =>
              item.kind === 'tool' ? (
                <ToolCard key={item.pair.call.id} pair={item.pair} jobNames={jobNames} />
              ) : item.step.type === 'thinking' ? (
                <Thinking key={item.step.id} step={item.step} />
              ) : item.step.type === 'error' ? (
                <ErrorNote key={item.step.id} error={item.step.content} />
              ) : (
                <div key={item.step.id} className="flex gap-3 text-sm text-slate-700">
                  <Bot className="mt-0.5 size-4 shrink-0 text-blue-500" />
                  <p className="whitespace-pre-wrap">{item.step.content}</p>
                </div>
              )
            )}
            {run.status === 'running' && trace.length > 0 && (
              <div className="flex items-center gap-2 pl-1 text-xs text-slate-400"><LoaderCircle className="size-3.5 animate-spin" /> Working…</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Agent() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState(PRESETS[0]);
  const { data: runs = [] } = useQuery({ queryKey: ['runs'], queryFn: api.runs });
  const { data: system } = useQuery({ queryKey: ['system'], queryFn: api.system, staleTime: 60_000 });
  const active = runs.find((r) => r.status === 'running');

  const start = useMutation({
    mutationFn: () => api.startRun(goal),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      navigate(`/agent/${run.id}`);
    },
  });

  const selected = runId ?? runs[0]?.id;

  return (
    <div>
      <PageHeader
        title="Agent"
        subtitle="Give the agent a goal. It searches official job boards, evaluates roles, prepares documents and shortlists — you make every application decision."
      />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <Card title="New run">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg p-3 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex flex-col gap-1">
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => setGoal(p)} className="truncate rounded-md px-2 py-1 text-left text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-800" title={p}>
                  ↳ {p}
                </button>
              ))}
            </div>
            <Button
              className="mt-3 w-full"
              icon={<Play className="size-4" />}
              loading={start.isPending}
              disabled={!system?.llmConfigured || Boolean(active) || goal.trim().length < 5}
              onClick={() => start.mutate()}
            >
              {active ? 'A run is in progress' : 'Run agent'}
            </Button>
            {system && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Guardrails: ≤{system.agentLimits.maxTurns} turns · ≤{system.agentLimits.maxEvaluations} evaluations · ≤{system.agentLimits.maxTailored} tailored applications per run. The agent has no tool to apply or contact anyone.
              </p>
            )}
            <div className="mt-2"><ErrorNote error={start.error} /></div>
          </Card>

          <Card title="History" padded={false}>
            {runs.length === 0 ? (
              <Empty title="No runs yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link to={`/agent/${r.id}`} className={cx('block px-4 py-3 hover:bg-slate-50', selected === r.id && 'bg-blue-50/60')}>
                      <div className="flex items-center justify-between gap-2">
                        <RunStatus run={r} />
                        <span className="text-[11px] text-slate-400">{ago(r.startedAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{r.goal}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{r.toolCalls} tool calls · {usd(r.costUsd)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          {selected ? (
            <RunView key={selected} runId={selected} />
          ) : (
            <Card>
              <Empty icon={<Bot className="size-10" />} title="Start your first run">
                The trace shows every reasoning step and tool call as it happens — useful for understanding and debugging what the agent does.
              </Empty>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
