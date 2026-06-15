import { describe, it, expect } from 'vitest';
import { applyRaceResult, getStandings } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceSimulator';
import { RNG } from '../src/core/RNG';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer = false): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    stats: { pace: 5, cornering: 5, consistency: 5 },
    points: 0, positionCounts: new Array(10).fill(0),
  };
}
const track: Track = { id: 't', name: 'T', location: 'X', technicality: 0.5 };

function mkSeason(): SeasonState {
  return {
    playerRider: mkRider('player', true),
    aiRiders: Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`)),
    calendar: [track, track],
    currentRaceIndex: 0, raceResults: [], isSeasonComplete: false,
  };
}

describe('Championship', () => {
  it('applyRaceResult accumulates points and advances the index', () => {
    const season = mkSeason();
    const result = simulateRace(season, 'balanced', new RNG(1));
    applyRaceResult(season, result);
    expect(season.currentRaceIndex).toBe(1);
    expect(season.raceResults).toHaveLength(1);
    const total = [season.playerRider, ...season.aiRiders].reduce((s, r) => s + r.points, 0);
    expect(total).toBe(101);
  });

  it('updates positionCounts', () => {
    const season = mkSeason();
    const result = simulateRace(season, 'balanced', new RNG(1));
    applyRaceResult(season, result);
    const winner = result.finishingOrder[0].rider;
    expect(winner.positionCounts[0]).toBe(1);
  });

  it('standings sort by points then countback', () => {
    const season = mkSeason();
    // Hand-craft a points/countback tie: two riders 25 pts, one with the win.
    season.playerRider.points = 25;
    season.playerRider.positionCounts[0] = 1; // a win
    season.aiRiders[0].points = 25;
    season.aiRiders[0].positionCounts[1] = 1; // a second + (no win)
    season.aiRiders[0].positionCounts[2] = 1;
    const standings = getStandings(season);
    const top = standings.slice(0, 2).map((r) => r.id);
    expect(top[0]).toBe('player'); // win beats no-win on countback
  });
});
