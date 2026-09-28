import { EventEmitter } from 'events';
import type { AgentRun, AgentStep } from './types/index';

export type AppEvent =
  | { type: 'job_update'; jobId: string; status: string; message?: string; ts: string }
  | { type: 'agent_step'; runId: string; step: AgentStep; ts: string }
  | { type: 'agent_run'; run: AgentRun; ts: string };

export const appEvents = new EventEmitter();
appEvents.setMaxListeners(100);

type WithoutTs<T> = T extends unknown ? Omit<T, 'ts'> & { ts?: string } : never;

export function emitEvent(event: WithoutTs<AppEvent>): void {
  appEvents.emit('event', { ...event, ts: event.ts ?? new Date().toISOString() });
}

export function emitJobEvent(jobId: string, status: string, message?: string): void {
  emitEvent({ type: 'job_update', jobId, status, message });
}
