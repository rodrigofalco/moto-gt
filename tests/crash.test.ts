import { describe, it, expect } from 'vitest';
import { crashProbability, crashPenalty } from '../src/core/CrashModel';
import { RNG } from '../src/core/RNG';
import type { Track } from '../src/core/types';

const technical: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.2, cornering: 0.6, acceleration: 0.2 } };
const fast: Track = { id: 'f', name: 'F', location: 'X', weights: { speed: 0.6, cornering: 0.2, acceleration: 0.2 } };

describe('CrashModel', () => {
  it('high risk is crashier than low risk', () => {
    expect(crashProbability('high', 5, technical)).toBeGreaterThan(crashProbability('low', 5, technical));
  });

  it('technical tracks are crashier than fast tracks at equal risk', () => {
    expect(crashProbability('high', 5, technical)).toBeGreaterThan(crashProbability('high', 5, fast));
  });

  it('higher consistency lowers crash probability', () => {
    expect(crashProbability('high', 10, technical)).toBeLessThan(crashProbability('high', 1, technical));
  });

  it('clamps into [0, 0.9] and penalty in [4,10]', () => {
    expect(crashProbability('high', 1, technical)).toBeLessThanOrEqual(0.9);
    const r = new RNG(1);
    for (let i = 0; i < 500; i++) {
      const p = crashPenalty(r);
      expect(p).toBeGreaterThanOrEqual(4);
      expect(p).toBeLessThanOrEqual(10);
    }
  });
});
