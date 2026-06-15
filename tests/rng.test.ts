import { describe, it, expect } from 'vitest';
import { RNG } from '../src/core/RNG';

describe('RNG', () => {
  it('is deterministic for a fixed seed', () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    const seqA = [a.nextFloat(), a.nextFloat(), a.nextFloat()];
    const seqB = [b.nextFloat(), b.nextFloat(), b.nextFloat()];
    expect(seqA).toEqual(seqB);
  });

  it('nextFloat is in [0,1)', () => {
    const r = new RNG(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt is inclusive of both bounds', () => {
    const r = new RNG(7);
    let sawMin = false, sawMax = false;
    for (let i = 0; i < 2000; i++) {
      const v = r.nextInt(2, 4);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(4);
      if (v === 2) sawMin = true;
      if (v === 4) sawMax = true;
    }
    expect(sawMin && sawMax).toBe(true);
  });

  it('gaussian has roughly mean 0', () => {
    const r = new RNG(99);
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += r.gaussian(0, 1.5);
    expect(Math.abs(sum / n)).toBeLessThan(0.15);
  });
});
