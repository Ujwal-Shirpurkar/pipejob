import { useSSE } from '../hooks/useSSE.js';

export default function LiveFeed() {
  const { events, connected } = useSSE('/api/jobs/stream');

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        <h3 className="font-semibold text-sm text-gray-700">
          Live Feed {connected ? '(connected)' : '(reconnecting…)'}
        </h3>
      </div>
      <div className="overflow-y-auto max-h-48 space-y-1">
        {events.length === 0 && (
          <p className="text-xs text-gray-400">No events yet.</p>
        )}
        {events.map((ev, i) => {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(ev); } catch { /* raw */ }
          return (
            <div key={i} className="text-xs font-mono text-gray-600 border-b border-gray-50 pb-1">
              {parsed.ts ? `[${String(parsed.ts).substring(11, 19)}] ` : ''}
              {parsed.jobId ? `job:${String(parsed.jobId).substring(0, 8)}… ` : ''}
              {parsed.status ? String(parsed.status) : ev}
              {parsed.message ? ` — ${String(parsed.message)}` : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
