import { randomUUID } from 'crypto';
import { getDb } from './database';
import type { InterviewStory } from '../types/index';

type Row = Record<string, unknown>;

export function listStories(): InterviewStory[] {
  return (getDb().prepare('SELECT * FROM stories ORDER BY created_at DESC').all() as Row[]).map(rowToStory);
}

export function getStory(id: string): InterviewStory | undefined {
  const row = getDb().prepare('SELECT * FROM stories WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToStory(row) : undefined;
}

export function upsertStory(input: Omit<InterviewStory, 'id' | 'createdAt'> & { id?: string }): InterviewStory {
  const id = input.id ?? randomUUID();
  const existing = input.id ? getStory(input.id) : undefined;
  getDb()
    .prepare(
      `INSERT INTO stories (id, title, situation, task, action, result, reflection, tags, source_job_id, created_at)
       VALUES (@id, @title, @situation, @task, @action, @result, @reflection, @tags, @sourceJobId, @createdAt)
       ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, situation = excluded.situation, task = excluded.task, action = excluded.action,
        result = excluded.result, reflection = excluded.reflection, tags = excluded.tags`
    )
    .run({
      id,
      title: input.title,
      situation: input.situation,
      task: input.task,
      action: input.action,
      result: input.result,
      reflection: input.reflection,
      tags: JSON.stringify(input.tags ?? []),
      sourceJobId: input.sourceJobId ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  return getStory(id)!;
}

/**
 * Adds stories suggested by an evaluation, merging by title so the bank converges on a
 * small set of reusable master stories instead of growing a near-duplicate per job.
 */
export function mergeSuggestedStories(
  stories: Omit<InterviewStory, 'id' | 'createdAt'>[]
): { added: number; merged: number } {
  const existing = listStories();
  let added = 0;
  let merged = 0;
  for (const story of stories) {
    const match = existing.find((s) => normalize(s.title) === normalize(story.title));
    if (match) {
      const tags = Array.from(new Set([...match.tags, ...story.tags]));
      if (tags.length !== match.tags.length) {
        upsertStory({ ...match, tags });
        merged++;
      }
    } else {
      existing.push(upsertStory(story));
      added++;
    }
  }
  return { added, merged };
}

export function deleteStory(id: string): boolean {
  return getDb().prepare('DELETE FROM stories WHERE id = ?').run(id).changes > 0;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function rowToStory(r: Row): InterviewStory {
  return {
    id: r.id as string,
    title: r.title as string,
    situation: r.situation as string,
    task: r.task as string,
    action: r.action as string,
    result: r.result as string,
    reflection: r.reflection as string,
    tags: JSON.parse((r.tags as string) || '[]'),
    sourceJobId: (r.source_job_id as string) || undefined,
    createdAt: r.created_at as string,
  };
}
