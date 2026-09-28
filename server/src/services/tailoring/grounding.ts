import type { MasterCV } from '../../types/index';
import type { TailoringOutput } from '../evaluation/schema';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Every number-like token (e.g. "40%", "500k", "3") that appears in a piece of text. */
export function extractNumbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?\s?(?:%|k|m|x)?/gi) ?? []).map((n) => n.toLowerCase().replace(/\s/g, ''));
}

/**
 * Guardrail against fabrication. The model is instructed to only rephrase facts from the
 * CV; this check enforces it in code: unknown skills/projects/companies are dropped and
 * metrics that never appear in the CV are flagged for the human reviewer.
 */
export function enforceGrounding(
  output: TailoringOutput,
  cv: MasterCV,
  jobDescription = ''
): { content: TailoringOutput; warnings: string[] } {
  const warnings: string[] = [];

  const cvSkills = new Map(cv.skills.map((s) => [norm(s), s]));
  const skills: string[] = [];
  for (const skill of output.skills) {
    const canonical = cvSkills.get(norm(skill));
    if (canonical) {
      if (!skills.includes(canonical)) skills.push(canonical);
    } else {
      warnings.push(`Removed skill not present in CV: "${skill}"`);
    }
  }
  // Keep any CV skills the model left out, after the prioritised ones.
  for (const s of cv.skills) if (!skills.includes(s)) skills.push(s);

  const cvCompanies = new Map(cv.experience.map((e) => [norm(e.company), e]));
  const experience: TailoringOutput['experience'] = [];
  for (const entry of output.experience) {
    const original = cvCompanies.get(norm(entry.company));
    if (!original) {
      warnings.push(`Removed experience for company not in CV: "${entry.company}"`);
      continue;
    }
    experience.push({ company: original.company, bullets: entry.bullets.filter((b) => b.trim()) });
  }
  for (const e of cv.experience) {
    if (!experience.some((x) => x.company === e.company)) experience.push({ company: e.company, bullets: e.bullets });
  }

  const cvProjects = new Map((cv.projects ?? []).map((p) => [norm(p.name), p.name]));
  const projects: string[] = [];
  for (const name of output.projects) {
    const canonical = cvProjects.get(norm(name));
    if (canonical) {
      if (!projects.includes(canonical)) projects.push(canonical);
    } else {
      warnings.push(`Removed project not present in CV: "${name}"`);
    }
  }

  // Numbers quoted from the posting itself (e.g. "20h/week") are legitimate too.
  const cvNumbers = new Set(extractNumbers(JSON.stringify(cv) + ' ' + jobDescription));
  const textToCheck = [
    output.summary,
    ...experience.flatMap((e) => e.bullets),
    ...output.coverLetter.paragraphs,
  ];
  const unknownNumbers = new Set<string>();
  for (const text of textToCheck) {
    for (const n of extractNumbers(text)) if (!cvNumbers.has(n)) unknownNumbers.add(n);
  }
  if (unknownNumbers.size) {
    warnings.push(`Metrics not found in the CV — verify before sending: ${Array.from(unknownNumbers).join(', ')}`);
  }

  return { content: { ...output, skills, experience, projects }, warnings };
}
