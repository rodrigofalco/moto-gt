import { describe, it, expect } from 'vitest';
import { dominantSetup, aiSetup, aiRisk } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import type { Rider, Track } from '../src/core/types';

const technical: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.2, cornering: 0.6, acceleration: 0.2 }, weather: 'dry', wetGrip: 1.0 };
const stopGo: Track = { id: 's', name: 'S', location: 'X', weights: { speed: 0.3, cornering: 0.25, acceleration: 0.45 }, weather: 'dry', wetGrip: 1.0 };

function rider(consistency: number): Rider {
  return {
    id: 'ai', name: 'AI', team: 'T', isPlayer: false, brandId: 'titan',
    skills: { pace: 5, cornering: 5, consistency },
    bike: { speed: 5, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
    careerStats: { seasonsPlayed: 0, totalWins: 0, totalPodiums: 0, totalPoints: 0, bestChampionship: 99, lapsCompleted: 0 },
     };
}

describe('AIDecision', () => {
  it('dominantSetup picks the track\'s biggest axis', () => {
    expect(dominantSetup(technical)).toBe('handling');
    expect(dominantSetup(stopGo)).toBe('acceleration');
  });

  it('aiSetup mostly matches the track', () => {
    const rng = new RNG(3);
    let matched = 0;
    for (let i = 0; i < 1000; i++) if (aiSetup(rider(5), technical, rng) === 'handling') matched++;
    expect(matched).toBeGreaterThan(600); // ~75%
  });

  it('high-consistency riders push more than low-consistency', () => {
    const rng = new RNG(7);
    const countHigh = (c: number) => {
      let n = 0;
      for (let i = 0; i < 2000; i++) if (aiRisk(rider(c), rng) === 'high') n++;
      return n;
    };
    expect(countHigh(9)).toBeGreaterThan(countHigh(2));
  });
});
