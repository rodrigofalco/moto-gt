import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace } from '../src/core/RaceSimulator';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { RNG } from '../src/core/RNG';
import { SEASON_RACE_COUNT } from '../src/core/constants';

describe('full season integration', () => {
  it('completes 6 races and produces a champion', () => {
    const rng = new RNG(2026);
    const season = createSeason('Me', 'T', { pace: 7, cornering: 6, consistency: 5 }, rng);
    let races = 0;
    while (!season.isSeasonComplete) {
      const result = simulateRace(season, 'balanced', rng);
      applyRaceResult(season, result);
      races++;
    }
    expect(races).toBe(SEASON_RACE_COUNT);
    expect(season.currentRaceIndex).toBe(SEASON_RACE_COUNT);
    expect(season.raceResults).toHaveLength(SEASON_RACE_COUNT);
    const champion = getChampion(season);
    expect(champion).toBeDefined();
    // Total championship points across the grid = 101 per race.
    const total = [season.playerRider, ...season.aiRiders].reduce((s, r) => s + r.points, 0);
    expect(total).toBe(101 * SEASON_RACE_COUNT);
  });

  it('throws if simulating past the calendar', () => {
    const rng = new RNG(1);
    const season = createSeason('Me', 'T', { pace: 6, cornering: 6, consistency: 6 }, rng);
    while (!season.isSeasonComplete) applyRaceResult(season, simulateRace(season, 'safe', rng));
    expect(() => simulateRace(season, 'safe', rng)).toThrow();
  });
});
