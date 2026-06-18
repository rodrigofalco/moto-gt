import { describe, it, expect } from 'vitest';
import { runQualifying } from '../src/core/Qualifying';
import { RNG } from '../src/core/RNG';
import type { Rider } from '../src/core/types';

function mkRider(id: string, pace: number): Rider {
  return {
    id, name: id, team: 'T', isPlayer: false, brandId: 'titan',
    age: 25,
    skills: { pace, cornering: 5, consistency: 5 },
    bike: { speed: pace, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
  };
}

const track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.5, cornering: 0.3, acceleration: 0.2 } };

describe('P3.1 — qualifying', () => {
  it('output length equals field size', () => {
    const riders = Array.from({ length: 10 }, (_, i) => mkRider(`r${i}`, 5));
    const result = runQualifying(riders, track, new RNG(1));
    expect(result.gridOrder).toHaveLength(10);
  });

  it('is deterministic for a fixed seed', () => {
    const riders = Array.from({ length: 5 }, (_, i) => mkRider(`r${i}`, 5 + i));
    const a = runQualifying(riders, track, new RNG(42));
    const b = runQualifying(riders, track, new RNG(42));
    expect(a.gridOrder).toEqual(b.gridOrder);
  });

  it('faster riders tend to qualify ahead', () => {
    const riders = [
      mkRider('fast', 9),
      mkRider('slow', 3),
      mkRider('mid', 6),
    ];
    let fastAhead = 0;
    for (let seed = 0; seed < 200; seed++) {
      const result = runQualifying(riders, track, new RNG(seed));
      const fastPos = result.gridOrder.indexOf('fast');
      const slowPos = result.gridOrder.indexOf('slow');
      if (fastPos < slowPos) fastAhead++;
    }
    expect(fastAhead).toBeGreaterThan(150); // ~75%+
  });

  it('different seeds produce different grids', () => {
    const riders = Array.from({ length: 10 }, (_, i) => mkRider(`r${i}`, 5 + (i % 5)));
    const a = runQualifying(riders, track, new RNG(1));
    const b = runQualifying(riders, track, new RNG(2));
    expect(a.gridOrder).not.toEqual(b.gridOrder);
  });
});
