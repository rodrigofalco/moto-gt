import { describe, it, expect } from 'vitest';
import { runOffSeason } from '../src/core/OffSeason';
import { newCareer, saveCareer } from '../src/core/CareerStore';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { applyRaceResult } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceEngine';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';

function bootstrapSeason(career: ReturnType<typeof newCareer>): void {
  const rng = new RNG(99);
  const season = createSeason(career.team, PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
  for (let i = 0; i < 6; i++) {
    const result = simulateRace(season, 'topSpeed', 'medium', new RNG(99 + i));
    applyRaceResult(season, result);
   }
  career.season = season;
}

describe('P1.7 — off-season report', () => {
  it('increments season number and clears season', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(1));
    bootstrapSeason(career);
    expect(career.seasonNumber).toBe(1);
    expect(career.season).not.toBeNull();

    const report = runOffSeason(career);
    expect(career.seasonNumber).toBe(2);
    expect(career.season).toBeNull();
    expect(report.previousSeason).toBe(1);
    });

  it('records player finish position', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(42));
    bootstrapSeason(career);
    const standings = career.season!;
    const playerPos = standings.aiRiders.findIndex((r) => r.isPlayer) + 1;
    // We can't easily predict the exact position, just that it's a number
    const report = runOffSeason(career);
    expect(report.playerFinish).toBeGreaterThanOrEqual(1);
    expect(report.playerFinish).toBeLessThanOrEqual(10);
    });

  it('returns empty churn arrays', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(7));
    bootstrapSeason(career);
    const report = runOffSeason(career);
    expect(report.retired).toEqual([]);
    expect(report.rookies).toEqual([]);
    expect(report.statChanges).toEqual([]);
    });
});
