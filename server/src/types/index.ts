export interface MasterCV {
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  github?: string;
  location: string;
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  languages: { language: string; level: string }[];
}

export interface WorkExperience {
  company: string;
  role: string;
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

export interface DiscoveredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: 'linkedin' | 'indeed' | 'stepstone' | 'corporate' | 'manual';
  rawJD: string;
  discoveredAt: string;
  status: JobStatus;
}

export type JobStatus =
  | 'discovered'
  | 'analysed'
  | 'documents_ready'
  | 'applying'
  | 'applied'
  | 'rejected'
  | 'interview'
  | 'skipped'
  | 'error';

export interface JDAnalysis {
  jobId: string;
  matchScore: number;
  requiredKeywords: string[];
  missingKeywords: string[];
  suggestedSummary: string;
  tailoredBullets: Record<string, string[]>;
  coverLetterDraft: string;
  language: 'en' | 'de';
  analysedAt: string;
}

export interface TailoredOutput {
  jobId: string;
  cvPath: string;
  coverLetterPath: string;
  generatedAt: string;
  llmModel: string;
  promptVersion: string;
}

export interface JobApplication {
  id: string;
  job: DiscoveredJob;
  analysis?: JDAnalysis;
  output?: TailoredOutput;
  appliedAt?: string;
  statusHistory: { status: JobStatus; ts: string; note?: string }[];
  formFieldsUsed?: Record<string, string>;
  error?: string;
}
