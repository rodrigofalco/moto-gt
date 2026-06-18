import { describe, it, expect, beforeEach } from 'vitest';
import { newCareer } from '../src/core/CareerStore';
import { createSeasonForCareer } from '../src/core/factories/SeasonFactory';
import { runOffSeason } from '../src/core/OffSeason';
import { applyRaceResult } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceEngine';
import { applyProgression, resetProgression } from '../src/core/Progression';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';

function runSeason(career: ReturnType<typeof newCareer>, seed: number): void {
  resetProgression();
  const rng = new RNG(seed);
  const season = createSeasonForCareer(career, rng);
  for (let i = 0; i < 6; i++) {
    const result = simulateRace(season, 'topSpeed', 'medium', new RNG(seed + i + 100));
    applyProgression([season.playerRider, ...season.aiRiders], result);
    applyRaceResult(season, result);
       }
  career.season = season;
}

describe('P2.4 — anti-cap regression', () => {
  it('not all skills max out after 2 seasons', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(555));
       // Season 1
    runSeason(career, 1);
    runOffSeason(career);
       // Season 2
    runSeason(career, 2);

    const s = career.player.skills;
       // At least one pilot skill is NOT 10
    expect(s.pace + s.cornering + s.consistency).toBeLessThan(30);
       // And at least one bike param is NOT 10
    const b = career.player.bike;
    expect(b.speed + b.handling + b.acceleration).toBeLessThan(30);
       });

  it('some growth still happens', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(666));
    const startPace = career.player.skills.pace;
    const startHandling = career.player.bike.handling;

    runSeason(career, 3);
    runOffSeason(career);
    runSeason(career, 4);

       // At least some growth occurred
    expect(career.player.skills.pace + career.player.skills.cornering + career.player.skills.consistency)
      .toBeGreaterThan(startPace + 5);
    });

  it('growth is slower than before the cost curve', () => {
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(777));
    const startTotal = career.player.skills.pace + career.player.skills.cornering + career.player.skills.consistency;
        // Run 4 seasons
    for (let s = 1; s <= 4; s++) {
      runSeason(career, s);
      runOffSeason(career);
        }
        // After 4 seasons, total skill should be < 30 (not maxed out)
    const endTotal = career.player.skills.pace + career.player.skills.cornering + career.player.skills.consistency;
    expect(endTotal).toBeLessThan(30);
        // And growth should be modest (not all 3 skills maxed)
    expect(endTotal - startTotal).toBeLessThan(12);
     });
});
