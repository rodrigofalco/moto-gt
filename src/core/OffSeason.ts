import { getStandings, getChampion } from './Championship';
import { getTier, nextTier } from '../data/tiers';
import { createRookie } from '../core/factories/RiderFactory';
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
  const statChanges: OffSeasonReport['statChanges'] = [];
  if (playerFinish <= 3 && career.tierId !== 'factory') {
    career.tierId = nextTier(career.tierId);
    promoted = true;
    // Stepping up a class: the whole AI field is one notch stronger (each tier's
    // aiStatBonus is +1 over the previous). Bump each rider's weakest skill.
    for (const rider of career.field) {
      const keys = (Object.keys(rider.skills) as (keyof Rider['skills'])[]).filter((k) => rider.skills[k] < 10);
      if (keys.length > 0) {
        const weakest = keys.sort((a, b) => rider.skills[a] - rider.skills[b])[0];
        rider.skills[weakest] += 1;
      }
    }
    statChanges.push({ riderId: 'field', note: `The rivals raise their game for the ${getTier(career.tierId).name} class (+1 skill each)` });
      }

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

    // Off-season churn: retire 1-2 oldest/weakest AI, replace with rookies
  const retireCount = rng.nextFloat() < 0.5 ? 1 : 2;
    // Score = inverse of combined skill (weakest first), break ties by age (oldest first)
  const sorted = [...career.field].sort((a, b) => {
    const scoreA = a.skills.pace + a.skills.cornering + a.skills.consistency - a.age * 0.1;
    const scoreB = b.skills.pace + b.skills.cornering + b.skills.consistency - b.age * 0.1;
    return scoreA - scoreB;
    });
  const retired: Rider[] = sorted.slice(0, retireCount);
  const survivors = sorted.slice(retireCount);
  const retiredNames = retired.map((r) => r.name);

    // Generate rookies to fill the spots
  const rookies: Rider[] = [];
  const tierBonus = getTier(career.tierId).aiStatBonus;
  for (let i = 0; i < retireCount; i++) {
    rookies.push(createRookie(tierBonus, rng));
   }
  const rookieNames = rookies.map((r) => r.name);

    // Surviving AI get a small chance to improve one random non-max skill
  for (const rider of survivors) {
    if (rng.nextFloat() < 0.3) {
      const keys = (Object.keys(rider.skills) as string[]).filter((k) => rider.skills[k as keyof typeof rider.skills] < 10);
      if (keys.length > 0) {
        const key = keys[rng.nextInt(0, keys.length - 1)];
           (rider.skills as unknown as Record<string, number>)[key] += 1;
        statChanges.push({ riderId: rider.id, note: `${rider.name} improved ${key}` });
        }
      }
    }

  career.field = [...survivors, ...rookies];

  return {
    previousSeason: career.seasonNumber - 1,
    playerFinish,
    champion,
    promoted,
    retired: retiredNames,
    rookies: rookieNames,
    statChanges,
        };
}
