import { describe, it, expect } from 'vitest';
import { runOffSeason } from '../src/core/OffSeason';
import { newCareer } from '../src/core/CareerStore';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { applyRaceResult } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceEngine';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';

function bootstrapSeason(career: ReturnType<typeof newCareer>, rng: RNG): void {
  const season = createSeason(career.team, PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
  for (let i = 0; i < 6; i++) {
    const result = simulateRace(season, 'topSpeed', 'medium', new RNG(99 + i));
    applyRaceResult(season, result);
  }
  career.season = season;
}

function forceFinish(career: ReturnType<typeof newCareer>, top3: boolean): void {
  const player = career.season!.playerRider;
  if (top3) { player.points = 300; player.positionCounts[0] = 6; }
  else { player.points = 0; player.positionCounts[9] = 6; }
}

describe('tier difficulty — aiStatBonus is applied', () => {
  it('rookies joining a factory-tier career carry the +2 tier bonus (skills >= 4)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(seed));
      career.tierId = 'factory';
      bootstrapSeason(career, new RNG(seed + 1000));
      forceFinish(career, false); // no promotion; already factory
      const report = runOffSeason(career, new RNG(seed + 2000));
      for (const name of report.rookies) {
        const rookie = career.field.find((r) => r.name === name)!;
        expect(rookie.skills.pace).toBeGreaterThanOrEqual(4);
        expect(rookie.skills.cornering).toBeGreaterThanOrEqual(4);
        expect(rookie.skills.consistency).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('promotion makes the surviving field one notch stronger', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(5));
    career.tierId = 'rookie';
    bootstrapSeason(career, new RNG(6));
    // Freeze out confounds: young field (no age decline possible this off-season).
    for (const r of career.field) r.age = 20;
    const skillTotal = (rs: { pace: number; cornering: number; consistency: number }): number =>
      rs.pace + rs.cornering + rs.consistency;
    const before = new Map(career.field.map((r) => [r.id, skillTotal(r.skills)]));
    forceFinish(career, true);
    const report = runOffSeason(career, new RNG(7));
    expect(report.promoted).toBe(true);
    // Every surviving AI gained at least the +1 class step-up (random improvements may add more).
    const survivors = career.field.filter((r) => before.has(r.id));
    expect(survivors.length).toBeGreaterThan(0);
    for (const r of survivors) {
      expect(skillTotal(r.skills)).toBeGreaterThanOrEqual(before.get(r.id)! + 1);
    }
  });

  it('no promotion means no class step-up', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(8));
    career.tierId = 'rookie';
    bootstrapSeason(career, new RNG(9));
    for (const r of career.field) r.age = 20;
    const before = new Map(career.field.map((r) => [r.id, r.skills.pace + r.skills.cornering + r.skills.consistency]));
    forceFinish(career, false);
    const report = runOffSeason(career, new RNG(10));
    expect(report.promoted).toBe(false);
    // Only the 30%-chance random improvement can bump a survivor (+1 max), so at
    // least one survivor should be unchanged with this seed.
    const survivors = career.field.filter((r) => before.has(r.id));
    const unchanged = survivors.filter((r) => r.skills.pace + r.skills.cornering + r.skills.consistency === before.get(r.id));
    expect(unchanged.length).toBeGreaterThan(0);
  });
});
