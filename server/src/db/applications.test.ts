import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from './database';
import { getApplication, insertApplication, isDuplicate, listApplications, saveEvaluation, updateApplicationStatus } from './applications';
import { listStories, mergeSuggestedStories } from './stories';
import type { DiscoveredJob, JobEvaluation } from '../types/index';

function job(id: string, overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    id,
    title: `Role ${id}`,
    company: 'Acme',
    location: 'Berlin',
    url: `https://example.com/${id}`,
    source: 'ashby',
    rawJD: 'desc',
    discoveredAt: new Date().toISOString(),
    status: 'discovered',
    ...overrides,
  };
}

beforeEach(() => {
  initDb(':memory:');
});
afterEach(() => closeDb());

describe('applications repository', () => {
  it('deduplicates by URL', () => {
    expect(insertApplication(job('a'))).toBe(true);
    expect(insertApplication(job('b', { url: 'https://example.com/a' }))).toBe(false);
    expect(isDuplicate('https://example.com/a')).toBe(true);
    expect(listApplications()).toHaveLength(1);
  });

  it('records status history with the actor', () => {
    insertApplication(job('a'));
    updateApplicationStatus('a', 'skipped', 'Senior role', 'agent');
    const app = getApplication('a')!;
    expect(app.job.status).toBe('skipped');
    expect(app.statusHistory.at(-1)).toMatchObject({ status: 'skipped', note: 'Senior role', actor: 'agent' });
  });

  it('stores evaluations and sorts by score', () => {
    insertApplication(job('low'));
    insertApplication(job('high'));
    saveEvaluation('low', { grade: 'D', overallScore: 3.1 } as JobEvaluation);
    saveEvaluation('high', { grade: 'A', overallScore: 4.7 } as JobEvaluation);
    const sorted = listApplications({ sort: 'score' });
    expect(sorted.map((a) => a.id)).toEqual(['high', 'low']);
    expect(listApplications({ grade: ['A', 'B'] }).map((a) => a.id)).toEqual(['high']);
  });
});

describe('story bank', () => {
  it('merges suggested stories by title instead of duplicating them', () => {
    const story = { title: 'Shipping a RAG assistant', situation: 's', task: 't', action: 'a', result: 'r', reflection: 'x', tags: ['ownership'] };
    mergeSuggestedStories([story]);
    const second = mergeSuggestedStories([{ ...story, title: 'Shipping a RAG Assistant!', tags: ['llm'] }]);
    expect(second).toEqual({ added: 0, merged: 1 });
    const stories = listStories();
    expect(stories).toHaveLength(1);
    expect(stories[0].tags.sort()).toEqual(['llm', 'ownership']);
  });
});
