import { DIMENSION_KEYS, type DimensionKey, type Grade } from '../../types/index';
import type { EvaluationOutput } from './schema';

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F'];

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 1;
  return Math.min(5, Math.max(1, Math.round(score)));
}

export function scoreToGrade(score: number): Grade {
  if (score >= 4.5) return 'A';
  if (score >= 4.0) return 'B';
  if (score >= 3.5) return 'C';
  if (score >= 3.0) return 'D';
  return 'F';
}

/** Lower rank = better grade. */
export function gradeRank(grade: Grade): number {
  return GRADE_ORDER.indexOf(grade);
}

export function meetsMinGrade(grade: Grade | undefined, min: Grade): boolean {
  return grade !== undefined && gradeRank(grade) <= gradeRank(min);
}

function worseOf(a: Grade, b: Grade): Grade {
  return gradeRank(a) >= gradeRank(b) ? a : b;
}

/** Normalises weights so they sum to 1; falls back to equal weights if all are zero. */
export function normaliseWeights(weights: Partial<Record<DimensionKey, number>>): Record<DimensionKey, number> {
  const raw = Object.fromEntries(DIMENSION_KEYS.map((k) => [k, Math.max(0, weights[k] ?? 0)])) as Record<DimensionKey, number>;
  const total = DIMENSION_KEYS.reduce((sum, k) => sum + raw[k], 0);
  if (total === 0) return Object.fromEntries(DIMENSION_KEYS.map((k) => [k, 1 / DIMENSION_KEYS.length])) as Record<DimensionKey, number>;
  return Object.fromEntries(DIMENSION_KEYS.map((k) => [k, raw[k] / total])) as Record<DimensionKey, number>;
}

export interface ScoreResult {
  overallScore: number;
  grade: Grade;
  gradeCap?: string;
  weightsUsed: Record<DimensionKey, number>;
  dimensions: EvaluationOutput['dimensions'];
}

/**
 * Deterministic aggregation of the model's per-dimension judgements.
 *
 * The LLM is good at reading a JD and citing evidence; it is not a reliable calculator.
 * Keeping the weighting and hard caps in code makes grades reproducible, tunable via
 * preferences, and unit-testable.
 */
export function aggregateScore(
  evaluation: Pick<EvaluationOutput, 'dimensions' | 'dealBreakersHit'>,
  weights: Partial<Record<DimensionKey, number>>
): ScoreResult {
  const w = normaliseWeights(weights);
  const dimensions = Object.fromEntries(
    DIMENSION_KEYS.map((k) => [k, { ...evaluation.dimensions[k], score: clampScore(evaluation.dimensions[k].score) }])
  ) as EvaluationOutput['dimensions'];

  const weighted = DIMENSION_KEYS.reduce((sum, k) => sum + dimensions[k].score * w[k], 0);
  const overallScore = Math.round(weighted * 100) / 100;

  let grade = scoreToGrade(overallScore);
  const caps: string[] = [];

  if (evaluation.dealBreakersHit.length > 0) {
    grade = worseOf(grade, 'D');
    caps.push(`deal-breaker: ${evaluation.dealBreakersHit.join('; ')}`);
  }
  if (dimensions.legitimacy.score <= 2) {
    grade = worseOf(grade, 'D');
    caps.push('posting legitimacy concerns');
  }
  if (dimensions.experience_level_fit.score === 1) {
    grade = worseOf(grade, 'C');
    caps.push('seniority mismatch');
  }

  return { overallScore, grade, gradeCap: caps.length ? caps.join(' · ') : undefined, weightsUsed: w, dimensions };
}
