import { EventEmitter } from 'events';

export const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(100);

export function emitJobEvent(jobId: string, status: string, message?: string): void {
  jobEvents.emit('job_update', { jobId, status, message, ts: new Date().toISOString() });
}
