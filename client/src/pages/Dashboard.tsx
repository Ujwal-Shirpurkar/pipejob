import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getJobs, analyseJob, generateDocuments, applyJob } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.js';
import LiveFeed from '../components/LiveFeed.js';
import type { JobApplication } from '../types/index.js';

function scoreBadge(score: number | undefined) {
  if (score === undefined) return <span className="text-gray-400 text-xs">—</span>;
  const cls =
    score >= 70 ? 'bg-green-100 text-green-800' :
    score >= 50 ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {score}
    </span>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => getJobs(),
    refetchInterval: 30000,
  });

  const analyseMutation = useMutation({
    mutationFn: analyseJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const generateMutation = useMutation({
    mutationFn: generateDocuments,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const applyMutation = useMutation({
    mutationFn: applyJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const total = jobs.length;
  const appliedToday = jobs.filter((j: JobApplication) => {
    if (!j.appliedAt) return false;
    const today = new Date().toISOString().split('T')[0];
    return j.appliedAt.startsWith(today);
  }).length;
  const docsReady = jobs.filter((j: JobApplication) => j.job.status === 'documents_ready').length;
  const interviews = jobs.filter((j: JobApplication) => j.job.status === 'interview').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Discovered', value: total },
          { label: 'Applied Today', value: appliedToday },
          { label: 'Docs Ready', value: docsReady },
          { label: 'Interviews', value: interviews },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Company', 'Role', 'Source', 'Score', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {jobs.map((app: JobApplication) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/jobs/${app.id}`} className="hover:underline text-blue-600">
                      {app.job.company}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{app.job.title}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{app.job.source}</td>
                  <td className="px-4 py-3">{scoreBadge(app.analysis?.matchScore)}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.job.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {app.job.status === 'discovered' && (
                        <button
                          onClick={() => analyseMutation.mutate(app.id)}
                          disabled={analyseMutation.isPending}
                          className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                        >
                          Analyse
                        </button>
                      )}
                      {app.job.status === 'analysed' && (
                        <button
                          onClick={() => generateMutation.mutate(app.id)}
                          disabled={generateMutation.isPending}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          Generate
                        </button>
                      )}
                      {app.job.status === 'documents_ready' && (
                        <button
                          onClick={() => applyMutation.mutate(app.id)}
                          disabled={applyMutation.isPending}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && jobs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No applications yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Live Feed */}
        <div>
          <LiveFeed />
        </div>
      </div>
    </div>
  );
}
