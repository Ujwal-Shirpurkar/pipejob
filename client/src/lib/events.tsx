import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AgentRun, AgentStep, AppEvent } from '../types/index';

interface JobEventItem {
  jobId: string;
  status: string;
  message?: string;
  ts: string;
}

interface EventsState {
  connected: boolean;
  jobEvents: JobEventItem[];
}

const EventsContext = createContext<EventsState>({ connected: false, jobEvents: [] });

/**
 * One SSE connection for the whole app. Events keep React Query caches fresh so every
 * page updates live — including the agent trace, which receives steps as they happen.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<EventsState>({ connected: false, jobEvents: [] });

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      es = new EventSource(api.eventsUrl);
      es.onopen = () => setState((s) => ({ ...s, connected: true }));
      es.onerror = () => {
        setState((s) => ({ ...s, connected: false }));
        es?.close();
        if (!closed) retry = setTimeout(connect, 3000);
      };
      es.onmessage = (e: MessageEvent<string>) => {
        let event: AppEvent;
        try {
          event = JSON.parse(e.data) as AppEvent;
        } catch {
          return;
        }
        if (event.type === 'job_update') {
          setState((s) => ({ ...s, jobEvents: [{ jobId: event.jobId, status: event.status, message: event.message, ts: event.ts }, ...s.jobEvents].slice(0, 50) }));
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.invalidateQueries({ queryKey: ['job', event.jobId] });
          queryClient.invalidateQueries({ queryKey: ['stats'] });
          queryClient.invalidateQueries({ queryKey: ['stories'] });
        } else if (event.type === 'agent_step') {
          queryClient.setQueryData<{ run: AgentRun; steps: AgentStep[] }>(['run', event.runId], (prev) =>
            prev && !prev.steps.some((s) => s.id === event.step.id) ? { ...prev, steps: [...prev.steps, event.step] } : prev
          );
        } else if (event.type === 'agent_run') {
          queryClient.setQueryData<{ run: AgentRun; steps: AgentStep[] }>(['run', event.run.id], (prev) => (prev ? { ...prev, run: event.run } : prev));
          queryClient.invalidateQueries({ queryKey: ['runs'] });
          if (event.run.status !== 'running') queryClient.invalidateQueries({ queryKey: ['stats'] });
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      es?.close();
    };
  }, [queryClient]);

  return <EventsContext.Provider value={state}>{children}</EventsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEvents(): EventsState {
  return useContext(EventsContext);
}
