import { describe, it, expect } from 'vitest';
import { applyRaceResult, getStandings, getChampion } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceSimulator';
import { RNG } from '../src/core/RNG';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer = false): Rider {
  return {
    id, name: id, team: 'T', isPlayer, brandId: 'titan',
    age: 25, skills: { pace: 5, cornering: 5, consistency: 5 },
    bike: { speed: 5, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
   };
}
const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.5, cornering: 0.3, acceleration: 0.2 } };
function mkSeason(): SeasonState {
  return {
    playerRider: mkRider('player', true),
    aiRiders: Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`)),
    calendar: [track, track], currentRaceIndex: 0, raceResults: [], isSeasonComplete: false,
  };
}

describe('Championship', () => {
  it('applyRaceResult accumulates 101 points and advances the index', () => {
    const s = mkSeason();
    applyRaceResult(s, simulateRace(s, 'topSpeed', 'medium', new RNG(1)));
    expect(s.currentRaceIndex).toBe(1);
    expect([s.playerRider, ...s.aiRiders].reduce((a, r) => a + r.points, 0)).toBe(101);
  });

  it('standings break ties by countback (more wins first)', () => {
    const s = mkSeason();
    s.playerRider.points = 25; s.playerRider.positionCounts[0] = 1;
    s.aiRiders[0].points = 25; s.aiRiders[0].positionCounts[1] = 1;
    expect(getStandings(s)[0].id).toBe('player');
  });

  it('getChampion returns the points leader', () => {
    const s = mkSeason();
    s.aiRiders[2].points = 50;
    expect(getChampion(s).id).toBe('ai2');
  });
});
