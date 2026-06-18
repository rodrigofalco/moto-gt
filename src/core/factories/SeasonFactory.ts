import type { SeasonState, PilotArchetype, Brand, Track, Rider, Weather } from '../types';
import { SEASON_RACE_COUNT } from '../constants';
import { TRACK_BANK } from '../../data/tracks';
import { createPlayerRider, generateAIRiders } from './RiderFactory';
import { resetProgression } from '../Progression';
import type { RNG } from '../RNG';
import type { CareerState } from '../types';

const WET_WEATHER_CHANCE = 0.25;

function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
     [a[i], a[j]] = [a[j], a[i]];
    }
  return a;
}

function resetRider(rider: Rider): void {
  rider.points = 0;
  rider.positionCounts = new Array(10).fill(0);
}

function generateWeather(rng: RNG, count: number): Weather[] {
  const weather: Weather[] = [];
  for (let i = 0; i < count; i++) {
    weather.push(rng.nextFloat() < WET_WEATHER_CHANCE ? 'wet' : 'dry');
   }
  return weather;
}

export function createSeason(team: string, pilot: PilotArchetype, brand: Brand, rng: RNG): SeasonState {
  resetProgression();
  const playerRider = createPlayerRider(team, pilot, brand);
  const aiRiders = generateAIRiders(pilot.id, brand.id, rng);
  const calendar: Track[] = shuffle(TRACK_BANK, rng).slice(0, SEASON_RACE_COUNT);
  return { playerRider, aiRiders, calendar, currentRaceIndex: 0, raceResults: [], isSeasonComplete: false, lastRisk: 'medium', weatherByRace: generateWeather(rng, SEASON_RACE_COUNT) };
}

export function createSeasonForCareer(career: CareerState, rng: RNG): SeasonState {
  resetProgression();
   // Reset per-season fields on persistent riders
  resetRider(career.player);
  for (const r of career.field) resetRider(r);
  const aiRiders = generateAIRiders(career.pilotArchetypeId, career.brandId, rng);
  const calendar: Track[] = shuffle(TRACK_BANK, rng).slice(0, SEASON_RACE_COUNT);
  return {
    playerRider: career.player,
    aiRiders,
    calendar,
    currentRaceIndex: 0,
    raceResults: [],
    isSeasonComplete: false,
    lastRisk: 'medium',
    weatherByRace: generateWeather(rng, SEASON_RACE_COUNT),
     };
}
