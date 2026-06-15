import { describe, it, expect } from 'vitest';
import { simulateRace } from '../src/core/RaceSimulator';
import { RNG } from '../src/core/RNG';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer: boolean, pace: number): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    skills: { pace, cornering: 5, consistency: 5 },
    bike: { speed: 5, handling: 5, acceleration: 5 },
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

describe('simulateRace', () => {
  it('produces 10 unique positions and 101 points total', () => {
    const r = simulateRace(mkSeason(), 'topSpeed', 'medium', new RNG(1));
    expect(r.finishingOrder.map((f) => f.position).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.finishingOrder.reduce((s, f) => s + f.pointsAwarded, 0)).toBe(101);
  });

  it('records the player setup/risk and includes the player', () => {
    const r = simulateRace(mkSeason(), 'handling', 'high', new RNG(2));
    const p = r.finishingOrder.find((f) => f.rider.isPlayer)!;
    expect(p.setup).toBe('handling');
    expect(p.risk).toBe('high');
  });

  it('is deterministic for a fixed seed', () => {
    const a = simulateRace(mkSeason(), 'topSpeed', 'medium', new RNG(99));
    const b = simulateRace(mkSeason(), 'topSpeed', 'medium', new RNG(99));
    expect(a.finishingOrder.map((f) => f.rider.id)).toEqual(b.finishingOrder.map((f) => f.rider.id));
  });
});
