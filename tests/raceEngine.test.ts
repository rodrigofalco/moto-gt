import { describe, it, expect } from 'vitest';
import { runRace, simulateRace } from '../src/core/RaceEngine';
import { RNG } from '../src/core/RNG';
import { RACE_LAPS } from '../src/core/constants';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer: boolean, pace: number): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    skills: { pace, cornering: 5, consistency: 5 },
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
    expect(a.timeline.laps.at(-1)!.entries).toEqual(b.timeline.laps.at(-1)!.entries);
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
});
