import { describe, it, expect } from 'vitest';
import { trainLayout, lapTime, formatLapTime, type TrainEntry } from '../src/core/raceView';

const OPTS = { minSep: 0.03, gapScale: 0.0714, maxStep: 0.06, maxSpread: 0.5 };

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
    expect(slots[1].placeBehind).toBeCloseTo(0.03, 5); // minSep, not stacked
  });

  it('caps an oversized gap at maxStep so the tail cannot run off the track', () => {
    // leader 20, trailer 6 → gap 14 → 14*0.0714 ≈ 1.0, clamped to maxStep 0.06
    const slots = trainLayout([e('a', 20, 1), e('b', 6, 2)], OPTS);
    expect(slots[1].placeBehind).toBeCloseTo(0.06, 5);
  });

  it('never stacks a whole lapped field — every dot stays >= MIN_SEP apart and in order', () => {
    // leader miles ahead, the rest jammed together: would all clamp to one point under the old cap.
    const slots = trainLayout([e('a', 100, 1), e('b', 0, 2), e('c', 0, 3), e('d', 0, 4)], OPTS);
    expect(slots.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].placeBehind - slots[i - 1].placeBehind).toBeGreaterThanOrEqual(0.03 - 1e-9);
    }
    // and the whole field still fits within one loop (no wrap onto the leader)
    expect(slots[slots.length - 1].placeBehind).toBeLessThan(1);
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
