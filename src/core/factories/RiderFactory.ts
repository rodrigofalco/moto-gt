import type { Rider, RiderStats } from '../types';
import {
  AI_RIDER_COUNT, AI_STAT_MIN, AI_STAT_MAX, AI_SUM_MIN, AI_SUM_MAX,
  PLAYER_STAT_BUDGET, STAT_MIN, STAT_MAX,
} from '../constants';
import { RIDER_NAMES, TEAM_NAMES } from '../../data/names';
import type { RNG } from '../RNG';

function emptyCounts(): number[] {
  return new Array(10).fill(0);
}

export function validatePointBuy(stats: RiderStats): boolean {
  const vals = [stats.pace, stats.cornering, stats.consistency];
  if (vals.some((v) => !Number.isInteger(v) || v < STAT_MIN || v > STAT_MAX)) return false;
  return vals.reduce((a, b) => a + b, 0) === PLAYER_STAT_BUDGET;
}

export function createPlayerRider(name: string, team: string, stats: RiderStats): Rider {
  return { id: 'player', name, team, isPlayer: true, stats, points: 0, positionCounts: emptyCounts() };
}

function generateAIStats(rng: RNG): RiderStats {
  for (let attempt = 0; attempt < 200; attempt++) {
    const pace = rng.nextInt(AI_STAT_MIN, AI_STAT_MAX);
    const cornering = rng.nextInt(AI_STAT_MIN, AI_STAT_MAX);
    const consistency = rng.nextInt(AI_STAT_MIN, AI_STAT_MAX);
    const sum = pace + cornering + consistency;
    if (sum >= AI_SUM_MIN && sum <= AI_SUM_MAX) return { pace, cornering, consistency };
  }
  return { pace: 5, cornering: 5, consistency: 5 };
}

export function generateAIRiders(rng: RNG, takenNames: string[]): Rider[] {
  const availableNames = RIDER_NAMES.filter((n) => !takenNames.includes(n));
  const teams = TEAM_NAMES.slice();
  const riders: Rider[] = [];
  for (let i = 0; i < AI_RIDER_COUNT; i++) {
    const name = availableNames.length > 0
      ? availableNames.splice(rng.nextInt(0, availableNames.length - 1), 1)[0]
      : `Rider ${i + 1}`;
    const team = teams.length > 0
      ? teams.splice(rng.nextInt(0, teams.length - 1), 1)[0]
      : `Team ${i + 1}`;
    riders.push({
      id: `ai${i}`, name, team, isPlayer: false,
      stats: generateAIStats(rng), points: 0, positionCounts: emptyCounts(),
    });
  }
  return riders;
}
