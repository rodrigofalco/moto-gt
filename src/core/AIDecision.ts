import type { Rider, Setup, Risk, Track, Weather, TireCompound } from './types';
import { SETUPS } from './constants';
import type { RNG } from './RNG';

export function dominantSetup(track: Track, weather: Weather = 'dry'): Setup {
  const w = track.weights;
  if (weather === 'wet') return 'handling';
  if (w.speed >= w.cornering && w.speed >= w.acceleration) return 'topSpeed';
  if (w.cornering >= w.acceleration) return 'handling';
  return 'acceleration';
}

export function aiSetup(_rider: Rider, track: Track, rng: RNG, weather: Weather = 'dry'): Setup {
  if (rng.nextFloat() < 0.75) return dominantSetup(track, weather);
  return SETUPS[rng.nextInt(0, SETUPS.length - 1)];
}

export function aiRisk(rider: Rider, rng: RNG): Risk {
  const c = rider.skills.consistency;
  const roll = rng.nextInt(1, 100);
  if (c >= 7) return roll <= 15 ? 'low' : roll <= 55 ? 'medium' : 'high';
  if (c <= 3) return roll <= 50 ? 'low' : roll <= 85 ? 'medium' : 'high';
  return roll <= 30 ? 'low' : roll <= 70 ? 'medium' : 'high';
}

// Consistent riders wear tires slower, so they can afford the soft; fragile riders
// lean on harder compounds to stay out of the late-race wear/crash zone.
export function aiCompound(rider: Rider, rng: RNG): TireCompound {
  const c = rider.skills.consistency;
  const roll = rng.nextInt(1, 100);
  if (c >= 7) return roll <= 40 ? 'soft' : roll <= 75 ? 'medium' : 'hard';
  if (c <= 3) return roll <= 20 ? 'soft' : roll <= 55 ? 'medium' : 'hard';
  return roll <= 30 ? 'soft' : roll <= 65 ? 'medium' : 'hard';
}
