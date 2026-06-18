import { PILOT_XP_PER_LEVEL } from './constants';

export function pilotLevelCost(currentStat: number): number {
  return Math.round(PILOT_XP_PER_LEVEL * (1 + 0.6 * (currentStat - 1)));
}

export function bikeUpgradeCost(currentParam: number): number {
  return Math.round(2 * (1 + 0.5 * (currentParam - 1)));
}
