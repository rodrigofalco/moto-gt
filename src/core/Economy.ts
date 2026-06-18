import { bikeUpgradeCost } from './CostCurve';

export const PRIZE_MONEY: readonly number[] = [5000, 3500, 2500, 1800, 1300, 1000, 700, 500, 300, 150];
export const STARTING_MONEY_CAREER = 2000;
export const RND_POINT_COST = 800;

export { bikeUpgradeCost };

export function prizeFor(position: number): number {
  if (position < 1 || position > 10) return 0;
  return PRIZE_MONEY[position - 1];
}
