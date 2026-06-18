import { createPlayerRider, generateAIRiders } from './factories/RiderFactory';
import { loadJSON, saveJSON, clearKey } from './persist';
import type { CareerState } from './types';
import type { RNG } from './RNG';
import { PILOT_ROSTER } from '../data/pilots';
import { BRAND_ROSTER } from '../data/brands';

export const CAREER_KEY = 'moto-gt-career';
export const CAREER_VERSION = 1;

export const STARTING_MONEY = 2000;
export const STARTING_REPUTATION = 0;
export const STARTING_TIER_ID = 'rookie';

export function newCareer(team: string, pilotId: string, brandId: string, rng: RNG): CareerState {
  const pilot = PILOT_ROSTER.find((p) => p.id === pilotId);
  const brand = BRAND_ROSTER.find((b) => b.id === brandId);
  if (!pilot || !brand) throw new Error(`Unknown pilot ${pilotId} or brand ${brandId}`);
  const player = createPlayerRider(team, pilot, brand);
  const field = generateAIRiders(pilotId, brandId, rng);
  return {
    version: CAREER_VERSION,
    team,
    pilotArchetypeId: pilotId,
    brandId,
    tierId: STARTING_TIER_ID,
    seasonNumber: 1,
    money: STARTING_MONEY,
    reputation: STARTING_REPUTATION,
    player,
    field,
    season: null,
   };
}

export function saveCareer(c: CareerState): void {
  saveJSON(CAREER_KEY, c);
}

export function loadCareer(): CareerState | null {
  return loadJSON<CareerState>(CAREER_KEY, null as unknown as CareerState);
}

export function hasCareer(): boolean {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CAREER_KEY) : null;
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw) as { version?: number };
    return obj.version === CAREER_VERSION;
   } catch {
    return false;
   }
}

export function clearCareer(): void {
  clearKey(CAREER_KEY);
}
