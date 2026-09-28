import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Bot,
  CircleCheck,
  Download,
  ExternalLink,
  FileText,
  Flag,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { ActorIcon, GradeBadge, RecommendationBadge, StatusBadge } from '../components/badges';
import { HBarChart } from '../components/charts';
import { Button, Card, Chip, ErrorNote, Spinner, Tabs } from '../components/ui';
import { cx } from '../lib/styles';
import { ARCHETYPE_LABEL, STATUS_LABEL, ago } from '../lib/format';
import { DIMENSIONS, type JobApplication, type JobStatus } from '../types/index';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Tab = 'evaluation' | 'documents' | 'interview' | 'description' | 'activity';

function List({ items, tone }: { items: string[]; tone: 'green' | 'amber' | 'red' }) {
  if (!items.length) return <p className="text-sm text-slate-400">None</p>;
  const dot = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[tone];
  return (
    <ul className="space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', dot)} />
          {s}
        </li>
      ))}
    </ul>
  );
}

function EvaluationTab({ app, onEvaluate, evaluating }: { app: JobApplication; onEvaluate: () => void; evaluating: boolean }) {
  const e = app.evaluation;
  if (!e) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Sparkles className="size-8 text-blue-400" />
          <p className="text-sm text-slate-600">Not evaluated yet. The evaluation scores 8 dimensions against your CV and preferences and explains every score.</p>
          <Button loading={evaluating} onClick={onEvaluate} icon={<Sparkles className="size-4" />}>Evaluate now</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card>
          <div className="flex items-start gap-4">
            <GradeBadge grade={e.grade} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <RecommendationBadge value={e.recommendation} />
                <Chip tone="violet">{ARCHETYPE_LABEL[e.archetype] ?? e.archetype}</Chip>
                <span className="text-xs tabular-nums text-slate-500">{e.overallScore.toFixed(2)} / 5 weighted</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{e.rationale}</p>
              {e.gradeCap && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                  <TriangleAlert className="size-3.5" /> Grade capped: {e.gradeCap}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Scorecard" action={<span className="text-xs text-slate-400">hover a bar for the evidence</span>}>
          <HBarChart
            caption="Dimension scores, 1 to 5"
            max={5}
            format={(v) => `${v}/5`}
            data={DIMENSIONS.map((d) => ({
              label: `${d.label} · ${Math.round((e.weightsUsed[d.key] ?? 0) * 100)}%`,
              value: e.dimensions[d.key].score,
              hint: e.dimensions[d.key].evidence,
            }))}
          />
          <p className="mt-3 text-[11px] text-slate-400">
            Claude scores each dimension with evidence; the weighted grade and caps are computed deterministically from your preference weights.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Strengths"><List items={e.strengths} tone="green" /></Card>
          <Card title="Gaps"><List items={e.gaps} tone="amber" /></Card>
        </div>
        {(e.redFlags.length > 0 || e.dealBreakersHit.length > 0) && (
          <Card title="Red flags & deal-breakers"><List items={[...e.dealBreakersHit.map((d) => `Deal-breaker: ${d}`), ...e.redFlags]} tone="red" /></Card>
        )}
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Card title="Role summary">
          <p className="text-sm text-slate-700">{e.roleSummary.oneLiner}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {[
              ['Level', cap(e.roleSummary.seniority.replace('_', ' '))],
              ['Type', e.roleSummary.employmentType],
              ['Location', e.roleSummary.location],
              ['Remote', cap(e.roleSummary.remotePolicy)],
              ['Compensation', e.roleSummary.compensation || 'Not stated'],
              ['Languages', e.roleSummary.languageRequirements.join(', ') || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-400">{k}</dt>
                <dd className="text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Keywords">
          <div className="flex flex-wrap gap-1.5">
            {e.requiredKeywords.map((k) => (
              <Chip key={k} tone={e.missingKeywords.includes(k) ? 'red' : 'green'}>{k}</Chip>
            ))}
          </div>
          {e.missingKeywords.length > 0 && <p className="mt-2 text-[11px] text-slate-400">Red = not supported by your CV.</p>}
        </Card>
        <p className="text-[11px] text-slate-400">
          {e.model} · prompt v{e.promptVersion} · {ago(e.evaluatedAt)}
        </p>
      </div>
    </div>
  );
}

function DocumentsTab({ app, onTailor, tailoring, tailorError }: { app: JobApplication; onTailor: () => void; tailoring: boolean; tailorError: unknown }) {
  const [doc, setDoc] = useState<'cv' | 'cover-letter'>('cv');
  const t = app.tailoring;
  if (!app.output || !t) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FileText className="size-8 text-blue-400" />
          <p className="max-w-md text-sm text-slate-600">
            Generate a CV and cover letter tailored to this role. Content is rewritten only from facts in your CV — invented skills, employers, projects or metrics are removed or flagged.
          </p>
          <Button loading={tailoring} onClick={onTailor} icon={<Sparkles className="size-4" />}>Tailor documents</Button>
          <ErrorNote error={tailorError} />
        </div>
      </Card>
    );
  }
  const version = encodeURIComponent(app.output.generatedAt);
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Card
          padded={false}
          title={
            <div className="flex gap-1">
              {(['cv', 'cover-letter'] as const).map((d) => (
                <button key={d} onClick={() => setDoc(d)} className={cx('rounded-md px-2.5 py-1 text-xs font-medium', doc === d ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
                  {d === 'cv' ? 'CV' : 'Cover letter'}
                </button>
              ))}
            </div>
          }
          action={
            <a href={api.documentUrl(app.id, doc, true)}>
              <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />}>Download PDF</Button>
            </a>
          }
        >
          <iframe title={doc} src={`${api.documentUrl(app.id, doc)}#v=${version}&toolbar=0`} className="h-184 w-full rounded-b-xl bg-slate-100" />
        </Card>
      </div>
      <div className="space-y-4 lg:col-span-2">
        <Card title="Grounding check">
          {t.groundingWarnings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700"><CircleCheck className="size-4" /> Every skill, project, employer and metric traces back to your CV.</p>
          ) : (
            <List items={t.groundingWarnings} tone="amber" />
          )}
        </Card>
        <Card title="Address honestly">
          <List items={t.honestyNotes} tone="amber" />
        </Card>
        <Card title="Keywords covered">
          <div className="flex flex-wrap gap-1.5">{t.keywordsCovered.map((k) => <Chip key={k} tone="blue">{k}</Chip>)}</div>
        </Card>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-400">{t.model} · {ago(t.tailoredAt)}</p>
          <Button size="sm" variant="ghost" loading={tailoring} onClick={onTailor} icon={<RefreshCw className="size-3.5" />}>Regenerate</Button>
        </div>
      </div>
    </div>
  );
}

function InterviewTab({ app }: { app: JobApplication }) {
  const prep = app.evaluation?.interviewPrep;
  if (!prep) return <Card><p className="text-sm text-slate-500">Evaluate the job to get interview preparation.</p></Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Likely questions"><ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">{prep.likelyQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol></Card>
      <Card title="Talking points"><List items={prep.talkingPoints} tone="green" /></Card>
      <Card title="Questions to ask them"><List items={app.evaluation?.questionsToAsk ?? []} tone="green" /></Card>
      <Card title="Stories to prepare" action={<Link to="/stories" className="text-xs text-blue-600 hover:underline">Story bank →</Link>}>
        {prep.stories.length === 0 ? (
          <p className="text-sm text-slate-400">No new stories for this role.</p>
        ) : (
          <div className="space-y-3">
            {prep.stories.map((s) => (
              <div key={s.title} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-800">{s.title}</p>
                <p className="mt-1 text-xs text-slate-600"><strong>Result:</strong> {s.result}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">{s.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ActivityTab({ app }: { app: JobApplication }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(app.notes ?? '');
  const save = useMutation({ mutationFn: () => api.setNotes(app.id, notes), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job', app.id] }) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Timeline">
        <ol className="relative ml-2 space-y-4 border-l border-slate-200">
          {[...app.statusHistory].reverse().map((h, i) => (
            <li key={i} className="ml-4">
              <span className="absolute -left-1.25 mt-1.5 size-2.5 rounded-full border-2 border-white bg-blue-500" />
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                {STATUS_LABEL[h.status] ?? h.status} <ActorIcon actor={h.actor} />
              </div>
              {h.note && <p className="text-xs text-slate-600">{h.note}</p>}
              <p className="text-[11px] text-slate-400">{format(new Date(h.ts), 'dd MMM yyyy, HH:mm')}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Card title="Your notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} placeholder="Recruiter name, referral, follow-up date…" className="w-full rounded-lg p-3 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <Button className="mt-2" size="sm" variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>{save.isSuccess ? 'Saved' : 'Save notes'}</Button>
      </Card>
    </div>
  );
}

/** The human-in-the-loop panel: review → approve → apply yourself → record it. */
function DecisionPanel({ app }: { app: JobApplication }) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job', app.id] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };
  const approve = useMutation({ mutationFn: () => api.approve(app.id), onSuccess: invalidate });
  const applied = useMutation({ mutationFn: () => api.markApplied(app.id), onSuccess: invalidate });
  const skip = useMutation({ mutationFn: () => api.skip(app.id, 'Skipped by you'), onSuccess: invalidate });
  const status = useMutation({ mutationFn: (s: JobStatus) => api.setStatus(app.id, s), onSuccess: invalidate });
  const applyUrl = app.job.applyUrl || app.job.url;
  const isManualUrl = applyUrl.startsWith('manual://') || applyUrl.startsWith('demo://');
  const s = app.job.status;

  return (
    <Card>
      {app.reviewRequested && app.reviewNote && (
        <div className="mb-4 flex gap-2 rounded-lg bg-violet-50 p-3 text-sm text-violet-900 ring-1 ring-violet-200">
          <Bot className="mt-0.5 size-4 shrink-0" />
          <div><span className="font-medium">Agent recommendation:</span> {app.reviewNote}</div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {['discovered', 'evaluated', 'documents_ready', 'error', 'skipped'].includes(s) && (
          <>
            {!app.approvedAt ? (
              <Button variant="primary" icon={<ShieldCheck className="size-4" />} disabled={!app.output} loading={approve.isPending} onClick={() => approve.mutate()} title={app.output ? undefined : 'Tailor documents first'}>
                Approve documents
              </Button>
            ) : (
              <Chip tone="green"><CircleCheck className="size-3" /> Approved {ago(app.approvedAt)}</Chip>
            )}
            {!isManualUrl && (
              <a href={applyUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" icon={<ExternalLink className="size-4" />}>Open application page</Button>
              </a>
            )}
            <Button variant="success" icon={<CircleCheck className="size-4" />} disabled={!app.approvedAt} loading={applied.isPending} onClick={() => applied.mutate()} title={app.approvedAt ? undefined : 'Approve the documents first'}>
              I submitted it
            </Button>
            {s !== 'skipped' && <Button variant="ghost" loading={skip.isPending} onClick={() => skip.mutate()}>Skip</Button>}
          </>
        )}
        {['applied', 'interview', 'offer', 'rejected'].includes(s) && (
          <>
            <span className="text-sm text-slate-600">Update outcome:</span>
            {(['interview', 'offer', 'rejected'] as JobStatus[]).filter((x) => x !== s).map((x) => (
              <Button key={x} size="sm" variant="secondary" loading={status.isPending && status.variables === x} onClick={() => status.mutate(x)}>
                {STATUS_LABEL[x]}
              </Button>
            ))}
          </>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        PipeJob never submits applications. Review the documents, submit on the company’s site yourself, then record it here.
      </p>
      <ErrorNote error={approve.error ?? applied.error ?? skip.error ?? status.error} />
    </Card>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('evaluation');
  const { data: app, isLoading, error } = useQuery({ queryKey: ['job', id], queryFn: () => api.job(id!), enabled: Boolean(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job', id] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };
  const evaluate = useMutation({ mutationFn: () => api.evaluate(id!), onSuccess: invalidate });
  const tailor = useMutation({ mutationFn: () => api.tailor(id!), onSuccess: () => { invalidate(); setTab('documents'); } });
  const remove = useMutation({ mutationFn: () => api.deleteJob(id!), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); navigate('/pipeline'); } });

  if (isLoading) return <Spinner />;
  if (error || !app) return <ErrorNote error={error ?? 'Not found'} />;
  const { job } = app;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" /> Back</button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <GradeBadge grade={app.grade} size="lg" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{job.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{job.company}</span>
              {job.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{job.location}</span>}
              {job.remote && <Chip tone="blue">Remote</Chip>}
              <StatusBadge status={job.status} />
              <span className="text-xs text-slate-400">via <span className="capitalize">{job.source}</span> · found {ago(job.discoveredAt)}</span>
              {app.reviewRequested && <Chip tone="violet"><Flag className="size-3" /> In review queue</Chip>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="size-3.5" />} loading={evaluate.isPending} onClick={() => evaluate.mutate()}>
            {app.evaluation ? 'Re-evaluate' : 'Evaluate'}
          </Button>
          <Button variant="secondary" size="sm" icon={<Sparkles className="size-3.5" />} loading={tailor.isPending} onClick={() => tailor.mutate()}>
            {app.output ? 'Re-tailor' : 'Tailor'}
          </Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => confirm('Remove this job from your pipeline?') && remove.mutate()} />
        </div>
      </div>

      <ErrorNote error={evaluate.error} />
      <DecisionPanel app={app} />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'evaluation', label: 'Evaluation' },
          { id: 'documents', label: app.output ? 'Documents ✓' : 'Documents' },
          { id: 'interview', label: 'Interview prep' },
          { id: 'description', label: 'Job description' },
          { id: 'activity', label: 'Activity & notes' },
        ]}
      />

      {tab === 'evaluation' && <EvaluationTab app={app} onEvaluate={() => evaluate.mutate()} evaluating={evaluate.isPending} />}
      {tab === 'documents' && <DocumentsTab app={app} onTailor={() => tailor.mutate()} tailoring={tailor.isPending} tailorError={tailor.error} />}
      {tab === 'interview' && <InterviewTab app={app} />}
      {tab === 'description' && (
        <Card action={!job.url.startsWith('manual://') && !job.url.startsWith('demo://') && <a href={job.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">Original posting <ExternalLink className="size-3" /></a>} title="Job description">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{job.rawJD || 'No description available.'}</pre>
        </Card>
      )}
      {tab === 'activity' && <ActivityTab app={app} />}
    </div>
  );
}
