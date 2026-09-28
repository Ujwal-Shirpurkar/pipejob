import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { Button, Card, ChipInput, ErrorNote, Field, PageHeader, Spinner, Tabs } from '../components/ui';
import { inputCls } from '../lib/styles';
import { ARCHETYPE_LABEL, GRADE_ORDER } from '../lib/format';
import { DIMENSIONS, type Grade, type MasterCV, type Preferences } from '../types/index';

function Remove({ onClick }: { onClick: () => void }) {
  return <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={onClick} aria-label="Remove" />;
}

function CvEditor({ initial }: { initial: MasterCV }) {
  const queryClient = useQueryClient();
  const [cv, setCv] = useState(initial);
  const save = useMutation({ mutationFn: () => api.saveCv(cv), onSuccess: (d) => queryClient.setQueryData(['cv'], d) });
  const set = <K extends keyof MasterCV>(k: K, v: MasterCV[K]) => setCv({ ...cv, [k]: v });
  const text = (label: string, k: 'fullName' | 'headline' | 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website') => (
    <Field label={label}><input className={inputCls} value={cv[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></Field>
  );

  return (
    <div className="space-y-5">
      <Card title="Personal information">
        <div className="grid gap-4 md:grid-cols-2">
          {text('Full name', 'fullName')}
          {text('Headline', 'headline')}
          {text('Email', 'email')}
          {text('Phone', 'phone')}
          {text('Location', 'location')}
          {text('LinkedIn URL', 'linkedin')}
          {text('GitHub URL', 'github')}
          {text('Website', 'website')}
        </div>
        <div className="mt-4"><Field label="Professional summary"><textarea rows={3} className={inputCls} value={cv.summary} onChange={(e) => set('summary', e.target.value)} /></Field></div>
      </Card>

      <Card title="Skills"><ChipInput values={cv.skills} onChange={(v) => set('skills', v)} placeholder="Add a skill and press Enter" /></Card>

      <Card title="Experience" action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => set('experience', [...cv.experience, { company: '', role: '', startDate: '', bullets: [] }])}>Add</Button>}>
        <div className="space-y-4">
          {cv.experience.map((exp, i) => {
            const upd = (patch: Partial<typeof exp>) => set('experience', cv.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)));
            return (
              <div key={i} className="rounded-lg p-4 ring-1 ring-slate-200">
                <div className="grid gap-3 md:grid-cols-5">
                  <Field label="Role"><input className={inputCls} value={exp.role} onChange={(e) => upd({ role: e.target.value })} /></Field>
                  <Field label="Company"><input className={inputCls} value={exp.company} onChange={(e) => upd({ company: e.target.value })} /></Field>
                  <Field label="Location"><input className={inputCls} value={exp.location ?? ''} onChange={(e) => upd({ location: e.target.value || undefined })} /></Field>
                  <Field label="Start (YYYY-MM)"><input className={inputCls} value={exp.startDate} onChange={(e) => upd({ startDate: e.target.value })} /></Field>
                  <Field label="End (blank = present)"><input className={inputCls} value={exp.endDate ?? ''} onChange={(e) => upd({ endDate: e.target.value || undefined })} /></Field>
                </div>
                <div className="mt-3"><Field label="Achievements (one per line)"><textarea rows={4} className={inputCls} value={exp.bullets.join('\n')} onChange={(e) => upd({ bullets: e.target.value.split('\n') })} /></Field></div>
                <div className="mt-2 flex justify-end"><Remove onClick={() => set('experience', cv.experience.filter((_, j) => j !== i))} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Projects" action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => set('projects', [...(cv.projects ?? []), { name: '', description: '', tech: [] }])}>Add</Button>}>
        <div className="space-y-4">
          {(cv.projects ?? []).map((p, i) => {
            const upd = (patch: Partial<typeof p>) => set('projects', (cv.projects ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="rounded-lg p-4 ring-1 ring-slate-200">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Name"><input className={inputCls} value={p.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
                  <Field label="URL"><input className={inputCls} value={p.url ?? ''} onChange={(e) => upd({ url: e.target.value || undefined })} /></Field>
                </div>
                <div className="mt-3"><Field label="Description"><textarea rows={2} className={inputCls} value={p.description} onChange={(e) => upd({ description: e.target.value })} /></Field></div>
                <div className="mt-3"><Field label="Tech"><ChipInput values={p.tech} onChange={(tech) => upd({ tech })} /></Field></div>
                <div className="mt-2 flex justify-end"><Remove onClick={() => set('projects', (cv.projects ?? []).filter((_, j) => j !== i))} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Education" action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => set('education', [...cv.education, { institution: '', degree: '', field: '', startDate: '' }])}>Add</Button>}>
        <div className="space-y-4">
          {cv.education.map((edu, i) => {
            const upd = (patch: Partial<typeof edu>) => set('education', cv.education.map((e, j) => (j === i ? { ...e, ...patch } : e)));
            return (
              <div key={i} className="grid items-end gap-3 rounded-lg p-4 ring-1 ring-slate-200 md:grid-cols-7">
                <div className="md:col-span-2"><Field label="Institution"><input className={inputCls} value={edu.institution} onChange={(e) => upd({ institution: e.target.value })} /></Field></div>
                <Field label="Degree"><input className={inputCls} value={edu.degree} onChange={(e) => upd({ degree: e.target.value })} /></Field>
                <Field label="Field"><input className={inputCls} value={edu.field} onChange={(e) => upd({ field: e.target.value })} /></Field>
                <Field label="Start"><input className={inputCls} value={edu.startDate} onChange={(e) => upd({ startDate: e.target.value })} /></Field>
                <Field label="End"><input className={inputCls} value={edu.endDate ?? ''} onChange={(e) => upd({ endDate: e.target.value || undefined })} /></Field>
                <div className="flex items-end gap-1"><Field label="Grade"><input className={inputCls} value={edu.gpa ?? ''} onChange={(e) => upd({ gpa: e.target.value || undefined })} /></Field><Remove onClick={() => set('education', cv.education.filter((_, j) => j !== i))} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Languages" action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => set('languages', [...cv.languages, { language: '', level: '' }])}>Add</Button>}>
        <div className="space-y-2">
          {cv.languages.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputCls} placeholder="Language" value={l.language} onChange={(e) => set('languages', cv.languages.map((x, j) => (j === i ? { ...x, language: e.target.value } : x)))} />
              <input className={inputCls} placeholder="Level (e.g. C1)" value={l.level} onChange={(e) => set('languages', cv.languages.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)))} />
              <Remove onClick={() => set('languages', cv.languages.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl bg-white/90 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <ErrorNote error={save.error} />
        {save.isSuccess && <span className="text-sm text-emerald-600">Saved</span>}
        <Button icon={<Save className="size-4" />} loading={save.isPending} onClick={() => save.mutate()}>Save CV</Button>
      </div>
    </div>
  );
}

function PreferencesEditor({ initial }: { initial: Preferences }) {
  const queryClient = useQueryClient();
  const [p, setP] = useState(initial);
  const save = useMutation({ mutationFn: () => api.savePreferences(p), onSuccess: (d) => queryClient.setQueryData(['preferences'], d) });
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => setP({ ...p, [k]: v });
  const totalWeight = DIMENSIONS.reduce((s, d) => s + (p.scoringWeights[d.key] ?? 0), 0) || 1;

  return (
    <div className="space-y-5">
      <Card title="What you’re looking for">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Target roles"><ChipInput values={p.targetRoles} onChange={(v) => set('targetRoles', v)} /></Field>
          <Field label="Seniority"><ChipInput values={p.seniority} onChange={(v) => set('seniority', v)} placeholder="working_student, intern, junior…" /></Field>
          <Field label="Locations"><ChipInput values={p.locations} onChange={(v) => set('locations', v)} /></Field>
          <Field label="Remote preference">
            <select className={inputCls} value={p.remotePreference} onChange={(e) => set('remotePreference', e.target.value as Preferences['remotePreference'])}>
              <option value="any">Any</option>
              <option value="hybrid_or_remote">Hybrid or remote</option>
              <option value="remote_only">Remote only</option>
            </select>
          </Field>
          <Field label="Salary expectation"><input className={inputCls} value={p.salaryExpectation ?? ''} onChange={(e) => set('salaryExpectation', e.target.value)} /></Field>
          <Field label="Work authorisation"><input className={inputCls} value={p.workAuthorization ?? ''} onChange={(e) => set('workAuthorization', e.target.value)} /></Field>
        </div>
        <div className="mt-4">
          <Field label="Target archetypes">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ARCHETYPE_LABEL).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={p.targetArchetypes.includes(k)} onChange={(e) => set('targetArchetypes', e.target.checked ? [...p.targetArchetypes, k] : p.targetArchetypes.filter((x) => x !== k))} />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Filters">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Must-haves"><ChipInput values={p.mustHaves} onChange={(v) => set('mustHaves', v)} /></Field>
          <Field label="Nice-to-haves"><ChipInput values={p.niceToHaves} onChange={(v) => set('niceToHaves', v)} /></Field>
          <Field label="Deal-breakers" hint="A hit caps the grade at D, however strong the match."><ChipInput values={p.dealBreakers} onChange={(v) => set('dealBreakers', v)} /></Field>
        </div>
      </Card>

      <Card title="Scoring">
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {DIMENSIONS.map((d) => (
            <label key={d.key} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
              <span className="text-slate-700">{d.label}</span>
              <input type="range" min={0} max={0.5} step={0.05} value={p.scoringWeights[d.key]} onChange={(e) => set('scoringWeights', { ...p.scoringWeights, [d.key]: Number(e.target.value) })} />
              <span className="text-right text-xs tabular-nums text-slate-500">{Math.round((p.scoringWeights[d.key] / totalWeight) * 100)}%</span>
            </label>
          ))}
        </div>
        <div className="mt-4 max-w-xs">
          <Field label="Minimum grade before the agent may tailor documents">
            <select className={inputCls} value={p.minGradeToTailor} onChange={(e) => set('minGradeToTailor', e.target.value as Grade)}>
              {GRADE_ORDER.map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Search & autopilot">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Default search keywords"><ChipInput values={p.search.keywords} onChange={(v) => set('search', { ...p.search, keywords: v })} /></Field>
          <Field label="Default search location"><input className={inputCls} value={p.search.location} onChange={(e) => set('search', { ...p.search, location: e.target.value })} /></Field>
        </div>
        <div className="mt-4"><Field label="Autopilot goal" hint="Used by scheduled runs (AUTOPILOT_CRON) and the n8n webhook."><textarea rows={2} className={inputCls} value={p.autopilotGoal} onChange={(e) => set('autopilotGoal', e.target.value)} /></Field></div>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl bg-white/90 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <ErrorNote error={save.error} />
        {save.isSuccess && <span className="text-sm text-emerald-600">Saved — new evaluations use these settings</span>}
        <Button icon={<Save className="size-4" />} loading={save.isPending} onClick={() => save.mutate()}>Save preferences</Button>
      </div>
    </div>
  );
}

export default function Profile() {
  const [tab, setTab] = useState<'cv' | 'preferences'>('cv');
  const { data: cv } = useQuery({ queryKey: ['cv'], queryFn: api.cv });
  const { data: prefs } = useQuery({ queryKey: ['preferences'], queryFn: api.preferences });

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your master CV is the single source of truth — tailored documents can only rephrase what is here." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'cv', label: 'Master CV' }, { id: 'preferences', label: 'Search preferences' }]} />
      <div className="mt-5">
        {tab === 'cv' ? (cv ? <CvEditor initial={cv} /> : <Spinner />) : prefs ? <PreferencesEditor initial={prefs} /> : <Spinner />}
      </div>
    </div>
  );
}
