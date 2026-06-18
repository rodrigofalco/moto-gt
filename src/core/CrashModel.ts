import type { Risk, Track, Weather } from './types';
import {
  BASE_CRASH, CONSISTENCY_DIVISOR, CONSISTENCY_FLOOR, CRASH_TECH_FACTOR, CRASH_TECH_THRESHOLD, WET_CRASH_MULT,
} from './constants';

export function crashProbability(risk: Risk, consistency: number, track: Track, weather: Weather = 'dry'): number {
  const factor = Math.max(CONSISTENCY_FLOOR, 1 - (consistency - 1) / CONSISTENCY_DIVISOR);
    // Track danger only kicks in above a threshold cornering weight: fast tracks stay
    // safe, technical tracks ramp up steeply — so high risk is fine on power circuits
    // but reckless on twisty ones.
  const techExcess = Math.max(0, track.weights.cornering - CRASH_TECH_THRESHOLD);
  let p = BASE_CRASH[risk] * factor * (1 + CRASH_TECH_FACTOR * techExcess);
  if (weather === 'wet') p *= WET_CRASH_MULT;
  return Math.min(0.9, Math.max(0, p));
}
