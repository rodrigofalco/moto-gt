import type { Rider, PilotArchetype, Brand, CareerStats } from '../types';
import { AI_RIDER_COUNT, STAT_MAX } from '../constants';
import { PILOT_ROSTER, AI_EXTRA_NAMES } from '../../data/pilots';
import { BRAND_ROSTER } from '../../data/brands';
import type { RNG } from '../RNG';

function emptyCounts(): number[] { return new Array(10).fill(0); }

function emptyCareerStats(): CareerStats {
  return { seasonsPlayed: 0, totalWins: 0, totalPodiums: 0, totalPoints: 0, bestChampionship: 99, lapsCompleted: 0 };
}

export function createPlayerRider(team: string, pilot: PilotArchetype, brand: Brand, careerStats?: CareerStats): Rider {
  const rider: Rider = {
    id: 'player', name: pilot.name, team, isPlayer: true, brandId: brand.id,
    skills: { ...pilot.skills }, bike: { ...brand.params },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
    careerStats: careerStats ? { ...careerStats } : emptyCareerStats(),
  };

  if (careerStats && careerStats.seasonsPlayed > 0) {
    applyExperienceBonuses(rider, careerStats);
  }

  return rider;
}

function applyExperienceBonuses(rider: Rider, careerStats: CareerStats): void {
  const bonusPerSeason = 0.3;
  const totalBonus = Math.min(careerStats.seasonsPlayed * bonusPerSeason, 3.0);
  const perSkill = totalBonus / 3;

  rider.skills.pace = Math.min(STAT_MAX, Math.round((rider.skills.pace + perSkill) * 10) / 10);
  rider.skills.cornering = Math.min(STAT_MAX, Math.round((rider.skills.cornering + perSkill) * 10) / 10);
  rider.skills.consistency = Math.min(STAT_MAX, Math.round((rider.skills.consistency + perSkill) * 10) / 10);
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
       careerStats: emptyCareerStats(),
      });
  }
  return riders;
}
