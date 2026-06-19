import { describe, it, expect } from 'vitest';
import { PILOT_ROSTER, AI_EXTRA_NAMES } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { TRACK_BANK } from '../src/data/tracks';
import { RIDER_NAMES } from '../src/data/names';

describe('data rosters', () => {
  it('has 18 pilots with in-range skills and unique ids', () => {
    expect(PILOT_ROSTER).toHaveLength(18);
    expect(new Set(PILOT_ROSTER.map((p) => p.id)).size).toBe(18);
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

  it('has at least 40 unique rider names with no duplicates', () => {
    const allNames = [...RIDER_NAMES, ...AI_EXTRA_NAMES];
    expect(allNames.length).toBeGreaterThanOrEqual(40);
    const unique = new Set(allNames);
    expect(unique.size).toBe(allNames.length);
    });

  it('RIDER_NAMES alone has at least 40 entries', () => {
    expect(RIDER_NAMES.length).toBeGreaterThanOrEqual(40);
    const unique = new Set(RIDER_NAMES);
    expect(unique.size).toBe(RIDER_NAMES.length);
    });
});
