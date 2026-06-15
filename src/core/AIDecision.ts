import type { Rider, Setup, Risk, Track } from './types';
import { SETUPS } from './constants';
import type { RNG } from './RNG';

export function dominantSetup(track: Track): Setup {
  const w = track.weights;
  if (w.speed >= w.cornering && w.speed >= w.acceleration) return 'topSpeed';
  if (w.cornering >= w.acceleration) return 'handling';
  return 'acceleration';
}

export function aiSetup(_rider: Rider, track: Track, rng: RNG): Setup {
  if (rng.nextFloat() < 0.75) return dominantSetup(track);
  return rng.pick(SETUPS);
}

export function aiRisk(rider: Rider, rng: RNG): Risk {
  const c = rider.skills.consistency;
  const roll = rng.nextInt(1, 100);
  if (c >= 7) return roll <= 15 ? 'low' : roll <= 55 ? 'medium' : 'high';
  if (c <= 3) return roll <= 50 ? 'low' : roll <= 85 ? 'medium' : 'high';
  return roll <= 30 ? 'low' : roll <= 70 ? 'medium' : 'high';
}
