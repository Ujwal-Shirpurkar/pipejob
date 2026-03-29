import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getJobs, analyseJob, generateDocuments, applyJob, discoverJobs } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.js';
import LiveFeed from '../components/LiveFeed.js';
import type { JobApplication } from '../types/index.js';

const SOURCES = ['indeed', 'stepstone'] as const;

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

  // Discover form state
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>(['indeed']);
  const [location, setLocation] = useState('Deutschland');
  const [discoverResult, setDiscoverResult] = useState<{ discovered: number } | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => getJobs(),
    refetchInterval: 30000,
  });

  const discoverMutation = useMutation({
    mutationFn: () => discoverJobs({ keywords, sources: selectedSources, location }),
    onSuccess: (data) => {
      setDiscoverResult(data as { discovered: number });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
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

  function addKeyword() {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) setKeywords([...keywords, kw]);
    setKeywordInput('');
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw));
  }

  function toggleSource(s: string) {
    setSelectedSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

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

      {/* Discover Jobs Panel */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Discover Jobs</h2>
        <div className="space-y-3">
          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Keywords</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="e.g. TypeScript developer"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              />
              <button
                onClick={addKeyword}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {keywords.map((kw) => (
                  <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 font-bold">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Deutschland"
              />
            </div>

            {/* Sources */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sources</label>
              <div className="flex gap-3">
                {SOURCES.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(s)}
                      onChange={() => toggleSource(s)}
                      className="rounded"
                    />
                    <span className="capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => discoverMutation.mutate()}
              disabled={discoverMutation.isPending || keywords.length === 0 || selectedSources.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {discoverMutation.isPending ? 'Discovering… (this takes 20–40s)' : 'Discover Jobs'}
            </button>
            {discoverResult && !discoverMutation.isPending && (
              <span className="text-sm text-green-600 font-medium">
                ✓ Found {discoverResult.discovered} new job{discoverResult.discovered !== 1 ? 's' : ''}
              </span>
            )}
            {discoverMutation.isError && (
              <span className="text-sm text-red-500">
                Discovery failed — check server logs
              </span>
            )}
          </div>
        </div>
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
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No applications yet. Use "Discover Jobs" above to find jobs.
                  </td>
                </tr>
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
