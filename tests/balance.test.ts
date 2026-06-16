import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace } from '../src/core/RaceSimulator';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { applyProgression, investBikePoint } from '../src/core/Progression';
import { dominantSetup } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import { TARGET_BUILD_RATE, MAX_BUILD_RATE_SPREAD } from '../src/core/constants';
import type { PilotArchetype, Brand, Track, Risk, Setup, BikeParams } from '../src/core/types';

const PACE: { pilot: PilotArchetype; brand: Brand } = {
  pilot: { id: 'p', name: 'Pace', nickname: '', skills: { pace: 9, cornering: 5, consistency: 6 } },
  brand: { id: 'velocita', name: 'Velocita', params: { speed: 9, handling: 6, acceleration: 6 } },
};
const CORNER: { pilot: PilotArchetype; brand: Brand } = {
  pilot: { id: 'c', name: 'Corner', nickname: '', skills: { pace: 5, cornering: 9, consistency: 6 } },
  brand: { id: 'apex', name: 'Apex', params: { speed: 6, handling: 9, acceleration: 6 } },
};
const BAL: { pilot: PilotArchetype; brand: Brand } = {
  pilot: { id: 'b', name: 'Bal', nickname: '', skills: { pace: 7, cornering: 7, consistency: 6 } },
  brand: { id: 'titan', name: 'Titan', params: { speed: 7, handling: 7, acceleration: 7 } },
};

// Reasonable player policy: setup = track's dominant axis; push hard on safe (low-cornering)
// tracks, but back off on crashy technical tracks unless your consistency can absorb it.
function policyRisk(track: Track, consistency: number): Risk {
  const crashy = track.weights.cornering > 0.30; // matches CRASH_TECH_THRESHOLD
  if (!crashy || consistency >= 7) return 'high';
  return 'medium';
}

type SetupFn = (track: Track) => Setup;

function playSeason(
  build: { pilot: PilotArchetype; brand: Brand }, seed: number,
  riskFn: (t: Track, c: number) => Risk = policyRisk, setupFn: SetupFn = dominantSetup,
): boolean {
  const rng = new RNG(seed);
  const season = createSeason('Me', build.pilot, build.brand, rng);
  while (!season.isSeasonComplete) {
    const track = season.calendar[season.currentRaceIndex];
    const p = season.playerRider;
    // Invest accumulated R&D into the weakest bike param before racing.
    while (p.rndPoints > 0) {
      const weakest = (['speed', 'handling', 'acceleration'] as (keyof BikeParams)[])
        .sort((a, b) => p.bike[a] - p.bike[b])[0];
      if (!investBikePoint(p, weakest)) break;
    }
    const result = simulateRace(season, setupFn(track), riskFn(track, p.skills.consistency), rng);
    applyProgression([p, ...season.aiRiders], result);
    applyRaceResult(season, result);
  }
  return getChampion(season).id === 'player';
}

function rate(
  build: { pilot: PilotArchetype; brand: Brand }, n = 1000,
  riskFn: (t: Track, c: number) => Risk = policyRisk, setupFn: SetupFn = dominantSetup,
): number {
  let wins = 0;
  for (let i = 0; i < n; i++) if (playSeason(build, i, riskFn, setupFn)) wins++;
  return wins / n;
}

describe('balance harness', () => {
  it('the three reference builds are co-equal within target', () => {
    const pace = rate(PACE), corner = rate(CORNER), bal = rate(BAL);
    console.log(`pace ${(pace * 100).toFixed(1)}%  corner ${(corner * 100).toFixed(1)}%  balanced ${(bal * 100).toFixed(1)}%`);
    for (const r of [pace, corner, bal]) {
      expect(r).toBeGreaterThanOrEqual(TARGET_BUILD_RATE[0]);
      expect(r).toBeLessThanOrEqual(TARGET_BUILD_RATE[1]);
    }
    const spread = Math.max(pace, corner, bal) - Math.min(pace, corner, bal);
    console.log(`spread ${(spread * 100).toFixed(1)} pts`);
    expect(spread).toBeLessThanOrEqual(MAX_BUILD_RATE_SPREAD);
  });

  it('setup matters: reading the track beats a fixed setup', () => {
    // Matching setup to each track's dominant axis should beat always running the
    // same setup — this is the per-race "read the track" decision.
    const adaptive = rate(BAL, 600);
    const alwaysTopSpeed = rate(BAL, 600, policyRisk, () => 'topSpeed');
    console.log(`setup adaptive ${(adaptive * 100).toFixed(1)}% vs always-topSpeed ${(alwaysTopSpeed * 100).toFixed(1)}%`);
    expect(adaptive - alwaysTopSpeed).toBeGreaterThanOrEqual(0.04);
  });

  it('risk matters: you must take risk to win — adaptive beats always-low', () => {
    // Pushing (risk) is required to win; never pushing leaves wins on the table.
    const adaptive = rate(BAL, 600);
    const alwaysLow = rate(BAL, 600, () => 'low');
    console.log(`risk adaptive ${(adaptive * 100).toFixed(1)}% vs always-low ${(alwaysLow * 100).toFixed(1)}%`);
    expect(adaptive - alwaysLow).toBeGreaterThanOrEqual(0.04);
  });

  it('crash rate stays in a sane band under a reasonable policy', () => {
    let races = 0, crashes = 0;
    for (let seed = 0; seed < 300; seed++) {
      const rng = new RNG(seed);
      const season = createSeason('Me', BAL.pilot, BAL.brand, rng);
      while (!season.isSeasonComplete) {
        const track = season.calendar[season.currentRaceIndex];
        const result = simulateRace(season, dominantSetup(track), policyRisk(track, season.playerRider.skills.consistency), rng);
        const me = result.finishingOrder.find((e) => e.rider.isPlayer)!;
        races++; if (me.crashed) crashes++;
        applyProgression([season.playerRider, ...season.aiRiders], result);
        applyRaceResult(season, result);
      }
    }
    const crashRate = crashes / races;
    console.log(`player crash rate ${(crashRate * 100).toFixed(1)}%`);
    expect(crashRate).toBeGreaterThan(0.03);
    expect(crashRate).toBeLessThan(0.30);
  });
});
