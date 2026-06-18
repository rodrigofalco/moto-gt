import type { PilotSkills, BikeParams, Setup, Track, Weather } from './types';
import { STAT_SCALE, SETUP_BONUS, SETUP_PENALTY } from './constants';

export interface Axes { speed: number; cornering: number; acceleration: number; }

export function baseAxes(skills: PilotSkills, bike: BikeParams): Axes {
  return {
    speed: (skills.pace + bike.speed) / 2,
    cornering: (skills.cornering + bike.handling) / 2,
    acceleration: (skills.pace + bike.acceleration) / 2,
    };
}

export function applySetup(axes: Axes, setup: Setup, weather: Weather = 'dry'): Axes {
  const a = { ...axes };
  const boost = (key: keyof Axes) => {
    a[key] += SETUP_BONUS;
      (['speed', 'cornering', 'acceleration'] as (keyof Axes)[])
        .filter((k) => k !== key)
        .forEach((k) => { a[k] -= SETUP_PENALTY; });
   };
  if (setup === 'topSpeed') boost('speed');
  else if (setup === 'handling') boost('cornering');
  else boost('acceleration');
     // In wet weather, handling is relatively more valuable
  if (weather === 'wet' && setup !== 'handling') {
    a.cornering += 0.3;
     }
  return a;
}

export function weightedBase(axes: Axes, track: Track): number {
  const w = track.weights;
  return STAT_SCALE * (w.speed * axes.speed + w.cornering * axes.cornering + w.acceleration * axes.acceleration);
}
