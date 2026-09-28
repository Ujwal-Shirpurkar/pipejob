import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { Button, Card, Chip, ChipInput, Empty, ErrorNote, Field, PageHeader, Spinner } from '../components/ui';
import { inputCls } from '../lib/styles';
import type { Story } from '../types/index';

type Draft = Omit<Story, 'id' | 'createdAt'>;
const EMPTY: Draft = { title: '', situation: '', task: '', action: '', result: '', reflection: '', tags: [] };
const PARTS = [
  ['situation', 'Situation'],
  ['task', 'Task'],
  ['action', 'Action'],
  ['result', 'Result'],
  ['reflection', 'Reflection'],
] as const;

function StoryEditor({ initial, onSave, onCancel, saving, error }: { initial: Draft; onSave: (d: Draft) => void; onCancel: () => void; saving: boolean; error: unknown }) {
  const [draft, setDraft] = useState(initial);
  return (
    <div className="space-y-3">
      <Field label="Title"><input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
      {PARTS.map(([k, label]) => (
        <Field key={k} label={label}><textarea rows={2} className={inputCls} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></Field>
      ))}
      <Field label="Competencies"><ChipInput values={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} /></Field>
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={saving} disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Save story</Button>
      </div>
    </div>
  );
}

export default function Stories() {
  const queryClient = useQueryClient();
  const { data: stories = [], isLoading } = useQuery({ queryKey: ['stories'], queryFn: api.stories });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['stories'] });

  const save = useMutation({
    mutationFn: (d: Draft) => (editing === 'new' ? api.createStory(d) : api.updateStory(editing!, d)),
    onSuccess: () => { invalidate(); setEditing(null); },
  });
  const remove = useMutation({ mutationFn: api.deleteStory, onSuccess: invalidate });

  const tags = Array.from(new Set(stories.flatMap((s) => s.tags))).sort();
  const visible = tag ? stories.filter((s) => s.tags.includes(tag)) : stories;

  return (
    <div>
      <PageHeader
        title="Story bank"
        subtitle="Reusable STAR + Reflection stories, built from your CV as jobs are evaluated. Aim for 5–10 strong stories that can answer most behavioural questions."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>New story</Button>}
      />
      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button onClick={() => setTag(null)}><Chip tone={tag === null ? 'blue' : 'slate'}>All</Chip></button>
          {tags.map((t) => <button key={t} onClick={() => setTag(t === tag ? null : t)}><Chip tone={tag === t ? 'blue' : 'slate'}>{t}</Chip></button>)}
        </div>
      )}
      {editing === 'new' && <Card className="mb-4" title="New story"><StoryEditor initial={EMPTY} onSave={(d) => save.mutate(d)} onCancel={() => setEditing(null)} saving={save.isPending} error={save.error} /></Card>}
      {isLoading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Card><Empty icon={<BookOpen className="size-10" />} title="No stories yet">Evaluating jobs suggests stories automatically, or write your own.</Empty></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((s) => (
            <Card key={s.id}>
              {editing === s.id ? (
                <StoryEditor initial={s} onSave={(d) => save.mutate(d)} onCancel={() => setEditing(null)} saving={save.isPending} error={save.error} />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{s.title}</h3>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(s.id)} aria-label="Edit" />
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => confirm('Delete this story?') && remove.mutate(s.id)} aria-label="Delete" />
                    </div>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    {PARTS.map(([k, label]) => s[k] && (
                      <div key={k}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                        <dd className="text-slate-700">{s[k]}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {s.tags.map((t) => <Chip key={t}>{t}</Chip>)}
                    {s.sourceJobId && <Link to={`/jobs/${s.sourceJobId}`} className="ml-auto text-xs text-blue-600 hover:underline">from evaluation →</Link>}
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
