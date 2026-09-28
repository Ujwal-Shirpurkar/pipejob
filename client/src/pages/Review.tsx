import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, FileText, Inbox, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { GradeBadge, RecommendationBadge } from '../components/badges';
import { Meter } from '../components/charts';
import { Button, Card, Chip, Empty, PageHeader, Spinner } from '../components/ui';
import { ago } from '../lib/format';

export default function Review() {
  const { data: jobs, isLoading } = useQuery({ queryKey: ['jobs', 'review'], queryFn: () => api.jobs({ review: true, sort: 'score' }) });
  const { data: budget } = useQuery({ queryKey: ['stats'], queryFn: api.stats, select: (s) => s.budget });

  return (
    <div>
      <PageHeader
        title="Review queue"
        subtitle="Roles the agent shortlisted for you. Nothing leaves PipeJob until you review the documents and submit the application yourself."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          {isLoading && <Spinner />}
          {!isLoading && jobs?.length === 0 && (
            <Card>
              <Empty icon={<Inbox className="size-10" />} title="Your review queue is empty">
                Run the <Link to="/agent" className="text-blue-600 hover:underline">agent</Link> to research and shortlist roles, or evaluate jobs from the pipeline yourself.
              </Empty>
            </Card>
          )}
          {jobs?.map((app) => (
            <Card key={app.id}>
              <div className="flex items-start gap-4">
                <GradeBadge grade={app.grade} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/jobs/${app.id}`} className="font-semibold text-slate-900 hover:text-blue-700">{app.job.title}</Link>
                    {app.evaluation && <RecommendationBadge value={app.evaluation.recommendation} />}
                  </div>
                  <p className="text-sm text-slate-500">{app.job.company}{app.job.location ? ` · ${app.job.location}` : ''}</p>
                  {app.reviewNote && (
                    <p className="mt-2 flex gap-2 text-sm text-slate-700">
                      <Bot className="mt-0.5 size-4 shrink-0 text-violet-500" /> {app.reviewNote}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {app.output ? <Chip tone="green"><FileText className="size-3" /> Documents ready</Chip> : <Chip tone="amber">No documents yet</Chip>}
                    {app.tailoring?.groundingWarnings.length ? <Chip tone="amber">{app.tailoring.groundingWarnings.length} grounding warning(s)</Chip> : null}
                    <span className="text-xs text-slate-400">shortlisted {ago(app.updatedAt)}</span>
                  </div>
                </div>
                <Link to={`/jobs/${app.id}`}>
                  <Button size="sm" icon={<ShieldCheck className="size-3.5" />}>Review</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card title="Daily budget">
            {budget && <Meter value={budget.used} max={budget.limit} label="Applications in the last 24 h" />}
            <p className="mt-3 text-xs text-slate-500">A self-imposed limit. A few well-researched applications beat a hundred generic ones — for you and for the recruiter reading them.</p>
          </Card>
          <Card title="How review works">
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-slate-600">
              <li>Read the evaluation and the agent’s reasoning.</li>
              <li>Check the tailored CV and cover letter — grounding warnings flag anything not in your CV.</li>
              <li>Approve, open the company’s application page and submit it yourself.</li>
              <li>Mark it as submitted so the tracker stays accurate.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
