import type { JobEvaluation, TailoredContent } from '../services/evaluation/schema';

export type { JobEvaluation, TailoredContent };

// ─── Candidate profile ──────────────────────────────────────────────────────

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

export interface WorkExperience {
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  bullets: string[];
}

export interface Project {
  name: string;
  description: string;
  tech: string[];
  url?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export const DIMENSION_KEYS = [
  'skills_match',
  'experience_level_fit',
  'role_alignment',
  'location_fit',
  'growth_potential',
  'company_signal',
  'compensation_fit',
  'legitimacy',
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

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
  search: {
    keywords: string[];
    location: string;
    sources: string[];
  };
  autopilotGoal: string;
}

// ─── Jobs & applications ────────────────────────────────────────────────────

export type JobSource =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'arbeitnow'
  | 'stepstone'
  | 'indeed'
  | 'linkedin'
  | 'corporate'
  | 'manual';

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

export const JOB_STATUSES: JobStatus[] = [
  'discovered',
  'evaluated',
  'documents_ready',
  'applied',
  'interview',
  'offer',
  'rejected',
  'skipped',
  'error',
];

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
  formFieldsUsed?: Record<string, string>;
  error?: string;
  updatedAt?: string;
}

// ─── Agent runs ─────────────────────────────────────────────────────────────

export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentTrigger = 'user' | 'autopilot' | 'webhook';

export type AgentStepType = 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'error' | 'final';

export interface AgentStep {
  id: number;
  runId: string;
  seq: number;
  turn: number;
  type: AgentStepType;
  toolName?: string;
  toolUseId?: string;
  content: string;
  data?: unknown;
  isError?: boolean;
  durationMs?: number;
  ts: string;
}

export interface AgentRun {
  id: string;
  goal: string;
  trigger: AgentTrigger;
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

// ─── Interview story bank ───────────────────────────────────────────────────

export interface InterviewStory {
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

// ─── LLM telemetry ──────────────────────────────────────────────────────────

export type LlmPurpose = 'agent' | 'evaluate' | 'tailor' | 'extract';

export interface LlmCallRecord {
  purpose: LlmPurpose;
  model: string;
  jobId?: string;
  runId?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  latencyMs: number;
  stopReason?: string | null;
}
