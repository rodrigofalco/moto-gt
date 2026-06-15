import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { RNG } from '../src/core/RNG';

describe('SeasonFactory', () => {
  it('creates 1 player + 9 AI + 6 tracks', () => {
    const s = createSeason('Me', 'My Team', { pace: 6, cornering: 6, consistency: 6 }, new RNG(1));
    expect(s.playerRider.isPlayer).toBe(true);
    expect(s.aiRiders).toHaveLength(9);
    expect(s.calendar).toHaveLength(6);
    expect(s.currentRaceIndex).toBe(0);
    expect(s.isSeasonComplete).toBe(false);
  });

  it('calendar has both a low (<0.3) and a high (>0.7) technicality track', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = createSeason('Me', 'T', { pace: 6, cornering: 6, consistency: 6 }, new RNG(seed));
      expect(s.calendar.some((t) => t.technicality < 0.3)).toBe(true);
      expect(s.calendar.some((t) => t.technicality > 0.7)).toBe(true);
    }
  });

  it('calendar tracks are unique', () => {
    const s = createSeason('Me', 'T', { pace: 6, cornering: 6, consistency: 6 }, new RNG(3));
    expect(new Set(s.calendar.map((t) => t.id)).size).toBe(6);
  });
});
