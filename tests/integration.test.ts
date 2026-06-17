import { describe, it, expect, beforeEach } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace } from '../src/core/RaceSimulator';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { applyProgression, resetProgression } from '../src/core/Progression';
import { dominantSetup } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { SEASON_RACE_COUNT } from '../src/core/constants';

beforeEach(resetProgression);

describe('full season integration', () => {
  it('completes 6 races, applies progression, and crowns a champion', () => {
    const rng = new RNG(2026);
    const season = createSeason('Me', PILOT_ROSTER[3], BRAND_ROSTER[2], rng);
    const startPace = season.playerRider.skills.pace + season.playerRider.skills.cornering + season.playerRider.skills.consistency;
    let races = 0;
    while (!season.isSeasonComplete) {
      const track = season.calendar[season.currentRaceIndex];
      const result = simulateRace(season, dominantSetup(track), 'medium', 'medium', rng);
      applyProgression([season.playerRider, ...season.aiRiders], result);
      applyRaceResult(season, result);
      races++;
    }
    expect(races).toBe(SEASON_RACE_COUNT);
    expect(season.raceResults).toHaveLength(SEASON_RACE_COUNT);
    expect(getChampion(season)).toBeDefined();
    // Progression happened: player skills grew over the season.
    const endPace = season.playerRider.skills.pace + season.playerRider.skills.cornering + season.playerRider.skills.consistency;
    expect(endPace).toBeGreaterThan(startPace);
    // Points conserved: 101 per race.
    const total = [season.playerRider, ...season.aiRiders].reduce((a, r) => a + r.points, 0);
    expect(total).toBe(101 * SEASON_RACE_COUNT);
  });

  it('runRace yields a timeline whose final leader matches the race winner', async () => {
    const { runRace } = await import('../src/core/RaceEngine');
    const rng = new RNG(2026);
    const season = createSeason('Me', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
    const { result, timeline } = runRace(season, 'topSpeed', 'medium', 'high', rng);
    expect(timeline.laps).toHaveLength(timeline.totalLaps);
    const last = timeline.laps[timeline.laps.length - 1].entries;
    const finishers = last.filter((e) => !e.crashed);
    if (finishers.length > 0) {
      const leaderId = finishers.slice().sort((a, b) => b.progress - a.progress)[0].riderId;
      expect(result.finishingOrder[0].rider.id).toBe(leaderId);
    }
  });

  it('throws if simulating past the calendar', () => {
    const rng = new RNG(1);
    const season = createSeason('Me', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
    while (!season.isSeasonComplete) {
      const r = simulateRace(season, 'handling', 'medium', 'low', rng);
      applyProgression([season.playerRider, ...season.aiRiders], r);
      applyRaceResult(season, r);
     }
     expect(() => simulateRace(season, 'handling', 'medium', 'low', rng)).toThrow();
    });
});
