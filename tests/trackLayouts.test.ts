import { describe, it, expect } from 'vitest';
import { TRACK_LAYOUTS } from '../src/data/trackLayouts';
import { TRACK_BANK } from '../src/data/tracks';
import { buildPath, pointAt } from '../src/core/Path';

describe('trackLayouts', () => {
  it('has a layout for every track id', () => {
    for (const t of TRACK_BANK) {
      expect(TRACK_LAYOUTS[t.id]).toBeDefined();
      expect(TRACK_LAYOUTS[t.id].points.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('layout points are within the unit square', () => {
    for (const id of Object.keys(TRACK_LAYOUTS)) {
      for (const p of TRACK_LAYOUTS[id].points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('each layout builds into a traversable closed path', () => {
    for (const id of Object.keys(TRACK_LAYOUTS)) {
      const path = buildPath(TRACK_LAYOUTS[id].points);
      expect(path.samples.length).toBeGreaterThan(50);
      const a = pointAt(path, 0), b = pointAt(path, 0.5);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.1);
    }
  });
});
