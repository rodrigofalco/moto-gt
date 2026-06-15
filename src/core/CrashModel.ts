import type { Risk, Track } from './types';
import {
  BASE_CRASH, CONSISTENCY_DIVISOR, CONSISTENCY_FLOOR, CRASH_TECH_FACTOR,
  CRASH_PENALTY_BASE, CRASH_PENALTY_RANGE,
} from './constants';
import type { RNG } from './RNG';

export function crashProbability(risk: Risk, consistency: number, track: Track): number {
  const factor = Math.max(CONSISTENCY_FLOOR, 1 - (consistency - 1) / CONSISTENCY_DIVISOR);
  const p = BASE_CRASH[risk] * factor * (1 + CRASH_TECH_FACTOR * track.weights.cornering);
  return Math.min(0.9, Math.max(0, p));
}

export function crashPenalty(rng: RNG): number {
  return CRASH_PENALTY_BASE + rng.nextFloatRange(0, CRASH_PENALTY_RANGE);
}
