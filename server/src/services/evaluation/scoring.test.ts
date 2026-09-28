import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '../../profile';
import { aggregateScore, meetsMinGrade, normaliseWeights, scoreToGrade } from './scoring';
import type { EvaluationOutput } from './schema';

function dims(score: number, overrides: Partial<Record<keyof EvaluationOutput['dimensions'], number>> = {}) {
  const keys = ['skills_match', 'experience_level_fit', 'role_alignment', 'location_fit', 'growth_potential', 'company_signal', 'compensation_fit', 'legitimacy'] as const;
  return Object.fromEntries(keys.map((k) => [k, { score: overrides[k] ?? score, evidence: 'x' }])) as EvaluationOutput['dimensions'];
}

describe('scoreToGrade', () => {
  it.each([
    [5, 'A'],
    [4.5, 'A'],
    [4.49, 'B'],
    [4.0, 'B'],
    [3.5, 'C'],
    [3.0, 'D'],
    [2.99, 'F'],
  ])('%s → %s', (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });
});

describe('aggregateScore', () => {
  it('computes a weighted average of dimension scores', () => {
    const result = aggregateScore({ dimensions: dims(4), dealBreakersHit: [] }, DEFAULT_WEIGHTS);
    expect(result.overallScore).toBe(4);
    expect(result.grade).toBe('B');
    expect(result.gradeCap).toBeUndefined();
  });

  it('respects custom weights', () => {
    const onlySkills = { skills_match: 1 };
    const result = aggregateScore({ dimensions: dims(2, { skills_match: 5 }), dealBreakersHit: [] }, onlySkills);
    expect(result.overallScore).toBe(5);
  });

  it('clamps out-of-range model scores into 1..5', () => {
    const result = aggregateScore({ dimensions: dims(9, { legitimacy: 5 }), dealBreakersHit: [] }, DEFAULT_WEIGHTS);
    expect(result.overallScore).toBe(5);
    expect(result.dimensions.skills_match.score).toBe(5);
  });

  it('caps the grade at D when a deal-breaker is hit, however strong the match', () => {
    const result = aggregateScore({ dimensions: dims(5), dealBreakersHit: ['Unpaid position'] }, DEFAULT_WEIGHTS);
    expect(result.overallScore).toBe(5);
    expect(result.grade).toBe('D');
    expect(result.gradeCap).toContain('Unpaid position');
  });

  it('caps the grade when the posting looks illegitimate', () => {
    const result = aggregateScore({ dimensions: dims(5, { legitimacy: 2 }), dealBreakersHit: [] }, DEFAULT_WEIGHTS);
    expect(result.grade).toBe('D');
  });

  it('caps the grade at C for a hard seniority mismatch', () => {
    const result = aggregateScore({ dimensions: dims(5, { experience_level_fit: 1 }), dealBreakersHit: [] }, DEFAULT_WEIGHTS);
    expect(result.grade).toBe('C');
  });
});

describe('normaliseWeights', () => {
  it('normalises to a sum of 1', () => {
    const w = normaliseWeights({ skills_match: 2, role_alignment: 2 });
    expect(w.skills_match).toBe(0.5);
    expect(w.role_alignment).toBe(0.5);
    expect(w.legitimacy).toBe(0);
  });

  it('falls back to equal weights when all are zero', () => {
    const w = normaliseWeights({});
    expect(w.skills_match).toBeCloseTo(1 / 8);
  });
});

describe('meetsMinGrade', () => {
  it('compares grades by rank', () => {
    expect(meetsMinGrade('A', 'B')).toBe(true);
    expect(meetsMinGrade('B', 'B')).toBe(true);
    expect(meetsMinGrade('C', 'B')).toBe(false);
    expect(meetsMinGrade(undefined, 'F')).toBe(false);
  });
});
