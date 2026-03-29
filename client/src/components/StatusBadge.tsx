import type { JobStatus } from '../types/index.js';

const STATUS_STYLES: Record<JobStatus, string> = {
  applied: 'bg-green-100 text-green-800',
  documents_ready: 'bg-blue-100 text-blue-800',
  analysed: 'bg-amber-100 text-amber-800',
  discovered: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-800',
  interview: 'bg-purple-100 text-purple-800',
  applying: 'bg-cyan-100 text-cyan-800',
  rejected: 'bg-red-200 text-red-900',
  skipped: 'bg-gray-200 text-gray-500',
};

interface Props {
  status: JobStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
