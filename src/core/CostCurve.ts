import { PILOT_XP_PER_LEVEL } from './constants';

export function pilotLevelCost(currentStat: number): number {
  // Convex (quadratic) diminishing returns: cheap early so a career keeps growing,
  // steep late so the last points cost most. Resolves the tension between "stats must
  // not max out in 2 seasons" (P2.4) and "top-end costs >> low-end" (P2.1).
  return Math.round(PILOT_XP_PER_LEVEL * (1 + 0.0375 * (currentStat - 1) ** 2));
}

export function bikeUpgradeCost(currentParam: number): number {
  return Math.round(2 * (1 + 0.5 * (currentParam - 1)));
}
