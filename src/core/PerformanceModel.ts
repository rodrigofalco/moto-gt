import type { PilotSkills, BikeParams, Setup, Track, Weather } from './types';
import { STAT_SCALE, SETUP_BONUS, SETUP_PENALTY, WET_PACE_REDUCED, MIXED_PACE_REDUCED, WET_SETUP_BONUS_HANDLING, WET_SETUP_PENALTY_SPEED } from './constants';

export interface Axes { speed: number; cornering: number; acceleration: number; }

export function baseAxes(skills: PilotSkills, bike: BikeParams): Axes {
  return {
    speed: (skills.pace + bike.speed) / 2,
    cornering: (skills.cornering + bike.handling) / 2,
    acceleration: (skills.pace + bike.acceleration) / 2,
  };
}

export function applySetup(axes: Axes, setup: Setup, weather?: Weather): Axes {
  const a = { ...axes };
  let bonus = SETUP_BONUS;
  let penalty = SETUP_PENALTY;
  if (weather === 'wet') {
    if (setup === 'handling') bonus = WET_SETUP_BONUS_HANDLING;
    if (setup === 'topSpeed') penalty = WET_SETUP_PENALTY_SPEED;
  } else if (weather === 'mixed') {
    if (setup === 'handling') bonus = SETUP_BONUS * 1.25;
    if (setup === 'topSpeed') penalty = SETUP_PENALTY * 0.8;
  }
  const boost = (key: keyof Axes) => {
    a[key] += bonus;
    (['speed', 'cornering', 'acceleration'] as (keyof Axes)[])
        .filter((k) => k !== key)
        .forEach((k) => { a[k] -= penalty; });
   };
  if (setup === 'topSpeed') boost('speed');
  else if (setup === 'handling') boost('cornering');
  else boost('acceleration');
  return a;
}

export function weightedBase(axes: Axes, track: Track, weather?: Weather): number {
  const w = track.weights;
  let pace = STAT_SCALE * (w.speed * axes.speed + w.cornering * axes.cornering + w.acceleration * axes.acceleration);
  if (weather === 'wet') pace *= WET_PACE_REDUCED;
  else if (weather === 'mixed') pace *= MIXED_PACE_REDUCED;
  return pace;
}
