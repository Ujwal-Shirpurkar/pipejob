import { config } from '../../config';
import { structuredCall } from '../../llm/client';
import type { DiscoveredJob, MasterCV } from '../../types/index';
import { TailoringOutputSchema, type JobEvaluation, type TailoredContent } from '../evaluation/schema';
import { enforceGrounding } from './grounding';

export const TAILOR_PROMPT_VERSION = '2.0';

function buildSystemPrompt(cv: MasterCV): string {
  return `You tailor a candidate's CV and cover letter to a specific job — truthfully.

## Non-negotiable rules
- Only use facts that are in the CV below. You may rephrase, reorder, merge and emphasise; you may not invent employers, projects, skills, dates, metrics or responsibilities.
- Skills and project names must be copied exactly as they appear in the CV.
- Bullets start with a strong verb, are concise (max ~25 words) and mirror the job's vocabulary where the CV genuinely supports it.
- Keep the same number of bullets per role or fewer; drop the least relevant ones.
- The cover letter is specific to the company and role, confident but not inflated, 250-350 words, no clichés ("I am writing to apply..."), and it addresses the most important requirement head-on.
- If the candidate lacks a requirement, do not hide it — list it in honestyNotes so the candidate can address it in person.
- Write in the language of the job description (German JD → German documents).

## Candidate CV
${JSON.stringify(cv, null, 2)}`;
}

export async function tailorApplication(
  job: DiscoveredJob,
  evaluation: JobEvaluation | undefined,
  cv: MasterCV,
  ctx: { runId?: string; signal?: AbortSignal } = {}
): Promise<TailoredContent> {
  const evaluationContext = evaluation
    ? `Evaluation notes:
- Strengths: ${evaluation.strengths.join('; ')}
- Gaps: ${evaluation.gaps.join('; ')}
- Required keywords: ${evaluation.requiredKeywords.join(', ')}
- JD language: ${evaluation.language}`
    : '';

  const { data } = await structuredCall({
    purpose: 'tailor',
    schema: TailoringOutputSchema,
    system: buildSystemPrompt(cv),
    user: `Tailor the application for this job.

Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

${evaluationContext}

Job description:
${job.rawJD.slice(0, 24_000)}`,
    jobId: job.id,
    runId: ctx.runId,
    signal: ctx.signal,
  });

  const { content, warnings } = enforceGrounding(data, cv, job.rawJD);

  return {
    ...content,
    groundingWarnings: warnings,
    model: config.model,
    promptVersion: TAILOR_PROMPT_VERSION,
    tailoredAt: new Date().toISOString(),
  };
}
