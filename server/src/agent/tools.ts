import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getApplication, listApplications } from '../db/applications';
import { loadMasterCV, loadPreferences } from '../profile';
import { gradeRank } from '../services/evaluation/scoring';
import { requestReview, runEvaluation, runTailoring, skip } from '../services/pipeline';
import { importFromText, importFromUrl } from '../services/sources/importer';
import { searchJobs } from '../services/sources/search';
import { JOB_STATUSES, type Grade, type JobApplication } from '../types/index';

export interface ToolContext {
  runId: string;
  signal: AbortSignal;
  counters: { evaluations: number; tailored: number };
  limits: { maxEvaluations: number; maxTailored: number };
}

/** A tool error the model should see and can recover from (returned as is_error). */
export class ToolError extends Error {}

interface ToolDef<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}

function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

const GradeEnum = z.enum(['A', 'B', 'C', 'D', 'F']);

function brief(app: JobApplication) {
  return {
    job_id: app.id,
    title: app.job.title,
    company: app.job.company,
    location: app.job.location || undefined,
    remote: app.job.remote ?? undefined,
    status: app.job.status,
    grade: app.grade,
    score: app.score,
    shortlisted: app.reviewRequested || undefined,
  };
}

function requireJob(id: string): JobApplication {
  const app = getApplication(id);
  if (!app) throw new ToolError(`No job with id ${id}. Use search_jobs or list_pipeline to find valid job_ids.`);
  return app;
}

function evaluationSummary(app: JobApplication) {
  const e = app.evaluation;
  if (!e) return undefined;
  return {
    grade: e.grade,
    overall_score: e.overallScore,
    recommendation: e.recommendation,
    archetype: e.archetype,
    seniority: e.roleSummary.seniority,
    rationale: e.rationale,
    strengths: e.strengths.slice(0, 3),
    gaps: e.gaps.slice(0, 3),
    red_flags: e.redFlags,
    deal_breakers_hit: e.dealBreakersHit,
    grade_cap: e.gradeCap,
  };
}

export const TOOLS = [
  defineTool({
    name: 'get_candidate_profile',
    description:
      "Returns the candidate's CV highlights, job-search preferences (target roles, locations, deal-breakers, minimum grade) and a snapshot of the current pipeline. Call this first so your searches and judgements are grounded in who the candidate is.",
    schema: z.object({}),
    run: async () => {
      const cv = loadMasterCV();
      const prefs = loadPreferences();
      const all = listApplications();
      const byStatus: Record<string, number> = {};
      for (const a of all) byStatus[a.job.status] = (byStatus[a.job.status] ?? 0) + 1;
      return {
        candidate: {
          name: cv.fullName,
          headline: cv.headline,
          summary: cv.summary,
          location: cv.location,
          skills: cv.skills,
          experience: cv.experience.map((e) => `${e.role} @ ${e.company} (${e.startDate}–${e.endDate ?? 'present'})`),
          projects: (cv.projects ?? []).map((p) => `${p.name}: ${p.tech.join(', ')}`),
          education: cv.education.map((e) => `${e.degree} ${e.field}, ${e.institution} (${e.startDate}–${e.endDate ?? 'present'})`),
          languages: cv.languages.map((l) => `${l.language} ${l.level}`),
        },
        preferences: {
          target_roles: prefs.targetRoles,
          target_archetypes: prefs.targetArchetypes,
          seniority: prefs.seniority,
          locations: prefs.locations,
          remote_preference: prefs.remotePreference,
          must_haves: prefs.mustHaves,
          deal_breakers: prefs.dealBreakers,
          min_grade_to_tailor: prefs.minGradeToTailor,
          default_search: prefs.search,
        },
        pipeline: { total: all.length, by_status: byStatus },
      };
    },
  }),

  defineTool({
    name: 'search_jobs',
    description:
      "Searches the candidate's configured company career portals (official Greenhouse / Lever / Ashby job-board APIs) and the Arbeitnow job board. New matches are saved to the pipeline as 'discovered'. Keywords are matched against titles (strongly) and descriptions (weakly); use several short keywords and synonyms in English and German (e.g. 'Werkstudent', 'Working Student', 'AI', 'LLM', 'Agent'). Returns compact results — use get_job_details to read a posting.",
    schema: z.object({
      keywords: z.array(z.string()).min(1).max(12).describe('Short keywords or phrases, e.g. ["working student", "werkstudent", "AI engineer", "LLM"]'),
      location: z.string().optional().describe('Comma-separated locations, e.g. "Germany, Remote" or "Berlin, Munich". Omit for anywhere.'),
      remote_only: z.boolean().optional(),
      companies: z.array(z.string()).optional().describe('Restrict to specific portal companies by name'),
      limit: z.number().int().min(1).max(25).optional().describe('Max results (default 15)'),
    }),
    run: async (input) => {
      const report = await searchJobs({
        keywords: input.keywords,
        location: input.location,
        remoteOnly: input.remote_only,
        companies: input.companies,
        limit: input.limit ?? 15,
      });
      return {
        scanned_postings: report.scanned,
        sources_queried: report.sourcesQueried.length,
        source_errors: report.sourceErrors.slice(0, 5),
        results: report.results.map((r) => {
          const app = getApplication(r.job.id);
          return { ...(app ? brief(app) : { job_id: r.job.id, title: r.job.title, company: r.job.company }), is_new: r.isNew, relevance: r.relevance };
        }),
      };
    },
  }),

  defineTool({
    name: 'list_pipeline',
    description: 'Lists jobs already in the pipeline, optionally filtered by status or minimum grade, best-scored first.',
    schema: z.object({
      status: z.enum(JOB_STATUSES as [string, ...string[]]).optional(),
      min_grade: GradeEnum.optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (input) => {
      const grades = input.min_grade ? (['A', 'B', 'C', 'D', 'F'] as Grade[]).filter((g) => gradeRank(g) <= gradeRank(input.min_grade!)) : undefined;
      const apps = listApplications({
        status: input.status as JobApplication['job']['status'] | undefined,
        grade: grades,
        sort: 'score',
        limit: input.limit ?? 25,
      });
      return { count: apps.length, jobs: apps.map(brief) };
    },
  }),

  defineTool({
    name: 'get_job_details',
    description: 'Returns a job posting (description truncated to ~6000 characters) plus its evaluation summary if it has been evaluated.',
    schema: z.object({ job_id: z.string() }),
    run: async ({ job_id }) => {
      const app = requireJob(job_id);
      const jd = app.job.rawJD;
      return {
        ...brief(app),
        url: app.job.url,
        source: app.job.source,
        posted_at: app.job.postedAt,
        description: jd.length > 6000 ? jd.slice(0, 6000) + '\n[...truncated]' : jd,
        evaluation: evaluationSummary(app),
      };
    },
  }),

  defineTool({
    name: 'import_job',
    description: 'Adds a job to the pipeline from a posting URL (Greenhouse, Lever, Ashby or any careers page) or from pasted job-description text.',
    schema: z.object({
      url: z.string().optional(),
      text: z.string().optional(),
    }),
    run: async (input, ctx) => {
      if (!input.url && !input.text) throw new ToolError('Provide either url or text.');
      const { application, isNew } = input.url
        ? await importFromUrl(input.url, { runId: ctx.runId })
        : await importFromText({ text: input.text! }, { runId: ctx.runId });
      return { ...brief(application), is_new: isNew };
    },
  }),

  defineTool({
    name: 'evaluate_job',
    description:
      "Runs a structured evaluation of one job against the candidate's CV and preferences: 8 scored dimensions, a deterministic weighted grade (A–F), strengths, gaps, red flags and a recommendation. Existing evaluations are returned from cache unless force=true. Each fresh evaluation costs an LLM call, so only evaluate postings whose title and company plausibly fit; you may call this tool for several jobs in parallel.",
    schema: z.object({ job_id: z.string(), force: z.boolean().optional() }),
    run: async ({ job_id, force }, ctx) => {
      const app = requireJob(job_id);
      if (app.evaluation && !force) return { job_id, cached: true, ...evaluationSummary(app) };
      if (ctx.counters.evaluations >= ctx.limits.maxEvaluations) {
        throw new ToolError(`Evaluation budget for this run is used up (${ctx.limits.maxEvaluations}). Work with what you have and write your report.`);
      }
      ctx.counters.evaluations++;
      await runEvaluation(job_id, { runId: ctx.runId, signal: ctx.signal, actor: 'agent' });
      return { job_id, cached: false, ...evaluationSummary(requireJob(job_id)) };
    },
  }),

  defineTool({
    name: 'tailor_application',
    description:
      "Generates a tailored CV and cover letter (PDF) for a job whose grade meets the candidate's minimum. Content is grounded in the CV — fabricated skills, projects or metrics are removed or flagged. Use sparingly, only for the strongest matches you intend to shortlist.",
    schema: z.object({ job_id: z.string() }),
    run: async ({ job_id }, ctx) => {
      const app = requireJob(job_id);
      if (app.output && app.tailoring) {
        return { job_id, cached: true, documents_ready: true, grounding_warnings: app.tailoring.groundingWarnings, honesty_notes: app.tailoring.honestyNotes };
      }
      if (ctx.counters.tailored >= ctx.limits.maxTailored) {
        throw new ToolError(`Tailoring budget for this run is used up (${ctx.limits.maxTailored}).`);
      }
      ctx.counters.tailored++;
      const { tailoring } = await runTailoring(job_id, { runId: ctx.runId, signal: ctx.signal, actor: 'agent', enforceMinGrade: true });
      return {
        job_id,
        documents_ready: true,
        headline: tailoring.headline,
        keywords_covered: tailoring.keywordsCovered,
        grounding_warnings: tailoring.groundingWarnings,
        honesty_notes: tailoring.honestyNotes,
      };
    },
  }),

  defineTool({
    name: 'shortlist_for_review',
    description:
      "Puts a job in the candidate's review queue with your recommendation. This is the hand-off to the human: you cannot apply to jobs — the candidate reviews the evaluation and documents and submits the application themselves.",
    schema: z.object({
      job_id: z.string(),
      note: z.string().describe('1-2 sentences: why this is worth their time and what to watch out for'),
    }),
    run: async ({ job_id, note }) => {
      const app = requireJob(job_id);
      if (!app.evaluation) throw new ToolError('Evaluate the job before shortlisting it.');
      await requestReview(job_id, note);
      return { job_id, shortlisted: true, documents_ready: Boolean(app.output) };
    },
  }),

  defineTool({
    name: 'skip_job',
    description: 'Marks a job as skipped with a short reason (e.g. clear seniority mismatch or deal-breaker) so it does not clutter the pipeline.',
    schema: z.object({ job_id: z.string(), reason: z.string() }),
    run: async ({ job_id, reason }) => {
      const app = requireJob(job_id);
      if (['applied', 'interview', 'offer'].includes(app.job.status)) {
        throw new ToolError(`Job is already '${app.job.status}' — only the candidate can change that.`);
      }
      skip(job_id, reason, 'agent');
      return { job_id, skipped: true };
    },
  }),
];

type AnyTool = (typeof TOOLS)[number];
const TOOL_MAP = new Map<string, AnyTool>(TOOLS.map((t) => [t.name, t]));

/** Tool definitions for the Messages API, generated from the Zod schemas (single source of truth). */
export function toolDefinitions(): Anthropic.Beta.BetaTool[] {
  return TOOLS.map((t) => {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
    return {
      name: t.name,
      description: t.description,
      input_schema: { type: 'object', ...schema } as Anthropic.Beta.BetaTool.InputSchema,
    };
  });
}

export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<{ output: unknown; isError: boolean }> {
  const tool = TOOL_MAP.get(name);
  if (!tool) return { output: { error: `Unknown tool ${name}` }, isError: true };

  // Validate model-supplied input before running anything.
  const parsed = tool.schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { output: { error: 'Invalid input', issues: z.flattenError(parsed.error) }, isError: true };
  }
  try {
    // Each tool's input type matches its own schema; TypeScript can't correlate them through the union.
    const output = await (tool.run as (i: unknown, c: ToolContext) => Promise<unknown>)(parsed.data, ctx);
    return { output, isError: false };
  } catch (err) {
    if (ctx.signal.aborted) throw err;
    return { output: { error: err instanceof Error ? err.message : String(err) }, isError: true };
  }
}
