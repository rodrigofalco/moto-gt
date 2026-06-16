import type { Rider, PilotArchetype, Brand } from '../types';
import { AI_RIDER_COUNT } from '../constants';
import { PILOT_ROSTER, AI_EXTRA_NAMES } from '../../data/pilots';
import { BRAND_ROSTER } from '../../data/brands';
import type { RNG } from '../RNG';

function emptyCounts(): number[] { return new Array(10).fill(0); }

export function createPlayerRider(team: string, pilot: PilotArchetype, brand: Brand): Rider {
  return {
    id: 'player', name: pilot.name, team, isPlayer: true, brandId: brand.id,
    skills: { ...pilot.skills }, bike: { ...brand.params },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
  };
}

export function generateAIRiders(playerPilotId: string, _playerBrandId: string, rng: RNG): Rider[] {
  const pilots = PILOT_ROSTER.filter((p) => p.id !== playerPilotId);
  const brands = BRAND_ROSTER.slice();
  const riders: Rider[] = [];
  for (let i = 0; i < AI_RIDER_COUNT; i++) {
    const pilot = pilots[i % pilots.length];
    // First 5 AI = the non-player archetypes (real names); the rest borrow archetype
    // skills but get unique names so no two riders share a name.
    const name = i < pilots.length ? pilot.name : AI_EXTRA_NAMES[(i - pilots.length) % AI_EXTRA_NAMES.length];
    const brand = brands[rng.nextInt(0, brands.length - 1)];
    riders.push({
      id: `ai${i}`,
      name,
      team: brand.name,
      isPlayer: false,
      brandId: brand.id,
      skills: { ...pilot.skills },
      bike: { ...brand.params },
      pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
    });
  }
  return riders;
}
