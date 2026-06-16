import type { Rider, PilotArchetype, Brand } from '../types';
import { AI_RIDER_COUNT } from '../constants';
import { PILOT_ROSTER } from '../../data/pilots';
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
    const brand = brands[rng.nextInt(0, brands.length - 1)];
    riders.push({
      id: `ai${i}`,
      name: i < pilots.length ? pilot.name : `${pilot.name} ${Math.floor(i / pilots.length) + 1}`,
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
