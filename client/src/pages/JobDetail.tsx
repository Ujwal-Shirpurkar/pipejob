import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getJob, analyseJob, generateDocuments, applyJob, updateJobStatus, downloadUrl } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.js';
import type { JobStatus } from '../types/index.js';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: app, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => getJob(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job', id] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const analyseMutation = useMutation({ mutationFn: () => analyseJob(id!), onSuccess: invalidate });
  const generateMutation = useMutation({ mutationFn: () => generateDocuments(id!), onSuccess: invalidate });
  const applyMutation = useMutation({ mutationFn: () => applyJob(id!), onSuccess: invalidate });
  const skipMutation = useMutation({
    mutationFn: () => updateJobStatus(id!, 'skipped' as JobStatus),
    onSuccess: invalidate,
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!app) return <div className="p-8 text-red-500">Application not found.</div>;

  const { job, analysis, output, statusHistory } = app;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:underline mb-1">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-gray-500">{job.company} — {job.location}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {job.status === 'discovered' && (
          <button onClick={() => analyseMutation.mutate()} disabled={analyseMutation.isPending}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50 text-sm">
            Analyse JD
          </button>
        )}
        {job.status === 'analysed' && (
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm">
            Generate Documents
          </button>
        )}
        {job.status === 'documents_ready' && (
          <button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm">
            Apply Now
          </button>
        )}
        {!['skipped', 'applied', 'rejected'].includes(job.status) && (
          <button onClick={() => skipMutation.mutate()} disabled={skipMutation.isPending}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-sm">
            Skip
          </button>
        )}
        {output && (
          <>
            <a href={downloadUrl(job.id, 'cv')} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm">
              Download CV
            </a>
            <a href={downloadUrl(job.id, 'cover-letter')} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-indigo-400 text-white rounded hover:bg-indigo-500 text-sm">
              Download Cover Letter
            </a>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis */}
        {analysis && (
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">LLM Analysis</h2>
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Match Score</span>
                <span className="font-bold">{analysis.matchScore}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${analysis.matchScore >= 70 ? 'bg-green-500' : analysis.matchScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${analysis.matchScore}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Required Keywords</p>
              <div className="flex flex-wrap gap-1">
                {analysis.requiredKeywords.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">{kw}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Missing Keywords</p>
              <div className="flex flex-wrap gap-1">
                {analysis.missingKeywords.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">{kw}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Suggested Summary</p>
              <p className="text-sm text-gray-700">{analysis.suggestedSummary}</p>
            </div>
          </div>
        )}

        {/* Status History */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Status History</h2>
          <ol className="relative border-l border-gray-200 space-y-4 ml-3">
            {[...statusHistory].reverse().map((entry, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                <p className="text-xs text-gray-400">
                  {format(new Date(entry.ts), 'dd MMM yyyy HH:mm')}
                </p>
                <p className="text-sm font-medium text-gray-700">{entry.status}</p>
                {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Raw JD */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Job Description</h2>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto font-sans leading-relaxed">
          {job.rawJD || 'No description available.'}
        </pre>
      </div>
    </div>
  );
}
