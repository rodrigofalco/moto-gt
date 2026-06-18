import { describe, it, expect } from 'vitest';
import { crashProbability } from '../src/core/CrashModel';
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

  it('clamps into [0, 0.9]', () => {
    expect(crashProbability('high', 1, technical)).toBeLessThanOrEqual(0.9);
    expect(crashProbability('low', 10, fast)).toBeGreaterThanOrEqual(0);
   });

  it('wet weather increases crash probability over dry', () => {
    expect(crashProbability('high', 5, technical, 'wet')).toBeGreaterThan(crashProbability('high', 5, technical, 'dry'));
    expect(crashProbability('low', 5, technical, 'wet')).toBeGreaterThan(crashProbability('low', 5, technical, 'dry'));
   });

  it('wet crash mult is consistent across risk levels', () => {
    const highDry = crashProbability('high', 5, technical, 'dry');
    const highWet = crashProbability('high', 5, technical, 'wet');
    expect(highWet / highDry).toBeCloseTo(1.4, 1);
   });
});
