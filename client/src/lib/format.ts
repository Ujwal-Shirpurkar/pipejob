import { formatDistanceToNowStrict } from 'date-fns';
import type { Grade, JobStatus } from '../types/index';

export const STATUS_LABEL: Record<JobStatus, string> = {
  discovered: 'Discovered',
  evaluated: 'Evaluated',
  documents_ready: 'Docs ready',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  skipped: 'Skipped',
  error: 'Error',
};

export const PIPELINE_COLUMNS: JobStatus[] = ['discovered', 'evaluated', 'documents_ready', 'applied', 'interview', 'offer'];

export const ARCHETYPE_LABEL: Record<string, string> = {
  agentic_ai: 'Agentic AI',
  llm_applications: 'LLM applications',
  ml_engineering: 'ML engineering',
  mlops_llmops: 'MLOps / LLMOps',
  data_science: 'Data science',
  backend: 'Backend',
  fullstack: 'Full-stack',
  frontend: 'Frontend',
  devops_cloud: 'DevOps / Cloud',
  product: 'Product',
  research: 'Research',
  other: 'Other',
};

export const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F'];

export function ago(iso?: string): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function usd(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—';
  if (n === 0) return '$0.00';
  return n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`;
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function duration(startIso: string, endIso?: string): string {
  const ms = (endIso ? new Date(endIso).getTime() : Date.now()) - new Date(startIso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
