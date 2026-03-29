import axios from 'axios';
import type { JobApplication, JobStatus, MasterCV } from '../types/index.js';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const api = axios.create({ baseURL: BASE_URL });

export function getJobs(filters?: { status?: JobStatus; limit?: number }): Promise<JobApplication[]> {
  return api.get('/api/jobs', { params: filters }).then((r) => r.data);
}

export function getJob(id: string): Promise<JobApplication> {
  return api.get(`/api/jobs/${id}`).then((r) => r.data);
}

export function discoverJobs(body: { keywords: string[]; location: string; sources: string[] }) {
  return api.post('/api/jobs/discover', body).then((r) => r.data);
}

export function analyseJob(id: string) {
  return api.post(`/api/jobs/${id}/analyse`).then((r) => r.data);
}

export function generateDocuments(id: string) {
  return api.post(`/api/jobs/${id}/generate`).then((r) => r.data);
}

export function applyJob(id: string) {
  return api.post(`/api/jobs/${id}/apply`).then((r) => r.data);
}

export function updateJobStatus(id: string, status: JobStatus, note?: string) {
  return api.patch(`/api/jobs/${id}/status`, { status, note }).then((r) => r.data);
}

export function getMasterCV(): Promise<MasterCV> {
  return api.get('/api/cv').then((r) => r.data);
}

export function updateMasterCV(cv: MasterCV) {
  return api.post('/api/cv', cv).then((r) => r.data);
}

export const downloadUrl = (jobId: string, type: 'cv' | 'cover-letter') =>
  `${BASE_URL}/api/cv/download/${jobId}/${type}`;
