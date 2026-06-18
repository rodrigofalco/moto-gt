import { getStandings, getChampion } from './Championship';
import { nextTier } from '../data/tiers';
import type { CareerState, OffSeasonReport, Rider } from './types';
import type { RNG } from './RNG';

const PEAK_AGE = 30;

function pickRandomNonZeroSkill(rider: Rider, rng: RNG): string | null {
  const keys = (Object.keys(rider.skills) as string[]).filter((k) => rider.skills[k as keyof typeof rider.skills] > 0);
  if (keys.length === 0) return null;
  return keys[rng.nextInt(0, keys.length - 1)];
}

export function runOffSeason(career: CareerState, rng: RNG): OffSeasonReport {
  const standings = career.season ? getStandings(career.season) : [];
  const champion = career.season ? getChampion(career.season).name : 'N/A';
  const playerFinish = standings.findIndex((r) => r.isPlayer) + 1;
  let promoted = false;
  if (playerFinish <= 3 && career.tierId !== 'factory') {
    career.tierId = nextTier(career.tierId);
    promoted = true;
      }
  const statChanges: OffSeasonReport['statChanges'] = [];

  // Age all riders
  const allRiders = [career.player, ...career.field];
  for (const rider of allRiders) {
    rider.age += 1;
    if (rider.age > PEAK_AGE) {
      // Probability rises with age: 5% at 31, 15% at 35, 30% at 40+
      const ageOver = rider.age - PEAK_AGE;
      const declineChance = 0.05 + ageOver * 0.05;
      if (rng.nextFloat() < declineChance) {
        const skillKey = pickRandomNonZeroSkill(rider, rng);
        if (skillKey) {
        (rider.skills as unknown as Record<string, number>)[skillKey] -= 1;
          statChanges.push({ riderId: rider.id, note: `${rider.name} declined ${skillKey} (${rider.age})` });
        }
      }
    }
  }

  career.seasonNumber += 1;
  career.season = null;
  return {
    previousSeason: career.seasonNumber - 1,
    playerFinish,
    champion,
    promoted,
    retired: [],
    rookies: [],
    statChanges,
      };
}
