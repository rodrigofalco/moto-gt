import { describe, it, expect } from 'vitest';
import { buildPath, pointAt } from '../src/core/Path';

const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

describe('Path', () => {
  it('builds a non-empty closed sample list', () => {
    const p = buildPath(square);
    expect(p.samples.length).toBeGreaterThan(square.length);
    const first = p.samples[0];
    const last = p.samples[p.samples.length - 1];
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(0.3);
  });

  it('pointAt wraps t into [0,1) and returns finite points', () => {
    const p = buildPath(square);
    const a = pointAt(p, 0);
    const b = pointAt(p, 1.0);
    expect(a).toEqual(b);
    const c = pointAt(p, 0.25);
    expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
  });

  it('moves around the loop as t increases', () => {
    const p = buildPath(square);
    const q0 = pointAt(p, 0.0);
    const q2 = pointAt(p, 0.5);
    expect(Math.hypot(q2.x - q0.x, q2.y - q0.y)).toBeGreaterThan(0.3);
  });
});
