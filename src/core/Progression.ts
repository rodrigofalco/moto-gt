import type { Rider, RaceResult, BikeParams, PilotSkills } from './types';
import {
  PILOT_XP_BASE, PILOT_XP_PODIUM, PILOT_XP_WIN, PILOT_XP_PER_LEVEL,
  RND_BASE, RND_PODIUM, RND_WIN, STAT_MAX,
} from './constants';

export interface ProgressionSummary {
  riderId: string;
  pilotLevels: (keyof PilotSkills)[]; // skills raised this race
  rndEarned: number;
}

// Accumulated track-weight emphasis decides which pilot skill levels up.
// speed->pace, cornering->cornering, acceleration->consistency (racecraft).
const cumulativeEmphasis = new Map<string, { pace: number; cornering: number; consistency: number }>();

function trackEmphasisFor(rider: Rider, result: RaceResult): { pace: number; cornering: number; consistency: number } {
  const acc = cumulativeEmphasis.get(rider.id) ?? { pace: 0, cornering: 0, consistency: 0 };
  acc.pace += result.track.weights.speed;
  acc.cornering += result.track.weights.cornering;
  acc.consistency += result.track.weights.acceleration;
  cumulativeEmphasis.set(rider.id, acc);
  return acc;
}

function pickSkillToLevel(skills: PilotSkills, emphasis: { pace: number; cornering: number; consistency: number }): keyof PilotSkills | null {
  const order: (keyof PilotSkills)[] = (['pace', 'cornering', 'consistency'] as (keyof PilotSkills)[])
    .filter((k) => skills[k] < STAT_MAX)
    .sort((a, b) => emphasis[b] - emphasis[a]);
  return order.length ? order[0] : null;
}

function weakestParam(bike: BikeParams): keyof BikeParams {
  return (['speed', 'handling', 'acceleration'] as (keyof BikeParams)[])
    .filter((k) => bike[k] < STAT_MAX)
    .sort((a, b) => bike[a] - bike[b])[0] ?? 'speed';
}

export function investBikePoint(rider: Rider, param: keyof BikeParams): boolean {
  if (rider.rndPoints <= 0 || rider.bike[param] >= STAT_MAX) return false;
  rider.bike[param] += 1;
  rider.rndPoints -= 1;
  return true;
}

export function applyProgression(riders: Rider[], result: RaceResult): ProgressionSummary[] {
  const positionOf = new Map(result.finishingOrder.map((e) => [e.rider.id, e.position]));
  return riders.map((rider) => {
    const pos = positionOf.get(rider.id) ?? 10;
    const podium = pos <= 3;
    const win = pos === 1;

    // Pilot XP + auto level-ups.
    rider.pilotXp += PILOT_XP_BASE + (podium ? PILOT_XP_PODIUM : 0) + (win ? PILOT_XP_WIN : 0);
    const emphasis = trackEmphasisFor(rider, result);
    const pilotLevels: (keyof PilotSkills)[] = [];
    while (rider.pilotXp >= PILOT_XP_PER_LEVEL) {
      const skill = pickSkillToLevel(rider.skills, emphasis);
      if (!skill) { rider.pilotXp = PILOT_XP_PER_LEVEL - 1; break; }
      rider.skills[skill] += 1;
      rider.pilotXp -= PILOT_XP_PER_LEVEL;
      pilotLevels.push(skill);
    }

    // Bike R&D points.
    const rndEarned = RND_BASE + (podium ? RND_PODIUM : 0) + (win ? RND_WIN : 0);
    rider.rndPoints += rndEarned;
    // AI auto-spends immediately; player keeps points to spend in the hub.
    if (!rider.isPlayer) {
      while (rider.rndPoints > 0) {
        const before = rider.rndPoints;
        investBikePoint(rider, weakestParam(rider.bike));
        if (rider.rndPoints === before) break; // all params maxed
      }
    }

    return { riderId: rider.id, pilotLevels, rndEarned };
  });
}

// Test helper: progression accumulates per-rider emphasis across a season. Reset between seasons.
export function resetProgression(): void {
  cumulativeEmphasis.clear();
}
