import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { config } from './config';
import { DIMENSION_KEYS, type MasterCV, type Preferences } from './types/index';

const optionalUrl = z.union([z.url(), z.literal('')]).optional();

export const MasterCVSchema = z.object({
  fullName: z.string().min(1),
  headline: z.string().optional(),
  email: z.email(),
  phone: z.string(),
  linkedin: z.union([z.url(), z.literal('')]),
  github: optionalUrl,
  website: optionalUrl,
  location: z.string().min(1),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      location: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      bullets: z.array(z.string()),
    })
  ),
  projects: z
    .array(z.object({ name: z.string(), description: z.string(), tech: z.array(z.string()), url: z.string().optional() }))
    .optional(),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string(),
      startDate: z.string(),
      endDate: z.string().optional(),
      gpa: z.string().optional(),
    })
  ),
  languages: z.array(z.object({ language: z.string(), level: z.string() })),
  certifications: z.array(z.string()).optional(),
});

const GradeSchema = z.enum(['A', 'B', 'C', 'D', 'F']);

export const DEFAULT_WEIGHTS: Preferences['scoringWeights'] = {
  skills_match: 0.25,
  experience_level_fit: 0.15,
  role_alignment: 0.2,
  location_fit: 0.1,
  growth_potential: 0.1,
  company_signal: 0.1,
  compensation_fit: 0.05,
  legitimacy: 0.05,
};

export const PreferencesSchema = z.object({
  targetRoles: z.array(z.string()).default([]),
  targetArchetypes: z.array(z.string()).default([]),
  seniority: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remotePreference: z.enum(['remote_only', 'hybrid_or_remote', 'any']).default('any'),
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
  dealBreakers: z.array(z.string()).default([]),
  salaryExpectation: z.string().optional(),
  workAuthorization: z.string().optional(),
  minGradeToTailor: GradeSchema.default('B'),
  scoringWeights: z
    .object(Object.fromEntries(DIMENSION_KEYS.map((k) => [k, z.number().min(0)])) as Record<(typeof DIMENSION_KEYS)[number], z.ZodNumber>)
    .default(DEFAULT_WEIGHTS),
  search: z
    .object({
      keywords: z.array(z.string()).default([]),
      location: z.string().default(''),
      sources: z.array(z.string()).default(['portals', 'arbeitnow']),
    })
    .default({ keywords: [], location: '', sources: ['portals', 'arbeitnow'] }),
  autopilotGoal: z
    .string()
    .default('Scan my portals for new roles that match my preferences, evaluate the promising ones and shortlist the best for my review.'),
});

function resolve(p: string): string {
  return path.resolve(p);
}

export function loadMasterCV(): MasterCV {
  return MasterCVSchema.parse(JSON.parse(fs.readFileSync(resolve(config.masterCVPath), 'utf-8')));
}

export function saveMasterCV(cv: MasterCV): void {
  fs.writeFileSync(resolve(config.masterCVPath), JSON.stringify(cv, null, 2) + '\n', 'utf-8');
}

export function loadPreferences(): Preferences {
  const file = resolve(config.preferencesPath);
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
  return PreferencesSchema.parse(raw) as Preferences;
}

export function savePreferences(prefs: Preferences): void {
  fs.writeFileSync(resolve(config.preferencesPath), JSON.stringify(prefs, null, 2) + '\n', 'utf-8');
}
