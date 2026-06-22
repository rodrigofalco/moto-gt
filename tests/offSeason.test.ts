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

function bootstrapSeason(career: ReturnType<typeof newCareer>, rng: RNG): void {
  const season = createSeason(career.team, PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
  for (let i = 0; i < 6; i++) {
    const result = simulateRace(season, 'topSpeed', 'medium', new RNG(99 + i));
    applyRaceResult(season, result);
     }
  career.season = season;
}

describe('P1.7 — off-season report', () => {
  it('increments season number and clears season', () => {
    const rng = new RNG(1);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    bootstrapSeason(career, rng);
    expect(career.seasonNumber).toBe(1);
    expect(career.season).not.toBeNull();

    const report = runOffSeason(career, new RNG(100));
    expect(career.seasonNumber).toBe(2);
    expect(career.season).toBeNull();
    expect(report.previousSeason).toBe(1);
      });

  it('records player finish position', () => {
    const rng = new RNG(42);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    bootstrapSeason(career, rng);
       // We can't easily predict the exact position, just that it's a number
    const report = runOffSeason(career, new RNG(101));
    expect(report.playerFinish).toBeGreaterThanOrEqual(1);
    expect(report.playerFinish).toBeLessThanOrEqual(10);
       });

  it('churns 1-2 riders and adds rookies, keeping field at 9', () => {
    const rng = new RNG(7);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    bootstrapSeason(career, rng);
    const beforeCount = career.field.length;
    const report = runOffSeason(career, new RNG(102));
    expect(beforeCount).toBe(9);
    expect(career.field.length).toBe(9);
    expect(report.retired.length).toBeGreaterThanOrEqual(1);
    expect(report.retired.length).toBeLessThanOrEqual(2);
    expect(report.retired.length).toBe(report.rookies.length);
         });
});

describe('P2.7 — aging', () => {
  it('increments every rider age by 1', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(10));
    bootstrapSeason(career, new RNG(20));
    const startAge = career.player.age;
    // Track the youngest AI by id — off-season retires the oldest/weakest
    // (score = totalSkills - age*0.1; all pilots sum to 20 so highest age retires
    // first). career.field is reordered after off-season, so index 0 may be a
    // different rider; the youngest AI survives and should age by 1.
    const tracker = [...career.field].sort((a, b) => a.age - b.age)[0];
    const startAiAge = tracker.age;
    runOffSeason(career, new RNG(30));
    expect(career.player.age).toBe(startAge + 1);
    const survived = career.field.find((r) => r.id === tracker.id);
    expect(survived).toBeDefined();
    expect(survived!.age).toBe(startAiAge + 1);
  });

  it('young rider (under PEAK_AGE) never declines', () => {
    const rng = new RNG(42);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    bootstrapSeason(career, new RNG(50));
    const paceBefore = career.player.skills.pace;
    // Force young age (22) and run 10 off-seasons
    career.player.age = 22;
    for (let i = 0; i < 10; i++) {
      runOffSeason(career, new RNG(60 + i));
    }
    expect(career.player.skills.pace).toBe(paceBefore);
  });

  it('old rider (over PEAK_AGE) can decline', () => {
    const rng = new RNG(77);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    bootstrapSeason(career, new RNG(80));
    // Force old age and high consistency so decline is likely
    career.player.age = 38;
    career.player.skills = { pace: 5, cornering: 5, consistency: 5 };
    const totalBefore = career.player.skills.pace + career.player.skills.cornering + career.player.skills.consistency;
    // Run many off-seasons with a seed that produces high decline rolls
    for (let i = 0; i < 20; i++) {
      runOffSeason(career, new RNG(88 + i));
    }
    const totalAfter = career.player.skills.pace + career.player.skills.cornering + career.player.skills.consistency;
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  it('statChanges records declines', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(90));
    bootstrapSeason(career, new RNG(91));
    career.player.age = 40;
    career.player.skills = { pace: 5, cornering: 5, consistency: 5 };
    const report = runOffSeason(career, new RNG(92));
    const playerChange = report.statChanges.find((s) => s.riderId === 'player');
    expect(playerChange).toBeDefined();
    expect(playerChange!.note).toContain('declined');
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
    const rng = new RNG(100);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    career.tierId = 'rookie';
    bootstrapSeason(career, rng);
      // Manually set player to P1 so promotion triggers
    const standings = career.season!;
    const player = standings.playerRider;
    player.points = 100;
    player.positionCounts[0] = 6; // 6 wins
    // Re-apply so standings reflect the change
    const report = runOffSeason(career, new RNG(103));
    expect(report.promoted).toBe(true);
    expect(career.tierId).toBe('pro');
      });

  it('does not promote on P8 finish', () => {
    const rng = new RNG(200);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    career.tierId = 'rookie';
    bootstrapSeason(career, rng);
      // Manually set player to P8 (low points)
    const standings = career.season!;
    const player = standings.playerRider;
    player.points = 2;
    player.positionCounts[9] = 5;
    player.positionCounts[8] = 1;
    const report = runOffSeason(career, new RNG(104));
    expect(report.promoted).toBe(false);
    expect(career.tierId).toBe('rookie');
      });
});
