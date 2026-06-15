import type { SeasonState, PilotArchetype, Brand, Track } from '../types';
import { SEASON_RACE_COUNT } from '../constants';
import { TRACK_BANK } from '../../data/tracks';
import { createPlayerRider, generateAIRiders } from './RiderFactory';
import { resetProgression } from '../Progression';
import type { RNG } from '../RNG';

function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createSeason(team: string, pilot: PilotArchetype, brand: Brand, rng: RNG): SeasonState {
  resetProgression();
  const playerRider = createPlayerRider(team, pilot, brand);
  const aiRiders = generateAIRiders(pilot.id, brand.id, rng);
  const calendar: Track[] = shuffle(TRACK_BANK, rng).slice(0, SEASON_RACE_COUNT);
  return { playerRider, aiRiders, calendar, currentRaceIndex: 0, raceResults: [], isSeasonComplete: false };
}
