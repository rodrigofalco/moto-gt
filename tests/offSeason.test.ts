import { describe, it, expect } from 'vitest';
import { runOffSeason } from '../src/core/OffSeason';
import { newCareer } from '../src/core/CareerStore';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { applyRaceResult } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceEngine';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { TIERS } from '../src/data/tiers';

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

describe('P1.9 — tier promotion', () => {
  it('has 3 tiers in order', () => {
    expect(TIERS).toHaveLength(3);
    expect(TIERS[0].id).toBe('rookie');
    expect(TIERS[1].id).toBe('pro');
    expect(TIERS[2].id).toBe('factory');
    expect(TIERS[0].aiStatBonus).toBe(0);
    expect(TIERS[1].aiStatBonus).toBe(1);
    expect(TIERS[2].aiStatBonus).toBe(2);
     });

  it('promotes on top-3 finish', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(100));
    career.tierId = 'rookie';
    bootstrapSeason(career);
     // Manually set player to P1 so promotion triggers
    const standings = career.season!;
    const player = standings.playerRider;
    player.points = 100;
    player.positionCounts[0] = 6; // 6 wins
    // Re-apply so standings reflect the change
    const report = runOffSeason(career);
    expect(report.promoted).toBe(true);
    expect(career.tierId).toBe('pro');
     });

  it('does not promote on P8 finish', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(200));
    career.tierId = 'rookie';
    bootstrapSeason(career);
     // Manually set player to P8 (low points)
    const standings = career.season!;
    const player = standings.playerRider;
    player.points = 2;
    player.positionCounts[9] = 5;
    player.positionCounts[8] = 1;
    const report = runOffSeason(career);
    expect(report.promoted).toBe(false);
    expect(career.tierId).toBe('rookie');
     });
});
