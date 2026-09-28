import type {
  AgentRun,
  AgentStep,
  Grade,
  JobApplication,
  JobEvaluation,
  JobStatus,
  MasterCV,
  Preferences,
  Stats,
  Story,
  SystemInfo,
  TailoredContent,
} from '../types/index';

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body);

function query(params: Record<string, string | number | boolean | undefined | string[]>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const api = {
  system: () => get<SystemInfo>('/api/system'),
  stats: () => get<Stats>('/api/stats'),

  jobs: (filters: { status?: JobStatus[]; grade?: Grade[]; review?: boolean; search?: string; sort?: 'recent' | 'score'; limit?: number } = {}) =>
    get<JobApplication[]>(`/api/jobs${query(filters)}`),
  job: (id: string) => get<JobApplication>(`/api/jobs/${id}`),
  budget: () => get<{ used: number; limit: number; remaining: number }>('/api/jobs/budget'),
  searchJobs: (body: { keywords: string[]; location?: string; remoteOnly?: boolean; limit?: number }) =>
    post<{ scanned: number; sourcesQueried: number; newCount: number; sourceErrors: { source: string; error: string }[]; results: { id: string; title: string; company: string; isNew: boolean }[] }>(
      '/api/jobs/search',
      body
    ),
  importJob: (body: { url: string } | { text: string; title?: string; company?: string; location?: string }) =>
    post<{ application: JobApplication; isNew: boolean }>('/api/jobs/import', body),
  evaluate: (id: string) => post<JobEvaluation>(`/api/jobs/${id}/evaluate`),
  tailor: (id: string) => post<TailoredContent>(`/api/jobs/${id}/tailor`),
  approve: (id: string) => post<JobApplication>(`/api/jobs/${id}/approve`),
  markApplied: (id: string, note?: string) => post<JobApplication>(`/api/jobs/${id}/applied`, { note }),
  skip: (id: string, reason?: string) => post<JobApplication>(`/api/jobs/${id}/skip`, { reason }),
  setStatus: (id: string, status: JobStatus, note?: string) => request<JobApplication>('PATCH', `/api/jobs/${id}/status`, { status, note }),
  setNotes: (id: string, notes: string) => request<{ saved: true }>('PATCH', `/api/jobs/${id}/notes`, { notes }),
  deleteJob: (id: string) => request<void>('DELETE', `/api/jobs/${id}`),
  documentUrl: (id: string, type: 'cv' | 'cover-letter', download = false) =>
    `${BASE_URL}/api/jobs/${id}/documents/${type}${download ? '?download=1' : ''}`,

  runs: () => get<AgentRun[]>('/api/agent/runs'),
  run: (id: string) => get<{ run: AgentRun; steps: AgentStep[] }>(`/api/agent/runs/${id}`),
  startRun: (goal: string) => post<AgentRun>('/api/agent/runs', { goal }),
  cancelRun: (id: string) => post<{ cancelled: true }>(`/api/agent/runs/${id}/cancel`),

  cv: () => get<MasterCV>('/api/profile/cv'),
  saveCv: (cv: MasterCV) => request<MasterCV>('PUT', '/api/profile/cv', cv),
  preferences: () => get<Preferences>('/api/profile/preferences'),
  savePreferences: (p: Preferences) => request<Preferences>('PUT', '/api/profile/preferences', p),

  stories: () => get<Story[]>('/api/stories'),
  createStory: (s: Omit<Story, 'id' | 'createdAt'>) => post<Story>('/api/stories', s),
  updateStory: (id: string, s: Omit<Story, 'id' | 'createdAt'>) => request<Story>('PUT', `/api/stories/${id}`, s),
  deleteStory: (id: string) => request<void>('DELETE', `/api/stories/${id}`),

  eventsUrl: `${BASE_URL}/api/events`,
};
