import type { RidingStyle } from './types';

export const SEASON_RACE_COUNT = 6;
export const GRID_SIZE = 10;
export const AI_RIDER_COUNT = 9;

export const POINTS_TABLE: readonly number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const PLAYER_STAT_BUDGET = 18;
export const STAT_MIN = 1;
export const STAT_MAX = 10;
export const AI_STAT_MIN = 2;
export const AI_STAT_MAX = 7;
export const AI_SUM_MIN = 11;
export const AI_SUM_MAX = 17;

export const CORNERING_MULTIPLIER = 3.0;
export const NOISE_STD_DEV = 1.5;

export const STYLE_PACE_MODIFIER: Record<RidingStyle, number> = {
  safe: -2,
  balanced: 0,
  aggressive: 2,
};

export const BASE_MISTAKE_PROB: Record<RidingStyle, number> = {
  safe: 0.02,
  balanced: 0.10,
  aggressive: 0.25,
};

export const CONSISTENCY_DIVISOR = 15.0;
export const CONSISTENCY_FLOOR = 0.01;
export const MISTAKE_PENALTY_BASE = 4.0;
export const MISTAKE_PENALTY_RANGE = 6.0;

export const TARGET_CHAMPION_RATE: readonly [number, number] = [0.30, 0.45];
