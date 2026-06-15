import { describe, it, expect } from 'vitest';
import { createPlayerRider, generateAIRiders, validatePointBuy } from '../src/core/factories/RiderFactory';
import { RNG } from '../src/core/RNG';
import { AI_STAT_MIN, AI_STAT_MAX, AI_SUM_MIN, AI_SUM_MAX } from '../src/core/constants';

describe('RiderFactory', () => {
  it('createPlayerRider sets given name/team/stats and isPlayer', () => {
    const r = createPlayerRider('Me', 'My Team', { pace: 8, cornering: 5, consistency: 5 });
    expect(r.isPlayer).toBe(true);
    expect(r.name).toBe('Me');
    expect(r.stats.pace).toBe(8);
    expect(r.points).toBe(0);
    expect(r.positionCounts).toHaveLength(10);
  });

  it('validatePointBuy accepts exactly 18 with in-range stats', () => {
    expect(validatePointBuy({ pace: 6, cornering: 6, consistency: 6 })).toBe(true);
    expect(validatePointBuy({ pace: 10, cornering: 7, consistency: 1 })).toBe(true);
  });

  it('validatePointBuy rejects wrong total or out-of-range', () => {
    expect(validatePointBuy({ pace: 6, cornering: 6, consistency: 5 })).toBe(false); // 17
    expect(validatePointBuy({ pace: 11, cornering: 6, consistency: 1 })).toBe(false); // out of range
    expect(validatePointBuy({ pace: 0, cornering: 9, consistency: 9 })).toBe(false); // below min
  });

  it('generateAIRiders makes 9 riders within stat bounds and unique names', () => {
    const ai = generateAIRiders(new RNG(5), ['Me']);
    expect(ai).toHaveLength(9);
    const names = new Set(ai.map((r) => r.name));
    expect(names.size).toBe(9);
    for (const r of ai) {
      const sum = r.stats.pace + r.stats.cornering + r.stats.consistency;
      expect(sum).toBeGreaterThanOrEqual(AI_SUM_MIN);
      expect(sum).toBeLessThanOrEqual(AI_SUM_MAX);
      for (const v of [r.stats.pace, r.stats.cornering, r.stats.consistency]) {
        expect(v).toBeGreaterThanOrEqual(AI_STAT_MIN);
        expect(v).toBeLessThanOrEqual(AI_STAT_MAX);
      }
    }
  });
});
