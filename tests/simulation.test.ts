import { describe, it, expect } from 'vitest';
import { simulateRace } from '../src/core/RaceSimulator';
import { RNG } from '../src/core/RNG';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer: boolean, pace: number): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    stats: { pace, cornering: 5, consistency: 5 },
    points: 0, positionCounts: new Array(10).fill(0),
  };
}

const track: Track = { id: 't', name: 'Test', location: 'X', technicality: 0.5 };

function mkSeason(): SeasonState {
  const player = mkRider('player', true, 6);
  const ai = Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`, false, 5));
  return {
    playerRider: player, aiRiders: ai, calendar: [track],
    currentRaceIndex: 0, raceResults: [], isSeasonComplete: false,
  };
}

describe('simulateRace', () => {
  it('produces 10 unique positions 1..10', () => {
    const result = simulateRace(mkSeason(), 'balanced', new RNG(1));
    const positions = result.finishingOrder.map((f) => f.position).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('awards points summing to 101', () => {
    const result = simulateRace(mkSeason(), 'balanced', new RNG(2));
    const total = result.finishingOrder.reduce((s, f) => s + f.pointsAwarded, 0);
    expect(total).toBe(101);
  });

  it('includes the player', () => {
    const result = simulateRace(mkSeason(), 'aggressive', new RNG(3));
    expect(result.finishingOrder.some((f) => f.rider.isPlayer)).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    const a = simulateRace(mkSeason(), 'balanced', new RNG(777));
    const b = simulateRace(mkSeason(), 'balanced', new RNG(777));
    expect(a.finishingOrder.map((f) => f.rider.id)).toEqual(b.finishingOrder.map((f) => f.rider.id));
  });

  it('records the player style and track', () => {
    const result = simulateRace(mkSeason(), 'safe', new RNG(4));
    expect(result.playerStyle).toBe('safe');
    expect(result.track.id).toBe('t');
  });
});
