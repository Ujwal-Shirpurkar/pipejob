import { z } from 'zod';

export const ARCHETYPES = [
  'agentic_ai',
  'llm_applications',
  'ml_engineering',
  'mlops_llmops',
  'data_science',
  'backend',
  'fullstack',
  'frontend',
  'devops_cloud',
  'product',
  'research',
  'other',
] as const;

export const SENIORITY = ['intern', 'working_student', 'junior', 'mid', 'senior', 'lead', 'unknown'] as const;

const Dimension = z.object({
  score: z.number().int().describe('Integer from 1 (poor fit) to 5 (excellent fit)'),
  evidence: z.string().describe('One or two sentences citing concrete facts from the JD and the CV'),
});

const Story = z.object({
  title: z.string().describe('Short reusable title, e.g. "Shipping an LLM agent under a deadline"'),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  reflection: z.string().describe('What the candidate learned or would do differently'),
  tags: z.array(z.string()).describe('Competencies this story demonstrates'),
});

/** What the model returns for an evaluation. Aggregation into a grade happens in code (scoring.ts). */
export const EvaluationOutputSchema = z.object({
  archetype: z.enum(ARCHETYPES),
  roleSummary: z.object({
    oneLiner: z.string().describe('One sentence: what this role actually is'),
    seniority: z.enum(SENIORITY),
    employmentType: z.string().describe('e.g. Full-time, Working student (20h/week), Internship'),
    location: z.string(),
    remotePolicy: z.enum(['remote', 'hybrid', 'onsite', 'unknown']),
    languageRequirements: z.array(z.string()),
    compensation: z.string().describe('Stated compensation, or an empty string if not stated'),
  }),
  dimensions: z.object({
    skills_match: Dimension,
    experience_level_fit: Dimension,
    role_alignment: Dimension,
    location_fit: Dimension,
    growth_potential: Dimension,
    company_signal: Dimension,
    compensation_fit: Dimension,
    legitimacy: Dimension,
  }),
  strengths: z.array(z.string()).describe('Where the candidate is genuinely strong for this role'),
  gaps: z.array(z.string()).describe('Honest gaps between the CV and the requirements'),
  redFlags: z.array(z.string()).describe('Concerns about the posting itself (vague, unrealistic, ghost-job signals)'),
  dealBreakersHit: z.array(z.string()).describe("Which of the candidate's deal-breakers this job triggers, verbatim"),
  requiredKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()).describe('Required keywords with no support anywhere in the CV'),
  recommendation: z.enum(['apply', 'consider', 'skip']),
  rationale: z.string().describe('2-4 sentences explaining the recommendation'),
  interviewPrep: z.object({
    likelyQuestions: z.array(z.string()),
    talkingPoints: z.array(z.string()),
    stories: z.array(Story).describe('STAR+R stories built only from facts in the CV'),
  }),
  questionsToAsk: z.array(z.string()).describe('Thoughtful questions the candidate could ask the interviewer'),
  language: z.enum(['en', 'de']).describe('Language of the job description'),
});

export type EvaluationOutput = z.infer<typeof EvaluationOutputSchema>;

export type JobEvaluation = EvaluationOutput & {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeCap?: string;
  weightsUsed: Record<string, number>;
  model: string;
  promptVersion: string;
  evaluatedAt: string;
};

/** What the model returns when tailoring an application. */
export const TailoringOutputSchema = z.object({
  headline: z.string().describe('Role-specific headline under the name, e.g. "AI Engineer · Agentic Systems"'),
  summary: z.string().describe('3-4 sentence professional summary tailored to this role'),
  skills: z.array(z.string()).describe("Skills from the candidate's CV, most relevant first. Never add skills not in the CV."),
  experience: z
    .array(
      z.object({
        company: z.string().describe('Company name exactly as written in the CV'),
        bullets: z.array(z.string()),
      })
    )
    .describe('Rewritten bullets per CV experience entry'),
  projects: z.array(z.string()).describe('Names of CV projects to show, most relevant first, exactly as written in the CV'),
  coverLetter: z.object({
    greeting: z.string(),
    paragraphs: z.array(z.string()).describe('3-4 paragraphs, specific to the company and role'),
    closing: z.string(),
  }),
  keywordsCovered: z.array(z.string()).describe('JD keywords the tailored CV now honestly covers'),
  honestyNotes: z
    .array(z.string())
    .describe('Requirements the candidate does not meet and should address honestly rather than overstate'),
});

export type TailoringOutput = z.infer<typeof TailoringOutputSchema>;

export type TailoredContent = TailoringOutput & {
  groundingWarnings: string[];
  model: string;
  promptVersion: string;
  tailoredAt: string;
};

/** Extracting a structured posting from an arbitrary careers page. */
export const ExtractedJobSchema = z.object({
  isJobPosting: z.boolean().describe('False if the page is not a single job posting'),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  remote: z.enum(['remote', 'hybrid', 'onsite', 'unknown']),
  description: z.string().describe('The full job description as clean plain text, preserving sections and bullet points'),
});

export type ExtractedJob = z.infer<typeof ExtractedJobSchema>;
