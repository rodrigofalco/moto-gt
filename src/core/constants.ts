import type { Setup, Risk } from './types';

export const SEASON_RACE_COUNT = 6;
export const GRID_SIZE = 10;
export const AI_RIDER_COUNT = 9;

export const POINTS_TABLE: readonly number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const STAT_MIN = 1;
export const STAT_MAX = 10;

// Simulation
export const STAT_SCALE = 1.0;
export const NOISE_STD_DEV = 1.1;
export const SETUP_BONUS = 1.5;
export const SETUP_PENALTY = 0.75;

export const PUSH_BONUS: Record<Risk, number> = { low: -1.0, medium: 0.0, high: 1.2 };
export const BASE_CRASH: Record<Risk, number> = { low: 0.02, medium: 0.06, high: 0.16 };
export const CONSISTENCY_DIVISOR = 15;
export const CONSISTENCY_FLOOR = 0.35;
export const CRASH_TECH_FACTOR = 7.0;
export const CRASH_TECH_THRESHOLD = 0.30;
// (crash = DNF via finishing-order in RaceEngine; no score-penalty constant needed)

export const SETUPS: readonly Setup[] = ['topSpeed', 'handling', 'acceleration'];
export const RISKS: readonly Risk[] = ['low', 'medium', 'high'];

// Progression
export const PILOT_XP_BASE = 10;
export const PILOT_XP_PODIUM = 5;
export const PILOT_XP_WIN = 5;
export const PILOT_XP_PER_LEVEL = 25;
export const RND_BASE = 2;
export const RND_PODIUM = 1;
export const RND_WIN = 1;

// Balance targets
export const TARGET_BUILD_RATE: readonly [number, number] = [0.25, 0.45];
export const MAX_BUILD_RATE_SPREAD = 0.15;

// Race-day (Phase B)
export const RACE_LAPS = 8;
// basePace accumulates over N laps (×N) while noise grows only ×√N, so to preserve
// Phase A's signal-to-noise ratio the per-lap noise must be NOISE_STD_DEV·√N, not /√N.
// (Co-equal balance is invariant to RACE_LAPS given this; fewer laps also = smoother motion.)
export const LAP_NOISE_STD = NOISE_STD_DEV * Math.sqrt(RACE_LAPS); // ≈ 2.83
export const RACE_ANIM_SECONDS = 80;          // 1× ≈ 10s/lap; speed control scales it
export const RACE_SPEEDS: readonly number[] = [1, 2, 4];

// Race-day dot colors by bike brand id.
export const BRAND_COLORS: Record<string, number> = {
  velocita: 0xe94560, // red
  apex: 0x4fc3f7,     // blue
  titan: 0xcfd8dc,    // silver
  vortex: 0xff9800,   // orange
};
