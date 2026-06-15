import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace } from '../src/core/RaceSimulator';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { RNG } from '../src/core/RNG';
import { TARGET_CHAMPION_RATE } from '../src/core/constants';
import type { RidingStyle, SeasonState, Track } from '../src/core/types';

// "Reasonable play": pick a style suited to the track. Technical track → safe-ish
// to protect cornering advantage; fast track → aggressive to maximize pace.
function reasonableStyle(track: Track): RidingStyle {
  if (track.technicality > 0.6) return 'balanced';
  return 'aggressive';
}

function playSeason(seed: number): boolean {
  const rng = new RNG(seed);
  // Representative balanced point-buy build: 6/6/6.
  const season: SeasonState = createSeason('Me', 'T', { pace: 6, cornering: 6, consistency: 6 }, rng);
  while (!season.isSeasonComplete) {
    const track = season.calendar[season.currentRaceIndex];
    const result = simulateRace(season, reasonableStyle(track), rng);
    applyRaceResult(season, result);
  }
  return getChampion(season).id === 'player';
}

describe('balance harness', () => {
  it('player wins championship within target rate over 1000 seasons', () => {
    const N = 1000;
    let wins = 0;
    for (let i = 0; i < N; i++) if (playSeason(i)) wins++;
    const rate = wins / N;
    // Log so the engineer can see the rate while tuning constants.
    console.log(`Champion rate: ${(rate * 100).toFixed(1)}% (target ${TARGET_CHAMPION_RATE[0] * 100}-${TARGET_CHAMPION_RATE[1] * 100}%)`);
    expect(rate).toBeGreaterThanOrEqual(TARGET_CHAMPION_RATE[0]);
    expect(rate).toBeLessThanOrEqual(TARGET_CHAMPION_RATE[1]);
  });
});
