import { describe, it, expect } from 'vitest';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { TRACK_BANK } from '../src/data/tracks';

describe('data rosters', () => {
  it('has 6 pilots with in-range skills and unique ids', () => {
    expect(PILOT_ROSTER).toHaveLength(6);
    expect(new Set(PILOT_ROSTER.map((p) => p.id)).size).toBe(6);
    for (const p of PILOT_ROSTER) {
      for (const v of [p.skills.pace, p.skills.cornering, p.skills.consistency]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it('has 4 brands with in-range params', () => {
    expect(BRAND_ROSTER).toHaveLength(4);
    for (const b of BRAND_ROSTER) {
      for (const v of [b.params.speed, b.params.handling, b.params.acceleration]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it('has 6 tracks whose axis weights sum to 1', () => {
    expect(TRACK_BANK).toHaveLength(6);
    for (const t of TRACK_BANK) {
      const sum = t.weights.speed + t.weights.cornering + t.weights.acceleration;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});
