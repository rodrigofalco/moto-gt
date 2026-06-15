import type { RidingStyle } from './types';
import {
  BASE_MISTAKE_PROB, CONSISTENCY_DIVISOR, CONSISTENCY_FLOOR,
  MISTAKE_PENALTY_BASE, MISTAKE_PENALTY_RANGE,
} from './constants';
import type { RNG } from './RNG';

export function mistakeProbability(style: RidingStyle, consistency: number): number {
  const factor = Math.max(CONSISTENCY_FLOOR, 1 - (consistency - 1) / CONSISTENCY_DIVISOR);
  return BASE_MISTAKE_PROB[style] * factor;
}

export function mistakePenalty(rng: RNG): number {
  return MISTAKE_PENALTY_BASE + rng.nextFloatRange(0, MISTAKE_PENALTY_RANGE);
}
