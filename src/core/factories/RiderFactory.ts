import type { Rider, PilotArchetype, Brand } from '../types';
import { AI_RIDER_COUNT } from '../constants';
import { PILOT_ROSTER, AI_EXTRA_NAMES } from '../../data/pilots';
import { RIDER_NAMES } from '../../data/names';
import { BRAND_ROSTER } from '../../data/brands';
import type { RNG } from '../RNG';

function emptyCounts(): number[] { return new Array(10).fill(0); }

export function createPlayerRider(team: string, pilot: PilotArchetype, brand: Brand): Rider {
  return {
    id: 'player', name: pilot.name, team, isPlayer: true, brandId: brand.id,
    age: 22, skills: { ...pilot.skills }, bike: { ...brand.params },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
    };
}

export function createRookie(tierBonus: number, rng: RNG): Rider {
  const name = RIDER_NAMES[rng.nextInt(0, RIDER_NAMES.length - 1)];
  const brand = BRAND_ROSTER[rng.nextInt(0, BRAND_ROSTER.length - 1)];
  const age = rng.nextInt(18, 24);
  const skills: Record<string, number> = {
    pace: clamp(rng.nextInt(2, 7) + tierBonus, 1, 10),
    cornering: clamp(rng.nextInt(2, 7) + tierBonus, 1, 10),
    consistency: clamp(rng.nextInt(2, 7) + tierBonus, 1, 10),
  };
  return {
    id: `rookie${rng.nextInt(1000, 9999)}`,
    name,
    team: brand.name,
    isPlayer: false,
    brandId: brand.id,
    age,
    skills: skills as unknown as Rider['skills'],
    bike: { ...brand.params },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
    };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateAIRiders(playerPilotId: string, _playerBrandId: string, rng: RNG): Rider[] {
  // Shuffle the non-player archetypes so a different 9 of 17 appear each season
  // (seeded by rng → deterministic per seed, but varied across seasons). Without
  // this, the same 9 archetypes in roster order appeared every season.
  const pilots = shuffle(PILOT_ROSTER.filter((p) => p.id !== playerPilotId), rng);
  const brands = BRAND_ROSTER.slice();
  const riders: Rider[] = [];
  for (let i = 0; i < AI_RIDER_COUNT; i++) {
    const pilot = pilots[i % pilots.length];
      // First 5 AI = the non-player archetypes (real names); the rest borrow archetype
      // skills but get unique names so no two riders share a name.
    const name = i < pilots.length ? pilot.name : AI_EXTRA_NAMES[(i - pilots.length) % AI_EXTRA_NAMES.length];
    const brand = brands[rng.nextInt(0, brands.length - 1)];
    const age = rng.nextInt(20, 32);
    riders.push({
      id: `ai${i}`,
      name,
      team: brand.name,
      isPlayer: false,
      brandId: brand.id,
      age,
      skills: { ...pilot.skills },
      bike: { ...brand.params },
      pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
      });
    }
  return riders;
}
