import { describe, it, expect } from 'vitest';
import { recommendedSetup, resultHeadline } from '../src/core/Advice';

describe('recommendedSetup', () => {
  it('picks topSpeed for a power track', () => {
    expect(recommendedSetup({ speed: 0.55, cornering: 0.25, acceleration: 0.20 })).toBe('topSpeed');
  });
  it('picks handling for a technical track', () => {
    expect(recommendedSetup({ speed: 0.20, cornering: 0.60, acceleration: 0.20 })).toBe('handling');
  });
  it('picks acceleration for a stop-go track', () => {
    expect(recommendedSetup({ speed: 0.20, cornering: 0.30, acceleration: 0.50 })).toBe('acceleration');
  });
  it('breaks ties toward topSpeed then handling', () => {
    expect(recommendedSetup({ speed: 0.40, cornering: 0.40, acceleration: 0.20 })).toBe('topSpeed');
    expect(recommendedSetup({ speed: 0.20, cornering: 0.40, acceleration: 0.40 })).toBe('handling');
  });
});

describe('resultHeadline', () => {
  it('celebrates a win', () => {
    expect(resultHeadline(1, false, 1, 5)).toBe('WIN! 🏆');
  });
  it('marks a podium', () => {
    expect(resultHeadline(3, false, 2, 5)).toBe('Podium! P3.');
  });
  it('notes a points finish', () => {
    expect(resultHeadline(7, false, 4, 5)).toBe('P7 — points scored.');
  });
  it('reports a crash', () => {
    expect(resultHeadline(8, true, 5, 5)).toBe('Crashed out — finished P8.');
  });
  it('appends the title tail late in the season', () => {
    expect(resultHeadline(2, false, 1, 2)).toBe("Podium! P2. You're P1 in the title race.");
  });
  it('omits the title tail early in the season', () => {
    expect(resultHeadline(2, false, 1, 3)).toBe('Podium! P2.');
  });
});
