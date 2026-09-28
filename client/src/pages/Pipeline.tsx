import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, Flag, LayoutList, Plus, Radar, Search } from 'lucide-react';
import { api } from '../api/client';
import AddJobDialog from '../components/AddJobDialog';
import { GradeBadge, StatusBadge } from '../components/badges';
import { Button, Card, Chip, Empty, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { cx, inputCls } from '../lib/styles';
import { GRADE_ORDER, PIPELINE_COLUMNS, STATUS_LABEL, ago } from '../lib/format';
import type { Grade, JobApplication } from '../types/index';

function JobCard({ app }: { app: JobApplication }) {
  return (
    <Link to={`/jobs/${app.id}`} className="block rounded-lg bg-white p-3 ring-1 ring-slate-200 transition hover:shadow-sm hover:ring-blue-300">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium text-slate-800">{app.job.title}</p>
        <GradeBadge grade={app.grade} size="sm" />
      </div>
      <p className="mt-1 truncate text-xs text-slate-500">{app.job.company}{app.job.location ? ` · ${app.job.location}` : ''}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {app.reviewRequested && <Chip tone="violet"><Flag className="size-3" /> Review</Chip>}
        <span className="text-[11px] text-slate-400"><span className="capitalize">{app.job.source}</span> · {ago(app.job.discoveredAt)}</span>
      </div>
    </Link>
  );
}

function ScanPanel() {
  const queryClient = useQueryClient();
  const { data: prefs } = useQuery({ queryKey: ['preferences'], queryFn: api.preferences });
  const [keywords, setKeywords] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const kw = keywords ?? prefs?.search.keywords.join(', ') ?? '';
  const loc = location ?? prefs?.search.location ?? '';

  const scan = useMutation({
    mutationFn: () => api.searchJobs({ keywords: kw.split(',').map((k) => k.trim()).filter(Boolean), location: loc || undefined, limit: 25 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">Keywords (comma-separated)</span>
          <input className={inputCls} value={kw} onChange={(e) => setKeywords(e.target.value)} />
        </label>
        <label className="w-56">
          <span className="mb-1 block text-xs font-medium text-slate-600">Location</span>
          <input className={inputCls} value={loc} onChange={(e) => setLocation(e.target.value)} placeholder="Germany, Remote" />
        </label>
        <Button icon={<Radar className="size-4" />} loading={scan.isPending} onClick={() => scan.mutate()} disabled={!kw.trim()}>
          Scan portals
        </Button>
      </div>
      {scan.data && (
        <p className="mt-3 text-sm text-slate-600">
          Scanned <strong>{scan.data.scanned.toLocaleString()}</strong> postings from {scan.data.sourcesQueried} sources — <strong>{scan.data.newCount}</strong> new, {scan.data.results.length - scan.data.newCount} already tracked.
          {scan.data.sourceErrors.length > 0 && <span className="text-amber-700"> {scan.data.sourceErrors.length} source(s) unavailable.</span>}
          <span className="text-slate-400"> Keyword matching is a cheap prefilter — the agent does the actual judgement.</span>
        </p>
      )}
      <div className="mt-2"><ErrorNote error={scan.error} /></div>
    </Card>
  );
}

export default function Pipeline() {
  const [view, setView] = useState<'board' | 'table'>('board');
  const [search, setSearch] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', 'all', search, grades],
    queryFn: () => api.jobs({ search: search || undefined, grade: grades, sort: 'score' }),
    placeholderData: (prev) => prev,
  });

  const closed = jobs.filter((j) => ['rejected', 'skipped', 'error'].includes(j.job.status));

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={`${jobs.length} jobs tracked`}
        actions={
          <>
            <Button variant="secondary" icon={<Search className="size-4" />} onClick={() => setShowScan(!showScan)}>Scan portals</Button>
            <Button icon={<Plus className="size-4" />} onClick={() => setShowAdd(true)}>Add job</Button>
          </>
        }
      />
      {showScan && <div className="mb-4"><ScanPanel /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={cx(inputCls, 'max-w-xs')} placeholder="Filter by title, company, location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1">
          {GRADE_ORDER.map((g) => (
            <button
              key={g}
              onClick={() => setGrades(grades.includes(g) ? grades.filter((x) => x !== g) : [...grades, g])}
              className={cx('size-8 rounded-lg text-xs font-semibold ring-1 ring-inset', grades.includes(g) ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50')}
              aria-pressed={grades.includes(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="ml-auto flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
          <button onClick={() => setView('board')} className={cx('rounded-md p-1.5', view === 'board' ? 'bg-slate-100 text-slate-900' : 'text-slate-400')} aria-label="Board view"><Columns3 className="size-4" /></button>
          <button onClick={() => setView('table')} className={cx('rounded-md p-1.5', view === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400')} aria-label="Table view"><LayoutList className="size-4" /></button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <Card><Empty title="No jobs yet">Scan the portals, add a job by URL, or let the agent do the research.</Empty></Card>
      ) : view === 'board' ? (
        <div className="grid auto-cols-[17rem] grid-flow-col gap-3 overflow-x-auto pb-4">
          {[...PIPELINE_COLUMNS, 'closed' as const].map((col) => {
            const items = col === 'closed' ? closed : jobs.filter((j) => j.job.status === col);
            return (
              <div key={col} className="flex flex-col rounded-xl bg-slate-100/70 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{col === 'closed' ? 'Closed' : STATUS_LABEL[col]}</span>
                  <span className="text-xs tabular-nums text-slate-400">{items.length}</span>
                </div>
                <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                  {items.map((app) => <JobCard key={app.id} app={app} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card padded={false}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                {['Grade', 'Role', 'Company', 'Location', 'Status', 'Source', 'Found'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {jobs.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5"><GradeBadge grade={app.grade} size="sm" /></td>
                  <td className="max-w-xs px-4 py-2.5"><Link to={`/jobs/${app.id}`} className="font-medium text-slate-800 hover:text-blue-700">{app.job.title}</Link></td>
                  <td className="px-4 py-2.5 text-slate-600">{app.job.company}</td>
                  <td className="max-w-40 truncate px-4 py-2.5 text-slate-500">{app.job.location}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={app.job.status} /></td>
                  <td className="px-4 py-2.5 capitalize text-slate-500">{app.job.source}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{ago(app.job.discoveredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showAdd && <AddJobDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}
