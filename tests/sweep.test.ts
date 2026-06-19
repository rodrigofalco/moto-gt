// Balance sweep / living report. Runs with a fast N so it can live in the suite;
// prints pilot×brand champion rates and marginals. Run alone: `npx vitest run sweep`.
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace } from '../src/core/RaceEngine';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { applyProgression, investBikePoint } from '../src/core/Progression';
import { dominantSetup } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import type { PilotArchetype, Brand, Track, Risk, BikeParams } from '../src/core/types';

const N = 150; // bump locally for sharper numbers

function policyRisk(track: Track, consistency: number): Risk {
  const crashy = track.weights.cornering > 0.30;
  if (!crashy || consistency >= 7) return 'high';
  return 'medium';
}

function playSeason(pilot: PilotArchetype, brand: Brand, seed: number): boolean {
  const rng = new RNG(seed);
  const season = createSeason('Me', pilot, brand, rng);
  while (!season.isSeasonComplete) {
    const track = season.calendar[season.currentRaceIndex];
    const p = season.playerRider;
    while (p.rndPoints > 0) {
      const weakest = (['speed', 'handling', 'acceleration'] as (keyof BikeParams)[]).sort((a, b) => p.bike[a] - p.bike[b])[0];
      if (!investBikePoint(p, weakest)) break;
    }
    const result = simulateRace(season, dominantSetup(track), policyRisk(track, p.skills.consistency), rng);
    applyProgression([p, ...season.aiRiders], result);
    applyRaceResult(season, result);
  }
  return getChampion(season).id === 'player';
}

const rate = (pilot: PilotArchetype, brand: Brand) => {
  let w = 0;
  for (let i = 0; i < N; i++) if (playSeason(pilot, brand, i)) w++;
  return w / N;
};

describe('balance sweep', () => {
  it('reports pilot×brand champion rates', () => {
    const rows: { pilot: string; brand: string; r: number }[] = [];
    for (const pilot of PILOT_ROSTER) {
      for (const brand of BRAND_ROSTER) rows.push({ pilot: pilot.nickname, brand: brand.name, r: rate(pilot, brand) });
    }
    rows.sort((a, b) => b.r - a.r);
    const lines = [`=== pilot×brand champion rate (N=${N}) ===`];
    for (const x of rows) lines.push(`${(x.r * 100).toFixed(1).padStart(5)}%  ${x.pilot.padEnd(20)} + ${x.brand}`);
    const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const group = (key: 'pilot' | 'brand') => {
      const m = new Map<string, number[]>();
      for (const x of rows) { const a = m.get(x[key]) ?? []; a.push(x.r); m.set(x[key], a); }
      return [...m.entries()].sort((a, b) => avg(b[1]) - avg(a[1])).map(([k, v]) => `${(avg(v) * 100).toFixed(1).padStart(5)}%  ${k}`);
    };
    lines.push('=== by pilot ===', ...group('pilot'), '=== by brand ===', ...group('brand'));
    lines.push(`=== spread ${(rows[0].r * 100).toFixed(1)}% .. ${(rows[rows.length - 1].r * 100).toFixed(1)}% ===`);
    const report = lines.join('\n');
    console.log('\n' + report);
    writeFileSync('/tmp/sweep-report.txt', report);
    expect(rows.length).toBe(72);
  });
});
