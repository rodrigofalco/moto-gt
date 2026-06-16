import { describe, it, expect } from 'vitest';
import { baseAxes, applySetup, weightedBase } from '../src/core/PerformanceModel';
import type { Track } from '../src/core/types';

const skills = { pace: 8, cornering: 4, consistency: 6 };
const bike = { speed: 8, handling: 4, acceleration: 6 };
const fastTrack: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.6, cornering: 0.2, acceleration: 0.2 } };

describe('PerformanceModel', () => {
  it('blends pilot+bike into all three axes', () => {
    const a = baseAxes(skills, bike);
    expect(a.speed).toBe(8);        // (8+8)/2
    expect(a.cornering).toBe(4);    // (4+4)/2
    expect(a.acceleration).toBe(7); // (8+6)/2
  });

  it('topSpeed setup raises speed and lowers the others', () => {
    const a = applySetup(baseAxes(skills, bike), 'topSpeed');
    expect(a.speed).toBeCloseTo(9.5);       // +1.5
    expect(a.cornering).toBeCloseTo(3.25);  // -0.75
    expect(a.acceleration).toBeCloseTo(6.25);
  });

  it('weightedBase rewards matching the track', () => {
    const matched = weightedBase(applySetup(baseAxes(skills, bike), 'topSpeed'), fastTrack);
    const mismatched = weightedBase(applySetup(baseAxes(skills, bike), 'handling'), fastTrack);
    expect(matched).toBeGreaterThan(mismatched);
  });
});
