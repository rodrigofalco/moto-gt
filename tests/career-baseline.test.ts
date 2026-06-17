import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace, finalizeRace } from '../src/core/RaceEngine';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { RNG } from '../src/core/RNG';

// Simple RNG wrapper so tests don't import internal types directly
// (the RNG class is already imported above; this is just a convenience alias)
type RNGType = RNG;

function simulateOneRace(
  season: ReturnType<typeof createSeason>,
  rng: RNGType
): ReturnType<typeof simulateRace> {
  const result = simulateRace(season, { topSpeed: 1, handling: 1, acceleration: 1 }, 'medium', rng);
  applyRaceResult(season, result);
  return result;
}

describe('P0.2 — full season characterization', () => {
  it('plays a complete 6-race season end-to-end', () => {
    const rng = new RNG(7);
    const season = createSeason('Test Team', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);

    expect(season.calendar.length).toBe(6);
    expect(season.aiRiders.length).toBe(9);
    expect(season.isSeasonComplete).toBe(false);
    expect(season.raceResults.length).toBe(0);

    // Play all 6 races
    for (let i = 0; i < 6; i++) {
      const result = simulateOneRace(season, new RNG(7 + i));

      // Each race must have exactly 10 finishers
      expect(result.finishingOrder.length).toBe(10);

      // Every finisher must have a valid position 1..10
      const positions = result.finishingOrder.map((e) => e.position);
      expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // Accumulating results
      expect(season.raceResults.length).toBe(i + 1);
    }

    // Season must be complete
    expect(season.isSeasonComplete).toBe(true);
    expect(season.currentRaceIndex).toBe(6);

    // Champion must be a rider (not undefined/null)
    const champion = getChampion(season);
    expect(champion).toBeDefined();
    expect(typeof champion.id).toBe('string');
    expect(champion.points).toBeGreaterThan(0);
  });

  it('produces deterministic results with the same seed', () => {
    const rng1 = new RNG(42);
    const season1 = createSeason('Team A', PILOT_ROSTER[0], BRAND_ROSTER[0], rng1);

    const rng2 = new RNG(42);
    const season2 = createSeason('Team A', PILOT_ROSTER[0], BRAND_ROSTER[0], rng2);

    for (let i = 0; i < 6; i++) {
      const r1 = simulateRace(season1, { topSpeed: 1, handling: 1, acceleration: 1 }, 'medium', new RNG(42 + i));
      const r2 = simulateRace(season2, { topSpeed: 1, handling: 1, acceleration: 1 }, 'medium', new RNG(42 + i));

      const pos1 = r1.finishingOrder.map((e) => e.rider.id);
      const pos2 = r2.finishingOrder.map((e) => e.rider.id);
      expect(pos1).toEqual(pos2);
    }
  });

  it('fails if you delete a race from the loop', () => {
    const rng = new RNG(7);
    const season = createSeason('Test Team', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);

    // Only 5 races instead of 6
    for (let i = 0; i < 5; i++) {
      simulateOneRace(season, new RNG(7 + i));
    }

    // Season should NOT be complete yet
    expect(season.isSeasonComplete).toBe(false);
    expect(season.currentRaceIndex).toBe(5);
    expect(season.raceResults.length).toBe(5);
  });
});
