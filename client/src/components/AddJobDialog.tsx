import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '../api/client';
import { Button, ErrorNote, Field, Tabs } from './ui';
import { inputCls } from '../lib/styles';

/** Add a job by posting URL (Greenhouse/Lever/Ashby/any careers page) or pasted description. */
export default function AddJobDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');

  const importJob = useMutation({
    mutationFn: () => (mode === 'url' ? api.importJob({ url: url.trim() }) : api.importJob({ text, title: title || undefined, company: company || undefined })),
    onSuccess: ({ application }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
      navigate(`/jobs/${application.id}`);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add a job">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold">Add a job</h2>
          <button onClick={onClose} aria-label="Close"><X className="size-4 text-slate-400" /></button>
        </div>
        <div className="space-y-4 p-5">
          <Tabs value={mode} onChange={setMode} tabs={[{ id: 'url', label: 'From URL' }, { id: 'text', label: 'Paste description' }]} />
          {mode === 'url' ? (
            <Field label="Posting URL" hint="Greenhouse, Lever and Ashby links use the official API; other careers pages are read via schema.org data or Claude.">
              <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://jobs.ashbyhq.com/company/…" autoFocus />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Title (optional)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
                <Field label="Company (optional)"><input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
              </div>
              <Field label="Job description" hint="If title or company is empty, Claude extracts them.">
                <textarea className={inputCls} rows={9} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
            </>
          )}
          <ErrorNote error={importJob.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={importJob.isPending} disabled={mode === 'url' ? !url.trim() : text.trim().length < 100} onClick={() => importJob.mutate()}>
              Add to pipeline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
