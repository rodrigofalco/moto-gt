import { describe, it, expect } from 'vitest';
import { runRace, simulateRace, createRace, stepLap, finalizeRace, momentumNoise, hasDraftTow } from '../src/core/RaceEngine';
import { RNG } from '../src/core/RNG';
import { RACE_LAPS, GRID_SPACING } from '../src/core/constants';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer: boolean, pace: number): Rider {
  return {
    id, name: id, team: 'T', isPlayer, brandId: 'titan',
    age: 25, skills: { pace, cornering: 5, consistency: 5 },
    bike: { speed: pace, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
   };
}
const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.5, cornering: 0.3, acceleration: 0.2 } };
function mkSeason(): SeasonState {
  return {
    playerRider: mkRider('player', true, 6),
    aiRiders: Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`, false, 5)),
    calendar: [track], currentRaceIndex: 0, raceResults: [], isSeasonComplete: false,
  };
}

describe('RaceEngine', () => {
  it('produces a valid result and a full timeline', () => {
    const { result, timeline } = runRace(mkSeason(), 'topSpeed', 'medium', new RNG(1));
    expect(result.finishingOrder.map((f) => f.position).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.finishingOrder.reduce((s, f) => s + f.pointsAwarded, 0)).toBe(101);
    expect(timeline.laps).toHaveLength(RACE_LAPS);
    expect(timeline.laps[0].entries).toHaveLength(10);
  });

  it('is deterministic for a fixed seed', () => {
    const a = runRace(mkSeason(), 'topSpeed', 'medium', new RNG(42));
    const b = runRace(mkSeason(), 'topSpeed', 'medium', new RNG(42));
    expect(a.result.finishingOrder.map((f) => f.rider.id))
      .toEqual(b.result.finishingOrder.map((f) => f.rider.id));
    expect(a.timeline.laps[a.timeline.laps.length - 1].entries).toEqual(b.timeline.laps[b.timeline.laps.length - 1].entries);
  });

  it('crashed riders finish behind all non-crashed riders', () => {
    const season = mkSeason();
    season.playerRider.skills.consistency = 1;
    const technical: Track = { id: 'x', name: 'X', location: 'Y', weights: { speed: 0.1, cornering: 0.8, acceleration: 0.1 } };
    season.calendar = [technical];
    for (let seed = 0; seed < 40; seed++) {
      const { result } = runRace(season, 'handling', 'high', new RNG(seed));
      const order = result.finishingOrder;
      const firstCrashIdx = order.findIndex((e) => e.crashed);
      if (firstCrashIdx === -1) continue;
      expect(order.slice(firstCrashIdx).every((e) => e.crashed)).toBe(true);
    }
  });

  it('simulateRace returns just the result', () => {
    const r = simulateRace(mkSeason(), 'handling', 'low', new RNG(3));
    expect(r.finishingOrder).toHaveLength(10);
  });

  it('runRace equals manual create+step+finalize with the same seed and constant order', () => {
    const viaRun = runRace(mkSeason(), 'topSpeed', 'high', new RNG(5));
    const rng = new RNG(5);
    const run = createRace(mkSeason(), 'topSpeed', rng);
    for (let i = 0; i < RACE_LAPS; i++) stepLap(run, 'high');
    const manual = finalizeRace(run, rng);
    expect(manual.finishingOrder.map((f) => f.rider.id)).toEqual(viaRun.result.finishingOrder.map((f) => f.rider.id));
  });
});

describe('momentum noise (AR1)', () => {
  it('is positively autocorrelated lap-to-lap', () => {
    const rng = new RNG(7);
    let last = 0;
    const series: number[] = [];
    for (let i = 0; i < 5000; i++) { last = momentumNoise(last, rng.gaussian(0, 1.5)); series.push(last); }
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    let num = 0, den = 0;
    for (let i = 1; i < series.length; i++) num += (series[i] - mean) * (series[i - 1] - mean);
    for (let i = 0; i < series.length; i++) den += (series[i] - mean) ** 2;
    expect(num / den).toBeGreaterThan(0.4); // ~0.6 in expectation
  });

  it('preserves marginal variance in steady state (~input sigma)', () => {
    const rng = new RNG(11);
    let last = 0;
    const xs: number[] = [];
    for (let i = 0; i < 20000; i++) { last = momentumNoise(last, rng.gaussian(0, 1.5)); if (i > 50) xs.push(last); }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    expect(Math.sqrt(variance)).toBeGreaterThan(1.2);
    expect(Math.sqrt(variance)).toBeLessThan(1.8);
  });
});

describe('drafting tow (hasDraftTow)', () => {
  it('tows a trailing rider within range but not an isolated leader or a far-back rider', () => {
    const progress = [10, 9.5, 3];            // r0 leader, r1 0.5 behind, r2 7 behind
    const crashed = [false, false, false];
    expect(hasDraftTow(progress, crashed, 0)).toBe(false); // clear air ahead
    expect(hasDraftTow(progress, crashed, 1)).toBe(true);   // within DRAFT_RANGE of r0
    expect(hasDraftTow(progress, crashed, 2)).toBe(false); // out of range
   });
  it('gives no tow at exactly equal progress (strict ahead)', () => {
    expect(hasDraftTow([5, 5], [false, false], 0)).toBe(false);
    expect(hasDraftTow([5, 5], [false, false], 1)).toBe(false);
   });
  it('ignores crashed riders as tow providers and skips crashed receivers', () => {
    expect(hasDraftTow([10, 9.5], [false, true], 1)).toBe(false); // only rider ahead is crashed
    expect(hasDraftTow([9.5, 10], [true, false], 0)).toBe(false); // receiver crashed
   });
});

describe('P3.2 — grid offset', () => {
  it('front-row rider starts with more progress than back-row', () => {
    const season = mkSeason();
    const grid = ['ai0', 'ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7', 'ai8', 'player'];
    const rng = new RNG(42);
    const run = createRace(season, 'topSpeed', rng, grid);
    const playerProg = run.states.find((s) => s.rider.id === 'player')!.progress;
    const ai0Prog = run.states.find((s) => s.rider.id === 'ai0')!.progress;
    expect(ai0Prog).toBeGreaterThan(playerProg);
    expect(ai0Prog).toBe(10 * GRID_SPACING);
    expect(playerProg).toBe(1 * GRID_SPACING);
    });

  it('grid is backward compatible — no grid = no offset', () => {
    const season = mkSeason();
    const rng = new RNG(42);
    const run = createRace(season, 'topSpeed', rng);
    expect(run.states.every((s) => s.progress === 0)).toBe(true);
   });

  it('grid position maps to correct offset', () => {
    const season = mkSeason();
    const field = [season.playerRider, ...season.aiRiders];
    const grid = field.map((r) => r.id).reverse();
    const rng = new RNG(42);
    const run = createRace(season, 'topSpeed', rng, grid);
    for (let i = 0; i < field.length; i++) {
      const rider = field[i];
      const state = run.states.find((s) => s.rider.id === rider.id)!;
      const gridPos = grid.indexOf(rider.id);
      const expected = (field.length - gridPos) * GRID_SPACING;
      expect(state.progress).toBe(expected);
      }
    });
});
