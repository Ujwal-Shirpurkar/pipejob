import { Bot, User } from 'lucide-react';
import { STATUS_LABEL } from '../lib/format';
import type { Grade, JobStatus } from '../types/index';
import { cx } from '../lib/styles';

// Grades are always shown as a letter; colour only reinforces it.
const GRADE_STYLE: Record<Grade, string> = {
  A: 'bg-emerald-600 text-white',
  B: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300',
  C: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300',
  D: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300',
  F: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-300',
};

export function GradeBadge({ grade, score, size = 'md' }: { grade?: Grade; score?: number; size?: 'sm' | 'md' | 'lg' }) {
  if (!grade) return <span className="text-xs text-slate-400">—</span>;
  const dims = { sm: 'size-6 text-xs', md: 'size-8 text-sm', lg: 'size-14 text-2xl' }[size];
  return (
    <span className="inline-flex items-center gap-1.5" title={score !== undefined ? `${score.toFixed(2)} / 5` : undefined}>
      <span className={cx('inline-flex items-center justify-center rounded-lg font-bold', dims, GRADE_STYLE[grade])}>{grade}</span>
      {score !== undefined && size !== 'sm' && <span className="text-xs tabular-nums text-slate-500">{score.toFixed(1)}</span>}
    </span>
  );
}

const STATUS_STYLE: Record<JobStatus, string> = {
  discovered: 'bg-slate-100 text-slate-700',
  evaluated: 'bg-blue-50 text-blue-700',
  documents_ready: 'bg-violet-50 text-violet-700',
  applied: 'bg-emerald-50 text-emerald-700',
  interview: 'bg-amber-50 text-amber-800',
  offer: 'bg-emerald-600 text-white',
  rejected: 'bg-red-50 text-red-700',
  skipped: 'bg-slate-100 text-slate-500',
  error: 'bg-red-50 text-red-700',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[status] ?? STATUS_STYLE.discovered)}>{STATUS_LABEL[status] ?? status}</span>;
}

export function ActorIcon({ actor }: { actor?: 'human' | 'agent' | 'system' }) {
  if (actor === 'agent') return <Bot className="size-3.5 text-violet-500" aria-label="agent" />;
  if (actor === 'human') return <User className="size-3.5 text-blue-500" aria-label="you" />;
  return null;
}

export function RecommendationBadge({ value }: { value: 'apply' | 'consider' | 'skip' }) {
  const style = { apply: 'bg-emerald-50 text-emerald-700 ring-emerald-200', consider: 'bg-amber-50 text-amber-800 ring-amber-200', skip: 'bg-slate-100 text-slate-600 ring-slate-200' }[value];
  const label = { apply: 'Recommend: apply', consider: 'Recommend: consider', skip: 'Recommend: skip' }[value];
  return <span className={cx('inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', style)}>{label}</span>;
}
