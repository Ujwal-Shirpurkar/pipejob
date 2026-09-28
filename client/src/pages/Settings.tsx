import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX } from 'lucide-react';
import { api } from '../api/client';
import { Card, Chip, PageHeader, Spinner } from '../components/ui';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-800">{children}</span>
    </div>
  );
}

function Flag({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {ok ? <CircleCheck className="size-4 text-emerald-600" /> : <CircleX className="size-4 text-slate-400" />}
      {children}
    </span>
  );
}

const ATS_URL = { greenhouse: 'https://boards.greenhouse.io/', lever: 'https://jobs.lever.co/', ashby: 'https://jobs.ashbyhq.com/' };

export default function Settings() {
  const { data: s } = useQuery({ queryKey: ['system'], queryFn: api.system });
  if (!s) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configured in server/.env, preferences.json and portals.json." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="AI">
          <Row label="Anthropic API key"><Flag ok={s.llmConfigured}>{s.llmConfigured ? 'Configured' : 'Missing'}</Flag></Row>
          <Row label="Model"><code className="text-xs">{s.model}</code></Row>
          <Row label="Agent effort / evaluation effort">{s.agentEffort} / {s.evalEffort}</Row>
          <Row label="Per-run limits">{s.agentLimits.maxTurns} turns · {s.agentLimits.maxEvaluations} evaluations · {s.agentLimits.maxTailored} tailored</Row>
        </Card>
        <Card title="Automation & safety">
          <Row label="Autopilot schedule">{s.autopilotCron ? <code className="text-xs">{s.autopilotCron}</code> : 'Off'}</Row>
          <Row label="Telegram notifications"><Flag ok={s.notificationsConfigured}>{s.notificationsConfigured ? 'On' : 'Off'}</Flag></Row>
          <Row label="Daily application budget">{s.limits.maxApplicationsPerDay}</Row>
          <Row label="Automatic submission"><Flag ok={false}>Never — by design</Flag></Row>
        </Card>
        <Card title={`Company portals (${s.portals.length})`} className="lg:col-span-2">
          <p className="mb-3 text-xs text-slate-500">
            Scanned through each company’s official public job-board API (Greenhouse, Lever, Ashby) plus the Arbeitnow board. No scraping, no bot-detection evasion. Edit <code>portals.json</code> to add companies.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {s.portals.map((p) => (
              <a key={`${p.ats}:${p.slug}`} href={`${ATS_URL[p.ats]}${p.slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-slate-200 hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-800">{p.name}</span>
                <Chip>{p.ats}</Chip>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
