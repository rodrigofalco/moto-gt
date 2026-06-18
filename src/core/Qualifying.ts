import type { Rider, Track, QualifyingResult } from './types';
import type { RNG } from './RNG';
import { baseAxes, applySetup, weightedBase, type Axes } from './PerformanceModel';

function riderPace(rider: Rider, track: Track, rng: RNG): number {
  const axes: Axes = applySetup(baseAxes(rider.skills, rider.bike), 'topSpeed');
  return weightedBase(axes, track) + rng.gaussian(0, 0.3);
}

export function runQualifying(riders: Rider[], track: Track, rng: RNG): QualifyingResult {
  const scored = riders.map((rider) => ({
    rider,
    pace: riderPace(rider, track, rng),
  }));
  scored.sort((a, b) => b.pace - a.pace);
  return {
    gridOrder: scored.map((s) => s.rider.id),
  };
}
