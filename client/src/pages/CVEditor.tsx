import { useState, useEffect } from 'react';
import { getMasterCV, updateMasterCV } from '../api/client.js';
import type { MasterCV, WorkExperience, Education } from '../types/index.js';

const EMPTY_CV: MasterCV = {
  fullName: '', email: '', phone: '', linkedin: '', github: '', location: '', summary: '',
  skills: [], experience: [], education: [], languages: [],
};

export default function CVEditor() {
  const [cv, setCv] = useState<MasterCV>(EMPTY_CV);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    getMasterCV().then(setCv).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateMasterCV(cv);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof MasterCV, multiline = false) {
    const value = cv[key] as string;
    const cls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
    return (
      <div key={key}>
        <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
        {multiline
          ? <textarea rows={4} className={cls} value={value} onChange={(e) => setCv({ ...cv, [key]: e.target.value })} />
          : <input className={cls} value={value} onChange={(e) => setCv({ ...cv, [key]: e.target.value })} />
        }
      </div>
    );
  }

  function addSkill() {
    const s = newSkill.trim();
    if (s && !cv.skills.includes(s)) {
      setCv({ ...cv, skills: [...cv.skills, s] });
    }
    setNewSkill('');
  }

  function updateExp(i: number, patch: Partial<WorkExperience>) {
    const updated = cv.experience.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    setCv({ ...cv, experience: updated });
  }

  function updateEdu(i: number, patch: Partial<Education>) {
    const updated = cv.education.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    setCv({ ...cv, education: updated });
  }

  const inputCls = 'border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400';

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">CV Editor</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save CV'}
        </button>
      </div>

      {/* Personal Info */}
      <section className="bg-white rounded-lg shadow p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 border-b pb-2">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Full Name', 'fullName')}
          {field('Email', 'email')}
          {field('Phone', 'phone')}
          {field('Location', 'location')}
          {field('LinkedIn URL', 'linkedin')}
          {field('GitHub URL (optional)', 'github')}
        </div>
        {field('Professional Summary', 'summary', true)}
      </section>

      {/* Skills */}
      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 border-b pb-2">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {cv.skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
              {s}
              <button onClick={() => setCv({ ...cv, skills: cv.skills.filter((x) => x !== s) })}
                className="text-blue-600 hover:text-red-500 font-bold">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            placeholder="Add skill and press Enter"
          />
          <button onClick={addSkill} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">Add</button>
        </div>
      </section>

      {/* Experience */}
      <section className="bg-white rounded-lg shadow p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-semibold text-gray-800">Experience</h2>
          <button
            onClick={() => setCv({ ...cv, experience: [...cv.experience, { company: '', role: '', startDate: '', bullets: [] }] })}
            className="text-xs text-blue-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {cv.experience.map((exp, i) => (
          <div key={i} className="border border-gray-200 rounded p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Company</label><input className={inputCls} value={exp.company} onChange={(e) => updateExp(i, { company: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Role</label><input className={inputCls} value={exp.role} onChange={(e) => updateExp(i, { role: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Start Date</label><input className={inputCls} value={exp.startDate} onChange={(e) => updateExp(i, { startDate: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">End Date (blank = present)</label><input className={inputCls} value={exp.endDate ?? ''} onChange={(e) => updateExp(i, { endDate: e.target.value || undefined })} /></div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Bullets (one per line)</label>
              <textarea rows={3} className={inputCls}
                value={exp.bullets.join('\n')}
                onChange={(e) => updateExp(i, { bullets: e.target.value.split('\n') })}
              />
            </div>
            <button onClick={() => setCv({ ...cv, experience: cv.experience.filter((_, idx) => idx !== i) })}
              className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        ))}
      </section>

      {/* Education */}
      <section className="bg-white rounded-lg shadow p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-semibold text-gray-800">Education</h2>
          <button
            onClick={() => setCv({ ...cv, education: [...cv.education, { institution: '', degree: '', field: '', startDate: '' }] })}
            className="text-xs text-blue-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {cv.education.map((edu, i) => (
          <div key={i} className="border border-gray-200 rounded p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Institution</label><input className={inputCls} value={edu.institution} onChange={(e) => updateEdu(i, { institution: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Degree</label><input className={inputCls} value={edu.degree} onChange={(e) => updateEdu(i, { degree: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Field of Study</label><input className={inputCls} value={edu.field} onChange={(e) => updateEdu(i, { field: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">GPA (optional)</label><input className={inputCls} value={edu.gpa ?? ''} onChange={(e) => updateEdu(i, { gpa: e.target.value || undefined })} /></div>
              <div><label className="text-xs text-gray-500">Start Date</label><input className={inputCls} value={edu.startDate} onChange={(e) => updateEdu(i, { startDate: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">End Date</label><input className={inputCls} value={edu.endDate ?? ''} onChange={(e) => updateEdu(i, { endDate: e.target.value || undefined })} /></div>
            </div>
            <button onClick={() => setCv({ ...cv, education: cv.education.filter((_, idx) => idx !== i) })}
              className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        ))}
      </section>

      {/* Languages */}
      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-semibold text-gray-800">Languages</h2>
          <button
            onClick={() => setCv({ ...cv, languages: [...cv.languages, { language: '', level: '' }] })}
            className="text-xs text-blue-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {cv.languages.map((l, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input className={inputCls} placeholder="Language" value={l.language}
              onChange={(e) => setCv({ ...cv, languages: cv.languages.map((x, idx) => idx === i ? { ...x, language: e.target.value } : x) })} />
            <input className={inputCls} placeholder="Level (e.g. C1, Native)" value={l.level}
              onChange={(e) => setCv({ ...cv, languages: cv.languages.map((x, idx) => idx === i ? { ...x, level: e.target.value } : x) })} />
            <button onClick={() => setCv({ ...cv, languages: cv.languages.filter((_, idx) => idx !== i) })}
              className="text-red-500 hover:text-red-700 font-bold">×</button>
          </div>
        ))}
      </section>
    </div>
  );
}
