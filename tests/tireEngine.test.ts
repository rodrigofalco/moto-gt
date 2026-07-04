import { describe, it, expect } from 'vitest';
import { createRace, stepLap } from '../src/core/RaceEngine';
import { calcTireWear, getTireGrip, getTireCrashRisk } from '../src/core/TireModel';
import { aiCompound } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import { RACE_LAPS, TIRE_COMPOUNDS_LIST } from '../src/core/constants';
import type { Rider, Track, SeasonState, TireCompound } from '../src/core/types';

function mkRider(id: string, isPlayer: boolean, pace: number, consistency = 5): Rider {
  return {
    id, name: id, team: 'T', isPlayer, brandId: 'titan',
    age: 25, skills: { pace, cornering: 5, consistency },
    bike: { speed: pace, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
  };
}
const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.5, cornering: 0.3, acceleration: 0.2 } };
function mkSeason(compound?: TireCompound): SeasonState {
  return {
    playerRider: mkRider('player', true, 6),
    aiRiders: Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`, false, 5)),
    calendar: [track], currentRaceIndex: 0, raceResults: [], isSeasonComplete: false,
    lastCompound: compound,
  };
}

describe('tire integration in RaceEngine', () => {
  it('rider states carry the compound: player from season.lastCompound, AI from aiCompound', () => {
    const run = createRace(mkSeason('soft'), 'topSpeed', new RNG(1));
    const player = run.states.find((s) => s.rider.isPlayer)!;
    expect(player.compound).toBe('soft');
    for (const s of run.states) expect(TIRE_COMPOUNDS_LIST).toContain(s.compound);
  });

  it('defaults the player to medium when no compound was chosen', () => {
    const run = createRace(mkSeason(), 'topSpeed', new RNG(1));
    expect(run.states.find((s) => s.rider.isPlayer)!.compound).toBe('medium');
  });

  it('accumulates wear on the rider state as laps pass', () => {
    const run = createRace(mkSeason('soft'), 'topSpeed', new RNG(2));
    const player = run.states.find((s) => s.rider.isPlayer)!;
    expect(player.tireWear).toBe(0);
    stepLap(run, 'medium');
    const wearL1 = player.tireWear;
    expect(wearL1).toBeGreaterThan(0);
    expect(wearL1).toBeCloseTo(calcTireWear(1, 'soft', player.rider.skills.consistency), 6);
    for (let i = 1; i < RACE_LAPS; i++) stepLap(run, 'medium');
    expect(player.tireWear).toBeCloseTo(calcTireWear(RACE_LAPS, 'soft', player.rider.skills.consistency), 6);
    expect(player.tireWear).toBeGreaterThan(wearL1);
  });

  it('fresh softs are faster than hards on lap 1, but slower once worn late in the race', () => {
    // Same seed, identical fields — only the player compound differs, so every RNG draw
    // (AI setup/risk/compound, per-lap noise, crash rolls) is identical across both runs.
    const gains = (compound: TireCompound): number[] => {
      const run = createRace(mkSeason(compound), 'topSpeed', new RNG(7));
      const player = run.states.find((s) => s.rider.isPlayer)!;
      const perLap: number[] = [];
      let last = player.progress;
      for (let i = 0; i < RACE_LAPS; i++) {
        stepLap(run, 'low'); // low risk on a fast track: crashes are vanishingly rare with this seed
        perLap.push(player.progress - last);
        last = player.progress;
      }
      return perLap;
    };
    const soft = gains('soft');
    const hard = gains('hard');
    expect(soft[0]).toBeGreaterThan(hard[0]);                    // fresh soft is quicker
    expect(soft[RACE_LAPS - 1]).toBeLessThan(hard[RACE_LAPS - 1]); // dead soft is slower
  });

  it('worn tires raise crash risk: soft crashes more often than hard under sustained pushing', () => {
    let softCrashes = 0, hardCrashes = 0;
    for (let seed = 0; seed < 400; seed++) {
      for (const compound of ['soft', 'hard'] as TireCompound[]) {
        const run = createRace(mkSeason(compound), 'topSpeed', new RNG(seed));
        for (let i = 0; i < RACE_LAPS; i++) stepLap(run, 'high');
        const crashed = run.states.find((s) => s.rider.isPlayer)!.crashed;
        if (crashed) { if (compound === 'soft') softCrashes++; else hardCrashes++; }
      }
    }
    expect(softCrashes).toBeGreaterThan(hardCrashes);
  });
});

describe('tire model retune (8-lap race scale)', () => {
  it('soft is nearly dead by the flag; hard barely worn', () => {
    expect(calcTireWear(RACE_LAPS, 'soft', 5)).toBeGreaterThan(85);
    expect(calcTireWear(RACE_LAPS, 'hard', 5)).toBeLessThan(45);
  });

  it('consistent riders wear tires slower', () => {
    expect(calcTireWear(4, 'medium', 9)).toBeLessThan(calcTireWear(4, 'medium', 2));
  });

  it('wear never exceeds 100', () => {
    expect(calcTireWear(50, 'soft', 1)).toBe(100);
  });

  it('grip: fresh soft > fresh hard, worn-out soft < fresh hard', () => {
    expect(getTireGrip(0, 'soft')).toBeGreaterThan(getTireGrip(0, 'hard'));
    expect(getTireGrip(95, 'soft')).toBeLessThan(getTireGrip(0, 'hard'));
  });

  it('crash risk multiplier kicks in above 50% wear and grows past 70%', () => {
    expect(getTireCrashRisk(30)).toBe(1.0);
    expect(getTireCrashRisk(60)).toBeGreaterThan(1.0);
    expect(getTireCrashRisk(90)).toBeGreaterThan(getTireCrashRisk(60));
  });
});

describe('aiCompound', () => {
  it('is deterministic for a fixed seed and returns a valid compound', () => {
    const a = aiCompound(mkRider('x', false, 5), new RNG(3));
    const b = aiCompound(mkRider('x', false, 5), new RNG(3));
    expect(a).toBe(b);
    expect(TIRE_COMPOUNDS_LIST).toContain(a);
  });

  it('produces compound variety across the field', () => {
    const rng = new RNG(9);
    const picks = new Set<TireCompound>();
    for (let i = 0; i < 50; i++) picks.add(aiCompound(mkRider(`r${i}`, false, 5, 1 + (i % 10)), rng));
    expect(picks.size).toBeGreaterThanOrEqual(2);
  });
});
