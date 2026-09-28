import path from 'path';
import { config } from '../config';
import {
  countAppliedSince,
  getApplication,
  saveEvaluation,
  saveTailoring,
  setApplied,
  setApproved,
  setReviewRequest,
  updateApplicationStatus,
} from '../db/applications';
import { mergeSuggestedStories } from '../db/stories';
import { emitJobEvent } from '../events';
import { getClient } from '../llm/client';
import { loadMasterCV, loadPreferences } from '../profile';
import type { JobApplication, JobStatus, StatusHistoryEntry } from '../types/index';
import { evaluateJob } from './evaluation/evaluator';
import type { JobEvaluation, TailoredContent } from './evaluation/schema';
import { meetsMinGrade } from './evaluation/scoring';
import { notify } from './notify';
import { renderPdf } from './tailoring/pdf';
import { TAILOR_PROMPT_VERSION, tailorApplication } from './tailoring/tailor';
import { buildCoverLetterHtml, buildCVHtml } from './tailoring/templates';

export class PipelineError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

type Actor = NonNullable<StatusHistoryEntry['actor']>;

interface Ctx {
  runId?: string;
  signal?: AbortSignal;
  actor?: Actor;
}

// Statuses a job can be moved *forward* from by automated steps. Anything later
// (applied, interview, ...) reflects a human decision and is never overwritten.
const EARLY_STATUSES: JobStatus[] = ['discovered', 'evaluated', 'documents_ready', 'error', 'skipped'];

function requireApp(id: string): JobApplication {
  const app = getApplication(id);
  if (!app) throw new PipelineError(`Job ${id} not found`, 404);
  return app;
}

export async function runEvaluation(id: string, ctx: Ctx = {}): Promise<JobEvaluation> {
  const app = requireApp(id);
  getClient(); // fail fast on missing configuration without marking the job as errored
  emitJobEvent(id, 'evaluating', `${app.job.title} @ ${app.job.company}`);
  try {
    const evaluation = await evaluateJob(app.job, loadMasterCV(), loadPreferences(), ctx);
    saveEvaluation(id, evaluation);

    mergeSuggestedStories(
      evaluation.interviewPrep.stories.map((s) => ({ ...s, sourceJobId: id }))
    );

    if (app.job.status === 'discovered' || app.job.status === 'error') {
      updateApplicationStatus(id, 'evaluated', `Grade ${evaluation.grade} (${evaluation.overallScore.toFixed(2)}/5)`, ctx.actor ?? 'system');
    }
    emitJobEvent(id, 'evaluated', `Grade ${evaluation.grade} · ${evaluation.recommendation}`);
    return evaluation;
  } catch (err) {
    if (!ctx.signal?.aborted && (app.job.status === 'discovered' || app.job.status === 'error')) {
      updateApplicationStatus(id, 'error', `Evaluation failed: ${String(err)}`, 'system');
    }
    emitJobEvent(id, 'error', String(err));
    throw err;
  }
}

export async function runTailoring(
  id: string,
  ctx: Ctx & { enforceMinGrade?: boolean } = {}
): Promise<{ tailoring: TailoredContent; cvPath: string; coverLetterPath: string }> {
  let app = requireApp(id);
  getClient();

  if (!app.evaluation) {
    await runEvaluation(id, ctx);
    app = requireApp(id);
  }

  const prefs = loadPreferences();
  if (ctx.enforceMinGrade && !meetsMinGrade(app.evaluation?.grade, prefs.minGradeToTailor)) {
    throw new PipelineError(
      `Grade ${app.evaluation?.grade ?? '?'} is below the minimum grade (${prefs.minGradeToTailor}) for tailoring. A human can still tailor it manually.`
    );
  }

  emitJobEvent(id, 'tailoring', `${app.job.title} @ ${app.job.company}`);
  const cv = loadMasterCV();
  const tailoring = await tailorApplication(app.job, app.evaluation, cv, ctx);

  const dir = path.join(path.resolve(config.outputDir), id);
  const cvPath = path.join(dir, 'cv.pdf');
  const coverLetterPath = path.join(dir, 'cover-letter.pdf');
  const lang = app.evaluation?.language ?? 'en';

  await renderPdf(buildCVHtml(cv, tailoring, app.evaluation), cvPath);
  await renderPdf(buildCoverLetterHtml(cv, tailoring, app.job.company, app.job.title, lang), coverLetterPath);

  saveTailoring(id, tailoring, {
    jobId: id,
    cvPath,
    coverLetterPath,
    generatedAt: new Date().toISOString(),
    llmModel: config.model,
    promptVersion: TAILOR_PROMPT_VERSION,
  });

  if (EARLY_STATUSES.includes(app.job.status)) {
    const warnings = tailoring.groundingWarnings.length ? ` · ${tailoring.groundingWarnings.length} grounding warning(s)` : '';
    updateApplicationStatus(id, 'documents_ready', `Tailored CV & cover letter generated${warnings}`, ctx.actor ?? 'system');
  }
  emitJobEvent(id, 'documents_ready');
  return { tailoring, cvPath, coverLetterPath };
}

/** The agent's hand-off point: it can recommend, but only a human can approve and apply. */
export async function requestReview(id: string, note: string): Promise<void> {
  const app = requireApp(id);
  setReviewRequest(id, true, note);
  emitJobEvent(id, 'review_requested', note);
  await notify(
    `🧭 PipeJob shortlisted a role for your review\n${app.job.title} @ ${app.job.company}` +
      (app.grade ? ` — grade ${app.grade}` : '') +
      `\n${note}\n${config.clientUrl}/jobs/${id}`
  );
}

export function approve(id: string): void {
  const app = requireApp(id);
  if (!app.output) throw new PipelineError('Generate the tailored documents before approving.');
  setApproved(id);
  updateApplicationStatus(id, app.job.status, 'Approved for application', 'human');
  emitJobEvent(id, 'approved');
}

export function dailyApplicationBudget(): { used: number; limit: number; remaining: number } {
  const used = countAppliedSince(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const limit = config.limits.maxApplicationsPerDay;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** Records that the human submitted the application themselves on the company's site. */
export function markApplied(id: string, note?: string): void {
  const app = requireApp(id);
  if (app.job.status === 'applied') return;
  const budget = dailyApplicationBudget();
  if (budget.remaining === 0) {
    throw new PipelineError(
      `Daily application budget reached (${budget.limit}/day). Quality over quantity — continue tomorrow or raise MAX_APPLICATIONS_PER_DAY.`,
      429
    );
  }
  setApplied(id);
  updateApplicationStatus(id, 'applied', note ?? 'Submitted by you', 'human');
  emitJobEvent(id, 'applied');
}

export function skip(id: string, reason: string, actor: Actor): void {
  requireApp(id);
  setReviewRequest(id, false);
  updateApplicationStatus(id, 'skipped', reason, actor);
  emitJobEvent(id, 'skipped', reason);
}

export function setStatus(id: string, status: JobStatus, note: string | undefined, actor: Actor): void {
  requireApp(id);
  if (status === 'applied') return markApplied(id, note);
  updateApplicationStatus(id, status, note, actor);
  emitJobEvent(id, status, note);
}
