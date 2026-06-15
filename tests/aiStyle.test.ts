import { describe, it, expect } from 'vitest';
import { selectAIStyle } from '../src/core/AIStyleSelector';
import { RNG } from '../src/core/RNG';
import type { Rider } from '../src/core/types';

function rider(pace: number, consistency: number): Rider {
  return {
    id: 'x', name: 'X', team: 'T', isPlayer: false,
    stats: { pace, cornering: 5, consistency },
    points: 0, positionCounts: new Array(10).fill(0),
  };
}

function distribution(r: Rider) {
  const rng = new RNG(42);
  const counts = { safe: 0, balanced: 0, aggressive: 0 };
  for (let i = 0; i < 4000; i++) counts[selectAIStyle(r, rng)]++;
  return counts;
}

describe('AIStyleSelector', () => {
  it('always returns a valid style', () => {
    const rng = new RNG(1);
    const styles = new Set<string>();
    for (let i = 0; i < 200; i++) styles.add(selectAIStyle(rider(5, 5), rng));
    for (const s of styles) expect(['safe', 'balanced', 'aggressive']).toContain(s);
  });

  it('high-aggression rider leans aggressive', () => {
    const d = distribution(rider(9, 2)); // aggressionScore = 7
    expect(d.aggressive).toBeGreaterThan(d.safe);
  });

  it('low-aggression rider leans safe', () => {
    const d = distribution(rider(2, 9)); // aggressionScore = -7
    expect(d.safe).toBeGreaterThan(d.aggressive);
  });
});
