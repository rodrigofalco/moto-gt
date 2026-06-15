import { describe, it, expect } from 'vitest';
import { mistakeProbability, mistakePenalty } from '../src/core/MistakeSystem';
import { RNG } from '../src/core/RNG';

describe('MistakeSystem', () => {
  it('aggressive is riskier than safe at equal consistency', () => {
    expect(mistakeProbability('aggressive', 5)).toBeGreaterThan(mistakeProbability('safe', 5));
  });

  it('higher consistency lowers probability', () => {
    expect(mistakeProbability('balanced', 10)).toBeLessThan(mistakeProbability('balanced', 1));
  });

  it('never drops below the floor fraction of base', () => {
    // consistency 10 → factor 0.40; aggressive base 0.25 → 0.10
    expect(mistakeProbability('aggressive', 10)).toBeCloseTo(0.10, 5);
  });

  it('penalty is within [4,10]', () => {
    const r = new RNG(3);
    for (let i = 0; i < 1000; i++) {
      const p = mistakePenalty(r);
      expect(p).toBeGreaterThanOrEqual(4);
      expect(p).toBeLessThanOrEqual(10);
    }
  });
});
