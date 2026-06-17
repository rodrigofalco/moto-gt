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
export const BASE_CRASH: Record<Risk, number> = { low: 0.028, medium: 0.084, high: 0.224 };
export const CONSISTENCY_DIVISOR = 9;
export const CONSISTENCY_FLOOR = 0.15;
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
// Per-lap noise is kept low for smooth lap-to-lap motion. Race-total variance — and
// therefore build balance — is preserved by the AR(1) momentum process in
// RaceEngine.stepLap (see docs/superpowers/specs/2026-06-16-race-stability-improvements.md).
export const LAP_NOISE_STD = 1.5;
export const MOMENTUM_WEIGHT = 0.6;   // AR(1): fraction of last lap's noise carried into this lap
export const DRAFT_RANGE = 2.0;       // progress-points: a trailing rider within this of someone ahead gets a tow
export const DRAFT_BONUS = 0.3;       // progress-points/lap tow for a rider with a non-crashed rider close ahead
// Pulls every rider's per-lap pace toward the field mean so the pack stays close (no
// blowout lapping) WITHOUT changing finishing order — it's an order-preserving linear
// compression around the mean, so champion rates (balance) are unchanged. 1.0 = no
// compression (raw spread); lower = tighter racing.
export const FIELD_COMPRESSION = 0.35;
export const RACE_ANIM_SECONDS = 32;          // 1× ≈ 4s/lap; speed control scales it (continuous motion)
export const RACE_SPEEDS: readonly number[] = [1, 2, 4];

// Race-day view (gap-train + lap times). See docs/superpowers/specs/2026-06-16-race-view-overhaul-design.md.
export const MIN_SEP = 0.03;                  // min loop-fraction between consecutive dots (prevents stacking)
export const MAX_STEP = 0.06;                 // max loop-fraction between consecutive dots ((GRID-1)*MAX_STEP < 1 loop)
export const MAX_SPREAD = 0.5;                // where crashed-out riders are parked on the ring
export const LAP_TIME_BASE = 90.0;            // race-fiction seconds to cover one loop at average pace
export const LAP_TIME_SPREAD = 0.25;          // how much pace variation shows in lap times (0 = all identical, 1 = raw)

// Race-day dot colors by bike brand id.
export const BRAND_COLORS: Record<string, number> = {
  velocita: 0xe94560, // red
  apex: 0x4fc3f7,     // blue
  titan: 0xcfd8dc,    // silver
  vortex: 0xff9800,   // orange
};
