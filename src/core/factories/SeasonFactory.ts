import type { SeasonState, RiderStats, Track } from '../types';
import { SEASON_RACE_COUNT } from '../constants';
import { TRACK_BANK } from '../../data/tracks';
import { createPlayerRider, generateAIRiders } from './RiderFactory';
import type { RNG } from '../RNG';

function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCalendar(rng: RNG): Track[] {
  // Guarantee one <0.3 and one >0.7, then fill the rest, then shuffle.
  for (let attempt = 0; attempt < 100; attempt++) {
    const picked = shuffle(TRACK_BANK, rng).slice(0, SEASON_RACE_COUNT);
    const hasLow = picked.some((t) => t.technicality < 0.3);
    const hasHigh = picked.some((t) => t.technicality > 0.7);
    if (hasLow && hasHigh) return picked;
  }
  // Deterministic fallback: force-include one low and one high.
  const low = TRACK_BANK.find((t) => t.technicality < 0.3)!;
  const high = TRACK_BANK.find((t) => t.technicality > 0.7)!;
  const rest = shuffle(TRACK_BANK.filter((t) => t.id !== low.id && t.id !== high.id), rng)
    .slice(0, SEASON_RACE_COUNT - 2);
  return shuffle([low, high, ...rest], rng);
}

export function createSeason(
  playerName: string, teamName: string, playerStats: RiderStats, rng: RNG,
): SeasonState {
  const playerRider = createPlayerRider(playerName, teamName, playerStats);
  const aiRiders = generateAIRiders(rng, [playerName]);
  const calendar = buildCalendar(rng);
  return { playerRider, aiRiders, calendar, currentRaceIndex: 0, raceResults: [], isSeasonComplete: false };
}
