import { config } from '../../config';
import { structuredCall } from '../../llm/client';
import type { DiscoveredJob, MasterCV, Preferences } from '../../types/index';
import { aggregateScore } from './scoring';
import { EvaluationOutputSchema, type JobEvaluation } from './schema';

export const EVAL_PROMPT_VERSION = '2.0';

const MAX_JD_CHARS = 24_000;

/**
 * The system prompt holds everything that is stable across evaluations (rubric, CV,
 * preferences) so it is served from the prompt cache when the agent evaluates a batch.
 */
function buildSystemPrompt(cv: MasterCV, prefs: Preferences): string {
  return `You are a candid career coach evaluating whether a specific job is worth this candidate's time.
Your job is to protect the candidate from low-quality applications: be honest, specific and evidence-based.

## How to score
Score each dimension as an integer from 1 to 5 and cite concrete evidence from the job description and the CV.
- skills_match: overlap between required/preferred skills and skills the CV actually demonstrates. Judge competencies semantically, not by keyword matching.
- experience_level_fit: does the candidate's level (student, junior, ...) fit what the role requires? Working-student/intern roles for a student score high; roles demanding years of full-time experience score low.
- role_alignment: how well the role matches the candidate's target roles and archetypes.
- location_fit: location, remote policy, language requirements and work authorisation versus the candidate's situation.
- growth_potential: learning opportunities, mentorship, scope, trajectory toward the target roles.
- company_signal: product, mission, stability and team quality as far as the posting reveals.
- compensation_fit: stated compensation versus expectation. Use 3 when compensation is not stated.
- legitimacy: 5 = clearly real, specific and current; 1 = vague, contradictory or scam/ghost-job signals.

Anchors: 5 = excellent, 4 = good, 3 = acceptable/unknown, 2 = weak, 1 = poor or disqualifying.
Do not compute an overall score; that is done downstream from your dimension scores.

## Rules
- Never assume the candidate has a skill or experience that is not supported by the CV.
- dealBreakersHit must only list items from the candidate's deal-breakers that this job clearly triggers, copied verbatim.
- Recommendation: "apply" only for strong, realistic fits; "consider" for plausible fits with notable gaps; "skip" otherwise.
- Interview stories must be built only from facts in the CV (STAR + Reflection). Prefer reusable stories over job-specific ones.
- Write every text field in English, even when the job description is German. Set "language" to the language of the job description.

## Candidate CV
${JSON.stringify(cv, null, 2)}

## Candidate preferences
${JSON.stringify(
  {
    targetRoles: prefs.targetRoles,
    targetArchetypes: prefs.targetArchetypes,
    seniority: prefs.seniority,
    locations: prefs.locations,
    remotePreference: prefs.remotePreference,
    mustHaves: prefs.mustHaves,
    niceToHaves: prefs.niceToHaves,
    dealBreakers: prefs.dealBreakers,
    salaryExpectation: prefs.salaryExpectation,
    workAuthorization: prefs.workAuthorization,
  },
  null,
  2
)}`;
}

export async function evaluateJob(
  job: DiscoveredJob,
  cv: MasterCV,
  prefs: Preferences,
  ctx: { runId?: string; signal?: AbortSignal } = {}
): Promise<JobEvaluation> {
  const jd = job.rawJD.length > MAX_JD_CHARS ? job.rawJD.slice(0, MAX_JD_CHARS) + '\n[...truncated]' : job.rawJD;

  const { data } = await structuredCall({
    purpose: 'evaluate',
    schema: EvaluationOutputSchema,
    system: buildSystemPrompt(cv, prefs),
    user: `Evaluate this job for the candidate.

Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'not stated'}${job.remote ? ' (remote)' : ''}
Source: ${job.source}
URL: ${job.url}

Job description:
${jd || '(no description available — score conservatively and flag it)'}`,
    jobId: job.id,
    runId: ctx.runId,
    signal: ctx.signal,
  });

  const scored = aggregateScore(data, prefs.scoringWeights);

  return {
    ...data,
    dimensions: scored.dimensions,
    overallScore: scored.overallScore,
    grade: scored.grade,
    gradeCap: scored.gradeCap,
    weightsUsed: scored.weightsUsed,
    model: config.model,
    promptVersion: EVAL_PROMPT_VERSION,
    evaluatedAt: new Date().toISOString(),
  };
}
