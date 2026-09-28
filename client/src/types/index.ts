// Mirrors server/src/types — keep in sync.

export type JobStatus =
  | 'discovered'
  | 'evaluated'
  | 'documents_ready'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'skipped'
  | 'error';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export type JobSource = 'greenhouse' | 'lever' | 'ashby' | 'arbeitnow' | 'stepstone' | 'indeed' | 'linkedin' | 'corporate' | 'manual';

export interface DiscoveredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  applyUrl?: string;
  source: JobSource;
  rawJD: string;
  remote?: boolean | null;
  postedAt?: string;
  discoveredAt: string;
  status: JobStatus;
}

export const DIMENSIONS = [
  { key: 'skills_match', label: 'Skills match' },
  { key: 'experience_level_fit', label: 'Level fit' },
  { key: 'role_alignment', label: 'Role alignment' },
  { key: 'location_fit', label: 'Location & language' },
  { key: 'growth_potential', label: 'Growth potential' },
  { key: 'company_signal', label: 'Company signal' },
  { key: 'compensation_fit', label: 'Compensation' },
  { key: 'legitimacy', label: 'Legitimacy' },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]['key'];

export interface Story {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  tags: string[];
  sourceJobId?: string;
  createdAt: string;
}

export interface JobEvaluation {
  archetype: string;
  roleSummary: {
    oneLiner: string;
    seniority: string;
    employmentType: string;
    location: string;
    remotePolicy: 'remote' | 'hybrid' | 'onsite' | 'unknown';
    languageRequirements: string[];
    compensation: string;
  };
  dimensions: Record<DimensionKey, { score: number; evidence: string }>;
  strengths: string[];
  gaps: string[];
  redFlags: string[];
  dealBreakersHit: string[];
  requiredKeywords: string[];
  missingKeywords: string[];
  recommendation: 'apply' | 'consider' | 'skip';
  rationale: string;
  interviewPrep: {
    likelyQuestions: string[];
    talkingPoints: string[];
    stories: Omit<Story, 'id' | 'createdAt'>[];
  };
  questionsToAsk: string[];
  language: 'en' | 'de';
  overallScore: number;
  grade: Grade;
  gradeCap?: string;
  weightsUsed: Record<DimensionKey, number>;
  model: string;
  promptVersion: string;
  evaluatedAt: string;
}

export interface TailoredContent {
  headline: string;
  summary: string;
  skills: string[];
  experience: { company: string; bullets: string[] }[];
  projects: string[];
  coverLetter: { greeting: string; paragraphs: string[]; closing: string };
  keywordsCovered: string[];
  honestyNotes: string[];
  groundingWarnings: string[];
  model: string;
  promptVersion: string;
  tailoredAt: string;
}

export interface TailoredOutput {
  jobId: string;
  cvPath: string;
  coverLetterPath: string;
  generatedAt: string;
  llmModel: string;
  promptVersion: string;
}

export interface StatusHistoryEntry {
  status: JobStatus;
  ts: string;
  note?: string;
  actor?: 'human' | 'agent' | 'system';
}

export interface JobApplication {
  id: string;
  job: DiscoveredJob;
  evaluation?: JobEvaluation;
  tailoring?: TailoredContent;
  output?: TailoredOutput;
  score?: number;
  grade?: Grade;
  reviewRequested: boolean;
  reviewNote?: string;
  approvedAt?: string;
  appliedAt?: string;
  notes?: string;
  statusHistory: StatusHistoryEntry[];
  error?: string;
  updatedAt?: string;
}

export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentRun {
  id: string;
  goal: string;
  trigger: 'user' | 'autopilot' | 'webhook';
  status: AgentRunStatus;
  model: string;
  turns: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  summary?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface AgentStep {
  id: number;
  runId: string;
  seq: number;
  turn: number;
  type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'error' | 'final';
  toolName?: string;
  toolUseId?: string;
  content: string;
  data?: unknown;
  isError?: boolean;
  durationMs?: number;
  ts: string;
}

export interface WorkExperience {
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  bullets: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
}

export interface Project {
  name: string;
  description: string;
  tech: string[];
  url?: string;
}

export interface MasterCV {
  fullName: string;
  headline?: string;
  email: string;
  phone: string;
  linkedin: string;
  github?: string;
  website?: string;
  location: string;
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  projects?: Project[];
  education: Education[];
  languages: { language: string; level: string }[];
  certifications?: string[];
}

export interface Preferences {
  targetRoles: string[];
  targetArchetypes: string[];
  seniority: string[];
  locations: string[];
  remotePreference: 'remote_only' | 'hybrid_or_remote' | 'any';
  mustHaves: string[];
  niceToHaves: string[];
  dealBreakers: string[];
  salaryExpectation?: string;
  workAuthorization?: string;
  minGradeToTailor: Grade;
  scoringWeights: Record<DimensionKey, number>;
  search: { keywords: string[]; location: string; sources: string[] };
  autopilotGoal: string;
}

export interface PortalCompany {
  name: string;
  ats: 'greenhouse' | 'lever' | 'ashby';
  slug: string;
  tags?: string[];
}

export interface SystemInfo {
  llmConfigured: boolean;
  model: string;
  agentEffort: string;
  evalEffort: string;
  agentLimits: { maxTurns: number; maxEvaluations: number; maxTailored: number };
  limits: { maxJobsPerSearch: number; maxApplicationsPerDay: number };
  autopilotCron: string | null;
  notificationsConfigured: boolean;
  portals: PortalCompany[];
}

export interface LlmUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  byPurpose: { purpose: string; calls: number; costUsd: number; avgLatencyMs: number }[];
}

export interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byGrade: Record<Grade, number>;
  byArchetype: Record<string, number>;
  bySource: Record<string, number>;
  funnel: { stage: string; count: number }[];
  reviewQueue: number;
  averageScore: number | null;
  budget: { used: number; limit: number; remaining: number };
  llm: { allTime: LlmUsage; last7Days: LlmUsage };
  recentRuns: AgentRun[];
}

export type AppEvent =
  | { type: 'connected'; ts: string }
  | { type: 'job_update'; jobId: string; status: string; message?: string; ts: string }
  | { type: 'agent_step'; runId: string; step: AgentStep; ts: string }
  | { type: 'agent_run'; run: AgentRun; ts: string };
