import { describe, it, expect } from 'vitest';
import { trainLayout, lapTime, formatLapTime, type TrainEntry } from '../src/core/raceView';

const OPTS = { minSep: 0.045, gapScale: 0.0714, maxSpread: 0.5 };

function e(id: string, progress: number, grid: number, crashed = false): TrainEntry {
  return { id, progress, crashed, grid };
}

describe('trainLayout', () => {
  it('orders slots by progress desc and assigns strictly increasing placeBehind', () => {
    const slots = trainLayout([e('a', 14, 3), e('b', 20, 1), e('c', 17, 2)], OPTS);
    expect(slots.map((s) => s.id)).toEqual(['b', 'c', 'a']); // 20, 17, 14 (gaps within maxSpread)
    expect(slots[0].placeBehind).toBe(0);
    expect(slots[1].placeBehind).toBeGreaterThan(slots[0].placeBehind);
    expect(slots[2].placeBehind).toBeGreaterThan(slots[1].placeBehind);
  });

  it('separates equal-progress riders by MIN_SEP, tie-broken by grid', () => {
    const slots = trainLayout([e('x', 7, 2), e('y', 7, 1)], OPTS);
    expect(slots.map((s) => s.id)).toEqual(['y', 'x']); // grid 1 before grid 2
    expect(slots[0].placeBehind).toBe(0);
    expect(slots[1].placeBehind).toBeCloseTo(0.045, 5);
  });

  it('reflects the real gap once it exceeds the running minimum', () => {
    // leader 20, trailer 6 → gap 14 → 14*0.0714 ≈ 1.0, clamped to maxSpread 0.5
    const slots = trainLayout([e('a', 20, 1), e('b', 6, 2)], OPTS);
    expect(slots[1].placeBehind).toBe(0.5);
  });

  it('never exceeds MAX_SPREAD', () => {
    const slots = trainLayout([e('a', 100, 1), e('b', 0, 2), e('c', 0, 3)], OPTS);
    for (const s of slots) expect(s.placeBehind).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it('excludes crashed riders from spacing and ranks them last', () => {
    const slots = trainLayout([e('a', 20, 1), e('dead', 18, 2, true), e('b', 10, 3)], OPTS);
    const runners = slots.filter((s) => !s.crashed).map((s) => s.id);
    expect(runners).toEqual(['a', 'b']); // crashed not interleaved
    const dead = slots.find((s) => s.id === 'dead')!;
    expect(dead.crashed).toBe(true);
    expect(dead.rank).toBe(3); // after the 2 runners
  });
});

describe('lapTime', () => {
  it('returns base when a lap covers exactly one loop', () => {
    expect(lapTime(7, 7, 90)).toBeCloseTo(90, 6);
  });
  it('returns a smaller time for a faster (bigger-delta) lap', () => {
    expect(lapTime(8, 7, 90)).toBeLessThan(90);
    expect(lapTime(6, 7, 90)).toBeGreaterThan(90);
  });
  it('stays finite when delta collapses to zero', () => {
    expect(Number.isFinite(lapTime(0, 7, 90))).toBe(true);
  });
  it('compresses realistic pace variation into a tight band around base', () => {
    // deltas across a normal race lap (5..9 on a 7 loop) should stay near 90s, not 54s..2:22.
    for (const d of [5, 6, 7, 8, 9]) {
      const t = lapTime(d, 7, 90);
      expect(t).toBeGreaterThan(80);
      expect(t).toBeLessThan(100);
    }
  });
});

describe('formatLapTime', () => {
  it('formats at/over a minute as M:SS.mmm', () => {
    expect(formatLapTime(89.43)).toBe('1:29.430');
    expect(formatLapTime(60)).toBe('1:00.000');
  });
  it('formats under a minute as SS.mmm', () => {
    expect(formatLapTime(58.2)).toBe('58.200');
    expect(formatLapTime(5.5)).toBe('5.500');
  });
});
