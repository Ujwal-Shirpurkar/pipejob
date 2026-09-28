import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, Briefcase, Coins, Inbox, MessageSquareQuote, Play, Send } from 'lucide-react';
import { api } from '../api/client';
import { HBarChart, Meter, StatTile } from '../components/charts';
import { Button, Card, Empty, PageHeader, Spinner } from '../components/ui';
import { useEvents } from '../lib/events';
import { GRADE_ORDER, ago, compact, usd } from '../lib/format';

const PURPOSE_LABEL: Record<string, string> = { agent: 'Agent reasoning', evaluate: 'Evaluations', tailor: 'Tailoring', extract: 'Page extraction' };

export default function Overview() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  const { jobEvents } = useEvents();
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs', 'all-lite'], queryFn: () => api.jobs() });
  const names = new Map(jobs.map((j) => [j.id, `${j.job.title} · ${j.job.company}`]));

  if (isLoading || !stats) return <Spinner />;
  const interviews = (stats.byStatus.interview ?? 0) + (stats.byStatus.offer ?? 0);
  const applied = stats.funnel.find((f) => f.stage === 'Applied')?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Your job search at a glance."
        actions={<Link to="/agent"><Button icon={<Play className="size-4" />}>Run agent</Button></Link>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link to="/review"><StatTile accent label="Awaiting your review" value={stats.reviewQueue} sub="shortlisted by the agent" icon={<Inbox className="size-4" />} /></Link>
        <StatTile label="Jobs tracked" value={stats.total} sub={`${stats.funnel[1]?.count ?? 0} evaluated`} icon={<Briefcase className="size-4 text-slate-400" />} />
        <StatTile label="Applications sent" value={applied} sub={`${interviews} interview${interviews === 1 ? '' : 's'}`} icon={<Send className="size-4 text-slate-400" />} />
        <StatTile label="AI spend · 7 days" value={usd(stats.llm.last7Days.costUsd)} sub={`${stats.llm.last7Days.calls} Claude calls`} icon={<Coins className="size-4 text-slate-400" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Funnel" className="lg:col-span-2">
          <HBarChart caption="Jobs reaching each stage" labelWidth="8rem" data={stats.funnel.map((f) => ({ label: f.stage, value: f.count, hint: `${f.count} job(s) reached this stage` }))} />
        </Card>
        <Card title="Grade distribution">
          {GRADE_ORDER.every((g) => !stats.byGrade[g]) ? (
            <Empty title="No evaluations yet" />
          ) : (
            <HBarChart
              caption="Evaluated jobs per grade"
              labelWidth="4.5rem"
              data={GRADE_ORDER.map((g) => ({ label: `Grade ${g}`, value: stats.byGrade[g] ?? 0, hint: { A: 'Excellent fit — apply', B: 'Strong fit', C: 'Plausible with gaps', D: 'Weak fit', F: 'Not a fit' }[g] }))}
            />
          )}
          {stats.averageScore !== null && <p className="mt-3 text-xs text-slate-500">Average weighted score {stats.averageScore.toFixed(2)} / 5</p>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Recent agent runs" padded={false} className="lg:col-span-2">
          {stats.recentRuns.length === 0 ? (
            <Empty icon={<Bot className="size-8" />} title="No agent runs yet">Start one from the Agent page.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentRuns.map((r) => (
                <li key={r.id}>
                  <Link to={`/agent/${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                    <Bot className="size-4 shrink-0 text-slate-400" />
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.goal}</p>
                    <span className="text-xs capitalize text-slate-500">{r.status}</span>
                    <span className="w-16 text-right text-xs tabular-nums text-slate-500">{usd(r.costUsd)}</span>
                    <span className="w-24 text-right text-xs text-slate-400">{ago(r.startedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Guardrails">
            <Meter value={stats.budget.used} max={stats.budget.limit} label="Applications, last 24 h" />
            <div className="mt-4 space-y-1.5 text-xs text-slate-600">
              <p>All-time AI spend <strong className="tabular-nums">{usd(stats.llm.allTime.costUsd)}</strong> over {stats.llm.allTime.calls} calls</p>
              {stats.llm.allTime.calls > 0 && (
                <p>
                  {compact(stats.llm.allTime.cacheReadTokens)} tokens from prompt cache ·{' '}
                  {(stats.llm.allTime.avgLatencyMs / 1000).toFixed(1)}s avg latency
                </p>
              )}
              {stats.llm.allTime.byPurpose.map((p) => (
                <p key={p.purpose} className="flex justify-between text-slate-500">
                  <span>{PURPOSE_LABEL[p.purpose] ?? p.purpose} ({p.calls})</span>
                  <span className="tabular-nums">{usd(p.costUsd)}</span>
                </p>
              ))}
            </div>
          </Card>

          <Card title="Live activity" padded={false}>
            {jobEvents.length === 0 ? (
              <p className="px-5 py-4 text-xs text-slate-400">Events appear here as the agent works.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
                {jobEvents.map((e, i) => (
                  <li key={i} className="px-5 py-2 text-xs">
                    <span className="font-medium capitalize text-slate-700">{e.status.replace('_', ' ')}</span>{' '}
                    <Link to={`/jobs/${e.jobId}`} className="text-slate-500 hover:text-blue-600">{names.get(e.jobId) ?? e.message ?? ''}</Link>
                    <span className="float-right text-slate-400">{ago(e.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <MessageSquareQuote className="size-3.5" /> Interview stories accumulate in the <Link to="/stories" className="text-blue-600 hover:underline">story bank</Link> as jobs are evaluated.
      </p>
    </div>
  );
}
