import { describe, expect, it } from 'vitest';
import type { MasterCV } from '../../types/index';
import type { TailoringOutput } from '../evaluation/schema';
import { enforceGrounding, extractNumbers } from './grounding';

const cv: MasterCV = {
  fullName: 'Test Person',
  email: 't@example.com',
  phone: '',
  linkedin: '',
  location: 'Berlin',
  summary: 'Student.',
  skills: ['Python', 'TypeScript', 'Docker'],
  experience: [
    { company: 'Acme GmbH', role: 'Working Student', startDate: '2024-01', bullets: ['Saved 4 hours per week with automation.', 'Built APIs.'] },
    { company: 'Uni Lab', role: 'HiWi', startDate: '2023-01', endDate: '2023-12', bullets: ['Cleaned 50k documents.'] },
  ],
  projects: [{ name: 'RAG Tutor', description: 'x', tech: ['Python'] }],
  education: [],
  languages: [],
};

function output(overrides: Partial<TailoringOutput> = {}): TailoringOutput {
  return {
    headline: 'AI Engineer',
    summary: 'Student who automates things.',
    skills: ['typescript', 'Python'],
    experience: [{ company: 'acme gmbh', bullets: ['Automated reporting, saving 4 hours per week.'] }],
    projects: ['RAG Tutor'],
    coverLetter: { greeting: 'Hi', paragraphs: ['I would love to join.'], closing: 'Best' },
    keywordsCovered: [],
    honestyNotes: [],
    ...overrides,
  };
}

describe('enforceGrounding', () => {
  it('keeps grounded content and canonicalises names', () => {
    const { content, warnings } = enforceGrounding(output(), cv);
    expect(warnings).toEqual([]);
    expect(content.skills.slice(0, 2)).toEqual(['TypeScript', 'Python']);
    expect(content.skills).toContain('Docker'); // untouched CV skills are appended, never lost
    expect(content.experience[0].company).toBe('Acme GmbH');
  });

  it('removes skills that are not in the CV', () => {
    const { content, warnings } = enforceGrounding(output({ skills: ['Python', 'Kubernetes'] }), cv);
    expect(content.skills).not.toContain('Kubernetes');
    expect(warnings.join()).toMatch(/Kubernetes/);
  });

  it('removes invented employers and projects', () => {
    const { content, warnings } = enforceGrounding(
      output({ experience: [{ company: 'Google', bullets: ['Led Gemini.'] }], projects: ['Moonshot'] }),
      cv
    );
    expect(content.experience.map((e) => e.company)).not.toContain('Google');
    expect(content.projects).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  it('falls back to original bullets for roles the model omitted', () => {
    const { content } = enforceGrounding(output(), cv);
    expect(content.experience.find((e) => e.company === 'Uni Lab')?.bullets).toEqual(['Cleaned 50k documents.']);
  });

  it('flags metrics that do not appear in the CV', () => {
    const { warnings } = enforceGrounding(
      output({ experience: [{ company: 'Acme GmbH', bullets: ['Cut latency by 73%.'] }] }),
      cv
    );
    expect(warnings.join()).toMatch(/73%/);
  });

  it('accepts numbers quoted from the job description', () => {
    const { warnings } = enforceGrounding(
      output({ coverLetter: { greeting: 'Hi', paragraphs: ['I can work 20 hours a week.'], closing: 'Best' } }),
      cv,
      'Working student, 20 hours per week'
    );
    expect(warnings).toEqual([]);
  });
});

describe('extractNumbers', () => {
  it('extracts numbers with units', () => {
    expect(extractNumbers('Saved 40% and 500k events, 3x faster')).toEqual(['40%', '500k', '3x']);
  });
});
