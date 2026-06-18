import { describe, it, expect } from 'vitest';
import { newCareer } from '../src/core/CareerStore';
import { createSeasonForCareer } from '../src/core/factories/SeasonFactory';
import { runOffSeason } from '../src/core/OffSeason';
import { applyRaceResult } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceEngine';
import { applyProgression } from '../src/core/Progression';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';

function bootstrapSeason(career: ReturnType<typeof newCareer>, seed: number): void {
  const rng = new RNG(seed);
  const season = createSeasonForCareer(career, rng);
  for (let i = 0; i < 6; i++) {
    const result = simulateRace(season, 'topSpeed', 'medium', new RNG(seed + i + 100));
    applyProgression([season.playerRider, ...season.aiRiders], result);
    applyRaceResult(season, result);
       }
  career.season = season;
}

describe('P1.10 — multi-season reset', () => {
  it('season 2 starts clean but preserves long-term progress', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(777));

       // Season 1
    bootstrapSeason(career, 1);

       // Simulate some long-term growth in season 1
    career.player.points = 80;
    career.player.skills.pace += 1;
    career.player.pilotXp = 50;
    career.player.rndPoints = 10;
    const bikeSpeed = career.player.bike.speed;
    const bikeHandling = career.player.bike.handling;
    // Ensure player is NOT top-3 so promotion doesn't trigger (standings uses points)
    career.player.points = 2;
    career.player.positionCounts = new Array(10).fill(0);
    career.player.positionCounts[9] = 6; // 10th place every race

       // Off-season clears the season
    runOffSeason(career);
    expect(career.season).toBeNull();
    expect(career.seasonNumber).toBe(2);

       // Start season 2 — capture fresh season state BEFORE running races
    const rng2 = new RNG(2);
    const season2 = createSeasonForCareer(career, rng2);
    career.season = season2;

       // Assert per-season fields are reset on the season
    expect(season2.currentRaceIndex).toBe(0);
    expect(season2.raceResults.length).toBe(0);
    expect(season2.isSeasonComplete).toBe(false);

       // Assert per-season fields are reset on all riders
    expect(career.player.points).toBe(0);
    expect(career.player.positionCounts).toEqual(new Array(10).fill(0));
    for (const r of career.field) {
      expect(r.points).toBe(0);
      expect(r.positionCounts).toEqual(new Array(10).fill(0));
        }

       // Assert long-term fields are preserved
    expect(career.player.skills.pace).toBeGreaterThan(1); // was bumped
    expect(career.player.pilotXp).toBe(50);
    expect(career.player.rndPoints).toBe(10);
    expect(career.player.bike.speed).toBe(bikeSpeed);
    expect(career.player.bike.handling).toBe(bikeHandling);
    expect(career.money).toBe(2000); // unchanged
    expect(career.tierId).toBe('rookie'); // unchanged
      });

  it('preserves rider identity across seasons', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(888));
    bootstrapSeason(career, 3);
    const playerId = career.player.id;
    const fieldIds = career.field.map((r) => r.id);

    runOffSeason(career);
    bootstrapSeason(career, 4);

    expect(career.player.id).toBe(playerId);
    expect(career.field.map((r) => r.id)).toEqual(fieldIds);
      });
});
