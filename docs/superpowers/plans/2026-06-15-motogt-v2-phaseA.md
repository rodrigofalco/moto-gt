# MotoGT v2 Phase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild MotoGT's core into a manager game — choose a pilot + bike brand, make per-race setup + risk decisions against track profiles, and evolve pilot (auto) and bike (R&D) across a 6-race season — with co-equal builds verified by a Monte Carlo harness, then new selection / hub / result UI.

**Architecture:** Pure `src/core/` logic (no Phaser) holds entities, the axis-based simulation, crash model, AI decisions, and progression, all unit-tested; a balance harness tunes constants to co-equal/no-snowball targets before UI exists. Phaser scenes (selection, hub with R&D + setup/risk, result with progression) sit on top. Work happens on branch `v2-manager`; `main` keeps the playable V1.

**Tech Stack:** TypeScript (strict), Phaser 3/4, Vite, Vitest, Playwright (UI probe).

**Reference spec:** `docs/superpowers/specs/2026-06-15-motogt-v2-phaseA-manager-redesign.md`

**Reused from V1 unchanged:** `src/core/RNG.ts`, the points table, Phaser config/boot, `src/ui/Button.ts` (fixed hit area + feedback), native text input pattern, HMR-reload guard, `tools/uiprobe.mjs`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/types.ts` | New entities (PilotSkills, BikeParams, Rider, Track weights, Setup, Risk, RaceResult, SeasonState) |
| `src/core/constants.ts` | All tunable constants |
| `src/data/pilots.ts` | 6 pilot archetypes |
| `src/data/brands.ts` | 4 bike brands |
| `src/data/tracks.ts` | 6 tracks with axis weights |
| `src/core/PerformanceModel.ts` | Axes, setup bias, weighted base score |
| `src/core/CrashModel.ts` | Crash probability + penalty (replaces MistakeSystem) |
| `src/core/AIDecision.ts` | AI setup + risk selection |
| `src/core/RaceSimulator.ts` | Combine → finishing order |
| `src/core/Progression.ts` | Pilot auto-level, bike R&D, AI evolution |
| `src/core/Championship.ts` | Standings + countback (adapted to new Rider) |
| `src/core/factories/RiderFactory.ts` | Build riders from pilot+brand; AI assignment |
| `src/core/factories/SeasonFactory.ts` | Calendar + season assembly |
| `src/scenes/MainMenuScene.ts` | Team name + pilot picker + brand picker |
| `src/scenes/SeasonScene.ts` | Calendar, standings, R&D panel, setup/risk, simulate |
| `src/scenes/RaceResultScene.ts` | Order, progression earned, standings, season end |
| `src/ui/Card.ts` | Reusable pilot/brand stat card |
| `tests/*.test.ts` | Unit + balance tests |

> Delete after migration: `src/core/MistakeSystem.ts`, `src/core/AIStyleSelector.ts`, and V1-only tests (`tests/mistake.test.ts`, `tests/aiStyle.test.ts`) — replaced by new modules/tests below.

---

### Task 1: New domain types

**Files:**
- Modify (replace contents): `src/core/types.ts`

- [ ] **Step 1: Replace `src/core/types.ts` with the new model**

```typescript
export type Setup = 'topSpeed' | 'handling' | 'acceleration';
export type Risk = 'low' | 'medium' | 'high';

export interface PilotSkills { pace: number; cornering: number; consistency: number; } // 1..10
export interface BikeParams { speed: number; handling: number; acceleration: number; } // 1..10

export interface PilotArchetype { id: string; name: string; nickname: string; skills: PilotSkills; }
export interface Brand { id: string; name: string; params: BikeParams; }

export interface TrackWeights { speed: number; cornering: number; acceleration: number; } // sum = 1
export interface Track { id: string; name: string; location: string; weights: TrackWeights; }

export interface Rider {
  id: string;
  name: string;
  team: string;
  isPlayer: boolean;
  skills: PilotSkills;       // evolves automatically (pilot XP)
  bike: BikeParams;          // evolves via R&D investment
  pilotXp: number;           // accumulated XP toward auto level-ups
  rndPoints: number;         // unspent bike development points
  points: number;
  positionCounts: number[];  // length 10, countback tiebreak
}

export interface RaceEntry {
  rider: Rider;
  position: number;          // 1..10
  pointsAwarded: number;
  setup: Setup;
  risk: Risk;
  crashed: boolean;
  performanceScore: number;
}

export interface RaceResult {
  raceIndex: number;         // 0..5
  track: Track;
  finishingOrder: RaceEntry[];
}

export interface SeasonState {
  playerRider: Rider;
  aiRiders: Rider[];         // 9
  calendar: Track[];         // 6
  currentRaceIndex: number;  // 0..6
  raceResults: RaceResult[];
  isSeasonComplete: boolean;
}
```

- [ ] **Step 2: Verify it compiles (other files will break — expected)**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: errors only in old files that reference removed V1 types (RaceSimulator, factories, scenes). `types.ts` itself has no errors. Proceed; later tasks fix the rest.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(v2): new domain types for pilots, bikes, setup/risk"
```

---

### Task 2: Constants

**Files:**
- Modify (replace contents): `src/core/constants.ts`

- [ ] **Step 1: Replace `src/core/constants.ts`**

```typescript
import type { Setup, Risk } from './types';

export const SEASON_RACE_COUNT = 6;
export const GRID_SIZE = 10;
export const AI_RIDER_COUNT = 9;

export const POINTS_TABLE: readonly number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const STAT_MIN = 1;
export const STAT_MAX = 10;

// Simulation
export const STAT_SCALE = 1.0;
export const NOISE_STD_DEV = 1.2;
export const SETUP_BONUS = 1.5;
export const SETUP_PENALTY = 0.75;

export const PUSH_BONUS: Record<Risk, number> = { low: -1.0, medium: 0.0, high: 1.5 };
export const BASE_CRASH: Record<Risk, number> = { low: 0.03, medium: 0.10, high: 0.22 };
export const CONSISTENCY_DIVISOR = 15;
export const CONSISTENCY_FLOOR = 0.35;
export const CRASH_TECH_FACTOR = 1.0;
export const CRASH_PENALTY_BASE = 4.0;
export const CRASH_PENALTY_RANGE = 6.0;

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
```

- [ ] **Step 2: Verify `constants.ts` compiles**

Run: `npx tsc --noEmit 2>&1 | grep constants.ts || echo "constants OK"`
Expected: `constants OK`.

- [ ] **Step 3: Commit**

```bash
git add src/core/constants.ts
git commit -m "feat(v2): constants for axis sim, crash, and progression"
```

---

### Task 3: Data rosters (pilots, brands, tracks)

**Files:**
- Create: `src/data/pilots.ts`, `src/data/brands.ts`
- Modify (replace contents): `src/data/tracks.ts`
- Test: `tests/data.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { TRACK_BANK } from '../src/data/tracks';

describe('data rosters', () => {
  it('has 6 pilots with in-range skills and unique ids', () => {
    expect(PILOT_ROSTER).toHaveLength(6);
    expect(new Set(PILOT_ROSTER.map((p) => p.id)).size).toBe(6);
    for (const p of PILOT_ROSTER) {
      for (const v of [p.skills.pace, p.skills.cornering, p.skills.consistency]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it('has 4 brands with in-range params', () => {
    expect(BRAND_ROSTER).toHaveLength(4);
    for (const b of BRAND_ROSTER) {
      for (const v of [b.params.speed, b.params.handling, b.params.acceleration]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it('has 6 tracks whose axis weights sum to 1', () => {
    expect(TRACK_BANK).toHaveLength(6);
    for (const t of TRACK_BANK) {
      const sum = t.weights.speed + t.weights.cornering + t.weights.acceleration;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- data`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Write `src/data/pilots.ts`**

```typescript
import type { PilotArchetype } from '../core/types';

export const PILOT_ROSTER: readonly PilotArchetype[] = [
  { id: 'rossi',   name: 'Marco Rossi',    nickname: 'The Rocket',          skills: { pace: 9, cornering: 5, consistency: 5 } },
  { id: 'bianchi', name: 'Luca Bianchi',   nickname: 'The Surgeon',         skills: { pace: 5, cornering: 9, consistency: 6 } },
  { id: 'larsson', name: 'Sven Larsson',   nickname: 'The Metronome',       skills: { pace: 6, cornering: 6, consistency: 9 } },
  { id: 'marquez', name: 'Diego Marquez',  nickname: 'The All-Rounder',     skills: { pace: 7, cornering: 7, consistency: 6 } },
  { id: 'tanaka',  name: 'Yuki Tanaka',    nickname: 'The Hotshot',         skills: { pace: 8, cornering: 7, consistency: 3 } },
  { id: 'lindqvist', name: 'Sara Lindqvist', nickname: 'The Smooth Operator', skills: { pace: 6, cornering: 8, consistency: 7 } },
];
```

- [ ] **Step 4: Write `src/data/brands.ts`**

```typescript
import type { Brand } from '../core/types';

export const BRAND_ROSTER: readonly Brand[] = [
  { id: 'velocita', name: 'Velocita', params: { speed: 9, handling: 5, acceleration: 6 } },
  { id: 'apex',     name: 'Apex',     params: { speed: 6, handling: 9, acceleration: 6 } },
  { id: 'titan',    name: 'Titan',    params: { speed: 7, handling: 7, acceleration: 7 } },
  { id: 'vortex',   name: 'Vortex',   params: { speed: 6, handling: 6, acceleration: 9 } },
];
```

- [ ] **Step 5: Replace `src/data/tracks.ts`**

```typescript
import type { Track } from '../core/types';

export const TRACK_BANK: readonly Track[] = [
  { id: 'mugello',     name: 'Mugello Circuit',  location: 'Italy',     weights: { speed: 0.50, cornering: 0.30, acceleration: 0.20 } },
  { id: 'sachsenring', name: 'Sachsenring',      location: 'Germany',   weights: { speed: 0.20, cornering: 0.60, acceleration: 0.20 } },
  { id: 'redbull',     name: 'Red Bull Ring',    location: 'Austria',   weights: { speed: 0.30, cornering: 0.25, acceleration: 0.45 } },
  { id: 'phillip',     name: 'Phillip Island',   location: 'Australia', weights: { speed: 0.40, cornering: 0.45, acceleration: 0.15 } },
  { id: 'jerez',       name: 'Circuito de Jerez', location: 'Spain',    weights: { speed: 0.20, cornering: 0.45, acceleration: 0.35 } },
  { id: 'silverstone', name: 'Silverstone',      location: 'UK',        weights: { speed: 0.35, cornering: 0.40, acceleration: 0.25 } },
];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- data`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/data/pilots.ts src/data/brands.ts src/data/tracks.ts tests/data.test.ts
git commit -m "feat(v2): pilot/brand/track rosters with axis weights"
```

---

### Task 4: Performance model (axes, setup, weighted base)

**Files:**
- Create: `src/core/PerformanceModel.ts`
- Test: `tests/performance.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { baseAxes, applySetup, weightedBase } from '../src/core/PerformanceModel';
import type { Track } from '../src/core/types';

const skills = { pace: 8, cornering: 4, consistency: 6 };
const bike = { speed: 8, handling: 4, acceleration: 6 };
const fastTrack: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.6, cornering: 0.2, acceleration: 0.2 } };

describe('PerformanceModel', () => {
  it('blends pilot+bike into axes (accel is bike-only)', () => {
    const a = baseAxes(skills, bike);
    expect(a.speed).toBe(8);        // (8+8)/2
    expect(a.cornering).toBe(4);    // (4+4)/2
    expect(a.acceleration).toBe(6); // bike only
  });

  it('topSpeed setup raises speed and lowers the others', () => {
    const a = applySetup(baseAxes(skills, bike), 'topSpeed');
    expect(a.speed).toBeCloseTo(9.5);       // +1.5
    expect(a.cornering).toBeCloseTo(3.25);  // -0.75
    expect(a.acceleration).toBeCloseTo(5.25);
  });

  it('weightedBase rewards matching the track', () => {
    const matched = weightedBase(applySetup(baseAxes(skills, bike), 'topSpeed'), fastTrack);
    const mismatched = weightedBase(applySetup(baseAxes(skills, bike), 'handling'), fastTrack);
    expect(matched).toBeGreaterThan(mismatched);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- performance`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/PerformanceModel.ts`**

```typescript
import type { PilotSkills, BikeParams, Setup, Track } from './types';
import { STAT_SCALE, SETUP_BONUS, SETUP_PENALTY } from './constants';

export interface Axes { speed: number; cornering: number; acceleration: number; }

export function baseAxes(skills: PilotSkills, bike: BikeParams): Axes {
  return {
    speed: (skills.pace + bike.speed) / 2,
    cornering: (skills.cornering + bike.handling) / 2,
    acceleration: bike.acceleration,
  };
}

export function applySetup(axes: Axes, setup: Setup): Axes {
  const a = { ...axes };
  const boost = (key: keyof Axes) => {
    a[key] += SETUP_BONUS;
    (['speed', 'cornering', 'acceleration'] as (keyof Axes)[])
      .filter((k) => k !== key)
      .forEach((k) => { a[k] -= SETUP_PENALTY; });
  };
  if (setup === 'topSpeed') boost('speed');
  else if (setup === 'handling') boost('cornering');
  else boost('acceleration');
  return a;
}

export function weightedBase(axes: Axes, track: Track): number {
  const w = track.weights;
  return STAT_SCALE * (w.speed * axes.speed + w.cornering * axes.cornering + w.acceleration * axes.acceleration);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- performance`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/PerformanceModel.ts tests/performance.test.ts
git commit -m "feat(v2): axis performance model with setup bias"
```

---

### Task 5: Crash model

**Files:**
- Create: `src/core/CrashModel.ts`
- Test: `tests/crash.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { crashProbability, crashPenalty } from '../src/core/CrashModel';
import { RNG } from '../src/core/RNG';
import type { Track } from '../src/core/types';

const technical: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.2, cornering: 0.6, acceleration: 0.2 } };
const fast: Track = { id: 'f', name: 'F', location: 'X', weights: { speed: 0.6, cornering: 0.2, acceleration: 0.2 } };

describe('CrashModel', () => {
  it('high risk is crashier than low risk', () => {
    expect(crashProbability('high', 5, technical)).toBeGreaterThan(crashProbability('low', 5, technical));
  });

  it('technical tracks are crashier than fast tracks at equal risk', () => {
    expect(crashProbability('high', 5, technical)).toBeGreaterThan(crashProbability('high', 5, fast));
  });

  it('higher consistency lowers crash probability', () => {
    expect(crashProbability('high', 10, technical)).toBeLessThan(crashProbability('high', 1, technical));
  });

  it('clamps into [0, 0.9] and penalty in [4,10]', () => {
    expect(crashProbability('high', 1, technical)).toBeLessThanOrEqual(0.9);
    const r = new RNG(1);
    for (let i = 0; i < 500; i++) {
      const p = crashPenalty(r);
      expect(p).toBeGreaterThanOrEqual(4);
      expect(p).toBeLessThanOrEqual(10);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- crash`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/CrashModel.ts`**

```typescript
import type { Risk, Track } from './types';
import {
  BASE_CRASH, CONSISTENCY_DIVISOR, CONSISTENCY_FLOOR, CRASH_TECH_FACTOR,
  CRASH_PENALTY_BASE, CRASH_PENALTY_RANGE,
} from './constants';
import type { RNG } from './RNG';

export function crashProbability(risk: Risk, consistency: number, track: Track): number {
  const factor = Math.max(CONSISTENCY_FLOOR, 1 - (consistency - 1) / CONSISTENCY_DIVISOR);
  const p = BASE_CRASH[risk] * factor * (1 + CRASH_TECH_FACTOR * track.weights.cornering);
  return Math.min(0.9, Math.max(0, p));
}

export function crashPenalty(rng: RNG): number {
  return CRASH_PENALTY_BASE + rng.nextFloatRange(0, CRASH_PENALTY_RANGE);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- crash`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/CrashModel.ts tests/crash.test.ts
git commit -m "feat(v2): track- and consistency-dependent crash model"
```

---

### Task 6: AI decisions (setup + risk)

**Files:**
- Create: `src/core/AIDecision.ts`
- Test: `tests/aiDecision.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { dominantSetup, aiSetup, aiRisk } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import type { Rider, Track } from '../src/core/types';

const technical: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.2, cornering: 0.6, acceleration: 0.2 } };
const stopGo: Track = { id: 's', name: 'S', location: 'X', weights: { speed: 0.3, cornering: 0.25, acceleration: 0.45 } };

function rider(consistency: number): Rider {
  return {
    id: 'ai', name: 'AI', team: 'T', isPlayer: false,
    skills: { pace: 5, cornering: 5, consistency },
    bike: { speed: 5, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
  };
}

describe('AIDecision', () => {
  it('dominantSetup picks the track\'s biggest axis', () => {
    expect(dominantSetup(technical)).toBe('handling');
    expect(dominantSetup(stopGo)).toBe('acceleration');
  });

  it('aiSetup mostly matches the track', () => {
    const rng = new RNG(3);
    let matched = 0;
    for (let i = 0; i < 1000; i++) if (aiSetup(rider(5), technical, rng) === 'handling') matched++;
    expect(matched).toBeGreaterThan(600); // ~75%
  });

  it('high-consistency riders push more than low-consistency', () => {
    const rng = new RNG(7);
    const countHigh = (c: number) => {
      let n = 0;
      for (let i = 0; i < 2000; i++) if (aiRisk(rider(c), rng) === 'high') n++;
      return n;
    };
    expect(countHigh(9)).toBeGreaterThan(countHigh(2));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- aiDecision`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/AIDecision.ts`**

```typescript
import type { Rider, Setup, Risk, Track } from './types';
import { SETUPS } from './constants';
import type { RNG } from './RNG';

export function dominantSetup(track: Track): Setup {
  const w = track.weights;
  if (w.speed >= w.cornering && w.speed >= w.acceleration) return 'topSpeed';
  if (w.cornering >= w.acceleration) return 'handling';
  return 'acceleration';
}

export function aiSetup(_rider: Rider, track: Track, rng: RNG): Setup {
  if (rng.nextFloat() < 0.75) return dominantSetup(track);
  return rng.pick(SETUPS);
}

export function aiRisk(rider: Rider, rng: RNG): Risk {
  const c = rider.skills.consistency;
  const roll = rng.nextInt(1, 100);
  if (c >= 7) return roll <= 15 ? 'low' : roll <= 55 ? 'medium' : 'high';
  if (c <= 3) return roll <= 50 ? 'low' : roll <= 85 ? 'medium' : 'high';
  return roll <= 30 ? 'low' : roll <= 70 ? 'medium' : 'high';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- aiDecision`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/AIDecision.ts tests/aiDecision.test.ts
git commit -m "feat(v2): AI setup and risk selection"
```

---

### Task 7: Race simulator

**Files:**
- Modify (replace contents): `src/core/RaceSimulator.ts`
- Test: `tests/simulation.test.ts` (replace)

- [ ] **Step 1: Replace `tests/simulation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { simulateRace } from '../src/core/RaceSimulator';
import { RNG } from '../src/core/RNG';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer: boolean, pace: number): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    skills: { pace, cornering: 5, consistency: 5 },
    bike: { speed: 5, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
  };
}
const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.5, cornering: 0.3, acceleration: 0.2 } };

function mkSeason(): SeasonState {
  return {
    playerRider: mkRider('player', true, 6),
    aiRiders: Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`, false, 5)),
    calendar: [track], currentRaceIndex: 0, raceResults: [], isSeasonComplete: false,
  };
}

describe('simulateRace', () => {
  it('produces 10 unique positions and 101 points total', () => {
    const r = simulateRace(mkSeason(), 'topSpeed', 'medium', new RNG(1));
    expect(r.finishingOrder.map((f) => f.position).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.finishingOrder.reduce((s, f) => s + f.pointsAwarded, 0)).toBe(101);
  });

  it('records the player setup/risk and includes the player', () => {
    const r = simulateRace(mkSeason(), 'handling', 'high', new RNG(2));
    const p = r.finishingOrder.find((f) => f.rider.isPlayer)!;
    expect(p.setup).toBe('handling');
    expect(p.risk).toBe('high');
  });

  it('is deterministic for a fixed seed', () => {
    const a = simulateRace(mkSeason(), 'topSpeed', 'medium', new RNG(99));
    const b = simulateRace(mkSeason(), 'topSpeed', 'medium', new RNG(99));
    expect(a.finishingOrder.map((f) => f.rider.id)).toEqual(b.finishingOrder.map((f) => f.rider.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- simulation`
Expected: FAIL — signature mismatch / old implementation.

- [ ] **Step 3: Replace `src/core/RaceSimulator.ts`**

```typescript
import type { SeasonState, Setup, Risk, Rider, Track, RaceResult, RaceEntry } from './types';
import { POINTS_TABLE, PUSH_BONUS, NOISE_STD_DEV } from './constants';
import { baseAxes, applySetup, weightedBase, type Axes } from './PerformanceModel';
import { crashProbability, crashPenalty } from './CrashModel';
import { aiSetup, aiRisk } from './AIDecision';
import type { RNG } from './RNG';

interface Scored { rider: Rider; setup: Setup; risk: Risk; crashed: boolean; perf: number; axes: Axes; }

function scoreRider(rider: Rider, setup: Setup, risk: Risk, track: Track, rng: RNG): Scored {
  const axes = applySetup(baseAxes(rider.skills, rider.bike), setup);
  let perf = weightedBase(axes, track) + PUSH_BONUS[risk] + rng.gaussian(0, NOISE_STD_DEV);
  let crashed = false;
  if (rng.nextFloat() < crashProbability(risk, rider.skills.consistency, track)) {
    crashed = true;
    perf -= crashPenalty(rng);
  }
  return { rider, setup, risk, crashed, perf, axes };
}

function compare(a: Scored, b: Scored, rng: RNG): number {
  if (a.perf !== b.perf) return b.perf - a.perf;
  if (a.axes.speed !== b.axes.speed) return b.axes.speed - a.axes.speed;
  if (a.axes.cornering !== b.axes.cornering) return b.axes.cornering - a.axes.cornering;
  if (a.axes.acceleration !== b.axes.acceleration) return b.axes.acceleration - a.axes.acceleration;
  return rng.nextFloat() - 0.5;
}

export function simulateRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): RaceResult {
  if (season.currentRaceIndex >= season.calendar.length) throw new Error('All races have been simulated.');
  const track = season.calendar[season.currentRaceIndex];
  const all = [season.playerRider, ...season.aiRiders];

  const scored = all.map((rider) => {
    const setup = rider.isPlayer ? playerSetup : aiSetup(rider, track, rng);
    const risk = rider.isPlayer ? playerRisk : aiRisk(rider, rng);
    return scoreRider(rider, setup, risk, track, rng);
  });

  scored.sort((a, b) => compare(a, b, rng));

  const finishingOrder: RaceEntry[] = scored.map((s, index) => ({
    rider: s.rider,
    position: index + 1,
    pointsAwarded: index < POINTS_TABLE.length ? POINTS_TABLE[index] : 0,
    setup: s.setup,
    risk: s.risk,
    crashed: s.crashed,
    performanceScore: s.perf,
  }));

  return { raceIndex: season.currentRaceIndex, track, finishingOrder };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- simulation`
Expected: PASS (3 tests).

- [ ] **Step 5: Delete obsolete V1 sim modules + tests**

```bash
git rm src/core/MistakeSystem.ts src/core/AIStyleSelector.ts tests/mistake.test.ts tests/aiStyle.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/core/RaceSimulator.ts tests/simulation.test.ts
git commit -m "feat(v2): axis-based race simulator with setup/risk/crash; remove V1 style sim"
```

---

### Task 8: Championship (adapt standings to new Rider)

**Files:**
- Modify (replace contents): `src/core/Championship.ts`
- Test: `tests/championship.test.ts` (replace)

- [ ] **Step 1: Replace `tests/championship.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { applyRaceResult, getStandings, getChampion } from '../src/core/Championship';
import { simulateRace } from '../src/core/RaceSimulator';
import { RNG } from '../src/core/RNG';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer = false): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    skills: { pace: 5, cornering: 5, consistency: 5 },
    bike: { speed: 5, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
  };
}
const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.5, cornering: 0.3, acceleration: 0.2 } };
function mkSeason(): SeasonState {
  return {
    playerRider: mkRider('player', true),
    aiRiders: Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`)),
    calendar: [track, track], currentRaceIndex: 0, raceResults: [], isSeasonComplete: false,
  };
}

describe('Championship', () => {
  it('applyRaceResult accumulates 101 points and advances the index', () => {
    const s = mkSeason();
    applyRaceResult(s, simulateRace(s, 'topSpeed', 'medium', new RNG(1)));
    expect(s.currentRaceIndex).toBe(1);
    expect([s.playerRider, ...s.aiRiders].reduce((a, r) => a + r.points, 0)).toBe(101);
  });

  it('standings break ties by countback (more wins first)', () => {
    const s = mkSeason();
    s.playerRider.points = 25; s.playerRider.positionCounts[0] = 1;
    s.aiRiders[0].points = 25; s.aiRiders[0].positionCounts[1] = 1;
    expect(getStandings(s)[0].id).toBe('player');
  });

  it('getChampion returns the points leader', () => {
    const s = mkSeason();
    s.aiRiders[2].points = 50;
    expect(getChampion(s).id).toBe('ai2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- championship`
Expected: FAIL — old `getStandings` references `stats` (removed).

- [ ] **Step 3: Replace `src/core/Championship.ts`**

```typescript
import type { SeasonState, RaceResult, Rider } from './types';
import { SEASON_RACE_COUNT } from './constants';

export function applyRaceResult(season: SeasonState, result: RaceResult): void {
  for (const e of result.finishingOrder) {
    e.rider.points += e.pointsAwarded;
    e.rider.positionCounts[e.position - 1] += 1;
  }
  season.raceResults.push(result);
  season.currentRaceIndex += 1;
  season.isSeasonComplete = season.currentRaceIndex >= SEASON_RACE_COUNT;
}

function compareStandings(a: Rider, b: Rider): number {
  if (a.points !== b.points) return b.points - a.points;
  for (let i = 0; i < 10; i++) {
    if (a.positionCounts[i] !== b.positionCounts[i]) return b.positionCounts[i] - a.positionCounts[i];
  }
  // Final deterministic fallback: id order (effectively never reached).
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function getStandings(season: SeasonState): Rider[] {
  return [season.playerRider, ...season.aiRiders].slice().sort(compareStandings);
}

export function getChampion(season: SeasonState): Rider {
  return getStandings(season)[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- championship`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/Championship.ts tests/championship.test.ts
git commit -m "feat(v2): adapt championship standings to new Rider model"
```

---

### Task 9: Progression (pilot auto-level, bike R&D, AI evolution)

**Files:**
- Create: `src/core/Progression.ts`
- Test: `tests/progression.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { applyProgression, investBikePoint } from '../src/core/Progression';
import type { Rider, RaceResult, Track } from '../src/core/types';

const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.8, cornering: 0.1, acceleration: 0.1 } };

function mkRider(id: string, isPlayer: boolean): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    skills: { pace: 5, cornering: 5, consistency: 5 },
    bike: { speed: 5, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
  };
}

function resultWith(order: Rider[]): RaceResult {
  return {
    raceIndex: 0, track,
    finishingOrder: order.map((rider, i) => ({
      rider, position: i + 1, pointsAwarded: 0, setup: 'topSpeed', risk: 'medium', crashed: false, performanceScore: 0,
    })),
  };
}

describe('Progression', () => {
  it('player earns R&D points (base + win bonus) but does not auto-spend the bike', () => {
    const player = mkRider('player', true);
    const ais = Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`, false));
    applyProgression([player, ...ais], resultWith([player, ...ais])); // player won
    expect(player.rndPoints).toBe(2 + 1 + 1); // base + podium + win
    expect(player.bike.speed).toBe(5);        // unspent
  });

  it('investBikePoint spends one point, capped at 10', () => {
    const player = mkRider('player', true);
    player.rndPoints = 1;
    expect(investBikePoint(player, 'speed')).toBe(true);
    expect(player.bike.speed).toBe(6);
    expect(player.rndPoints).toBe(0);
    expect(investBikePoint(player, 'speed')).toBe(false); // no points left
  });

  it('pilot auto-levels toward the raced track emphasis after enough XP', () => {
    const ai = mkRider('ai', false);
    // 3 wins on a speed-heavy track => XP 3*(10+5+5)=60 => 2 level-ups, both to pace (speed axis).
    const all = [ai];
    for (let i = 0; i < 3; i++) applyProgression(all, resultWith([ai]));
    expect(ai.skills.pace).toBe(7); // +2
  });

  it('AI bikes auto-spend their R&D on the weakest param', () => {
    const ai = mkRider('ai', false);
    ai.bike = { speed: 8, handling: 3, acceleration: 8 };
    applyProgression([ai], resultWith([ai])); // earns 4 points, all to handling (weakest)
    expect(ai.bike.handling).toBe(7);
    expect(ai.rndPoints).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- progression`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/Progression.ts`**

```typescript
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
```

> Note: `cumulativeEmphasis` is module state keyed by rider id. `resetProgression()` MUST be called at the start of each new season (factory + balance harness) so seasons don't leak emphasis into each other. Task 11 calls it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- progression`
Expected: PASS (4 tests). (Each test uses fresh rider ids; if flaky due to shared ids across tests, call `resetProgression()` in a `beforeEach` — add `import { resetProgression } from '../src/core/Progression'` and `beforeEach(resetProgression)`.)

- [ ] **Step 5: Commit**

```bash
git add src/core/Progression.ts tests/progression.test.ts
git commit -m "feat(v2): pilot auto-leveling, bike R&D, and AI evolution"
```

---

### Task 10: Factories (riders from pilot+brand, season)

**Files:**
- Modify (replace contents): `src/core/factories/RiderFactory.ts`, `src/core/factories/SeasonFactory.ts`
- Test: `tests/factories.test.ts` (replace `riderFactory.test.ts` and `seasonFactory.test.ts`)

- [ ] **Step 1: Remove old factory tests and write `tests/factories.test.ts`**

```bash
git rm tests/riderFactory.test.ts tests/seasonFactory.test.ts
```

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createPlayerRider, generateAIRiders } from '../src/core/factories/RiderFactory';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { resetProgression } from '../src/core/Progression';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { RNG } from '../src/core/RNG';

beforeEach(resetProgression);

describe('factories', () => {
  it('createPlayerRider copies pilot skills + brand params', () => {
    const r = createPlayerRider('My Team', PILOT_ROSTER[0], BRAND_ROSTER[0]);
    expect(r.isPlayer).toBe(true);
    expect(r.skills).toEqual(PILOT_ROSTER[0].skills);
    expect(r.bike).toEqual(BRAND_ROSTER[0].params);
    expect(r.skills).not.toBe(PILOT_ROSTER[0].skills); // a copy, not a reference
  });

  it('generateAIRiders makes 9 riders not using the player pilot/brand ids where possible', () => {
    const ai = generateAIRiders(PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(1));
    expect(ai).toHaveLength(9);
    expect(new Set(ai.map((r) => r.id)).size).toBe(9);
  });

  it('createSeason assembles 1 player + 9 AI + 6 tracks', () => {
    const s = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(2));
    expect(s.playerRider.isPlayer).toBe(true);
    expect(s.aiRiders).toHaveLength(9);
    expect(s.calendar).toHaveLength(6);
    expect(new Set(s.calendar.map((t) => t.id)).size).toBe(6);
    expect(s.currentRaceIndex).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- factories`
Expected: FAIL — new factory signatures don't exist.

- [ ] **Step 3: Replace `src/core/factories/RiderFactory.ts`**

```typescript
import type { Rider, PilotArchetype, Brand } from '../types';
import { AI_RIDER_COUNT } from '../constants';
import { PILOT_ROSTER } from '../../data/pilots';
import { BRAND_ROSTER } from '../../data/brands';
import type { RNG } from '../RNG';

function emptyCounts(): number[] { return new Array(10).fill(0); }

export function createPlayerRider(team: string, pilot: PilotArchetype, brand: Brand): Rider {
  return {
    id: 'player', name: pilot.name, team, isPlayer: true,
    skills: { ...pilot.skills }, bike: { ...brand.params },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
  };
}

export function generateAIRiders(playerPilotId: string, playerBrandId: string, rng: RNG): Rider[] {
  const pilots = PILOT_ROSTER.filter((p) => p.id !== playerPilotId);
  const brands = BRAND_ROSTER.slice();
  const riders: Rider[] = [];
  for (let i = 0; i < AI_RIDER_COUNT; i++) {
    const pilot = pilots[i % pilots.length];
    const brand = brands[rng.nextInt(0, brands.length - 1)];
    riders.push({
      id: `ai${i}`,
      name: i < pilots.length ? pilot.name : `${pilot.name} ${Math.floor(i / pilots.length) + 1}`,
      team: brand.name,
      isPlayer: false,
      skills: { ...pilot.skills },
      bike: brand.id === playerBrandId ? { ...brand.params } : { ...brand.params },
      pilotXp: 0, rndPoints: 0, points: 0, positionCounts: emptyCounts(),
    });
  }
  return riders;
}
```

- [ ] **Step 4: Replace `src/core/factories/SeasonFactory.ts`**

```typescript
import type { SeasonState, PilotArchetype, Brand, Track } from '../types';
import { SEASON_RACE_COUNT } from '../constants';
import { TRACK_BANK } from '../../data/tracks';
import { createPlayerRider, generateAIRiders } from './RiderFactory';
import { resetProgression } from '../Progression';
import type { RNG } from '../RNG';

function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createSeason(team: string, pilot: PilotArchetype, brand: Brand, rng: RNG): SeasonState {
  resetProgression();
  const playerRider = createPlayerRider(team, pilot, brand);
  const aiRiders = generateAIRiders(pilot.id, brand.id, rng);
  const calendar: Track[] = shuffle(TRACK_BANK, rng).slice(0, SEASON_RACE_COUNT);
  return { playerRider, aiRiders, calendar, currentRaceIndex: 0, raceResults: [], isSeasonComplete: false };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- factories`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/factories/RiderFactory.ts src/core/factories/SeasonFactory.ts tests/factories.test.ts
git commit -m "feat(v2): factories build riders from pilot+brand and assemble a season"
```

---

### Task 11: Balance harness + tune

**Files:**
- Modify (replace contents): `tests/balance.test.ts`
- Modify (if harness fails): `src/core/constants.ts`

- [ ] **Step 1: Replace `tests/balance.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace } from '../src/core/RaceSimulator';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { applyProgression, investBikePoint } from '../src/core/Progression';
import { dominantSetup } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import { TARGET_BUILD_RATE, MAX_BUILD_RATE_SPREAD } from '../src/core/constants';
import type { PilotArchetype, Brand, Track, Risk, BikeParams } from '../src/core/types';

const PACE: { pilot: PilotArchetype; brand: Brand } = {
  pilot: { id: 'p', name: 'Pace', nickname: '', skills: { pace: 9, cornering: 5, consistency: 5 } },
  brand: { id: 'velocita', name: 'Velocita', params: { speed: 9, handling: 5, acceleration: 6 } },
};
const CORNER: { pilot: PilotArchetype; brand: Brand } = {
  pilot: { id: 'c', name: 'Corner', nickname: '', skills: { pace: 5, cornering: 9, consistency: 6 } },
  brand: { id: 'apex', name: 'Apex', params: { speed: 6, handling: 9, acceleration: 6 } },
};
const BAL: { pilot: PilotArchetype; brand: Brand } = {
  pilot: { id: 'b', name: 'Bal', nickname: '', skills: { pace: 7, cornering: 7, consistency: 6 } },
  brand: { id: 'titan', name: 'Titan', params: { speed: 7, handling: 7, acceleration: 7 } },
};

// Reasonable player policy: setup = track's dominant axis; risk by track + consistency; invest R&D in the weakest bike param.
function policyRisk(track: Track, consistency: number): Risk {
  if (track.weights.cornering >= 0.5 && consistency < 7) return 'medium';
  if (track.weights.speed >= 0.4 || consistency >= 7) return 'high';
  return 'medium';
}

function playSeason(build: { pilot: PilotArchetype; brand: Brand }, seed: number, riskFn = policyRisk): boolean {
  const rng = new RNG(seed);
  const season = createSeason('Me', build.pilot, build.brand, rng);
  while (!season.isSeasonComplete) {
    const track = season.calendar[season.currentRaceIndex];
    const p = season.playerRider;
    // Invest accumulated R&D into the weakest bike param before racing.
    while (p.rndPoints > 0) {
      const weakest = (['speed', 'handling', 'acceleration'] as (keyof BikeParams)[])
        .sort((a, b) => p.bike[a] - p.bike[b])[0];
      if (!investBikePoint(p, weakest)) break;
    }
    const result = simulateRace(season, dominantSetup(track), riskFn(track, p.skills.consistency), rng);
    applyProgression([p, ...season.aiRiders], result);
    applyRaceResult(season, result);
  }
  return getChampion(season).id === 'player';
}

function rate(build: { pilot: PilotArchetype; brand: Brand }, n = 1000, riskFn = policyRisk): number {
  let wins = 0;
  for (let i = 0; i < n; i++) if (playSeason(build, i, riskFn)) wins++;
  return wins / n;
}

describe('balance harness', () => {
  it('the three reference builds are co-equal within target', () => {
    const pace = rate(PACE), corner = rate(CORNER), bal = rate(BAL);
    console.log(`pace ${(pace * 100).toFixed(1)}%  corner ${(corner * 100).toFixed(1)}%  balanced ${(bal * 100).toFixed(1)}%`);
    for (const r of [pace, corner, bal]) {
      expect(r).toBeGreaterThanOrEqual(TARGET_BUILD_RATE[0]);
      expect(r).toBeLessThanOrEqual(TARGET_BUILD_RATE[1]);
    }
    const spread = Math.max(pace, corner, bal) - Math.min(pace, corner, bal);
    console.log(`spread ${(spread * 100).toFixed(1)} pts`);
    expect(spread).toBeLessThanOrEqual(MAX_BUILD_RATE_SPREAD);
  });

  it('reading risk beats always-high for the cornering build', () => {
    const adaptive = rate(CORNER, 600);
    const alwaysHigh = rate(CORNER, 600, () => 'high');
    console.log(`corner adaptive ${(adaptive * 100).toFixed(1)}% vs always-high ${(alwaysHigh * 100).toFixed(1)}%`);
    expect(adaptive - alwaysHigh).toBeGreaterThanOrEqual(0.04);
  });
});
```

- [ ] **Step 2: Run the harness**

Run: `npm test -- balance`
Expected: prints the three rates + spread; may FAIL if outside targets.

- [ ] **Step 3: Tune constants if the harness fails**

Adjust ONLY `src/core/constants.ts` (never logic), re-running `npm test -- balance` after each change:
- If one build dominates: the conserved track weighting should keep specialists even — check the calendar gives fast and technical tracks comparable presence. If pace > cornering, nudge a track's weights or `STAT_SCALE`/`NOISE_STD_DEV`.
- If all rates too high (player too strong): the AI uses the same rosters, so strengthen AI evolution is automatic — instead raise `NOISE_STD_DEV` (more upsets) or lower `STAT_SCALE` (stats matter less vs noise).
- If "risk matters" margin < 4 pts: increase `BASE_CRASH.high` and/or `CRASH_TECH_FACTOR` so blind aggression on technical tracks is punished.
- Iterate until both tests pass with comfortable margins.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add tests/balance.test.ts src/core/constants.ts
git commit -m "test(v2): co-equal + risk-matters balance harness; tune constants"
```

---

### Task 12: Reusable Card UI + Phaser config

**Files:**
- Create: `src/ui/Card.ts`
- Modify: `src/config.ts` (scene list unchanged — verify it still imports the three scenes)

- [ ] **Step 1: Write `src/ui/Card.ts`**

```typescript
import Phaser from 'phaser';

export interface StatRow { label: string; value: number; }

export interface CardOptions {
  x: number; y: number; width: number; height: number;
  title: string; subtitle?: string; stats: StatRow[];
  onClick?: () => void;
}

export class Card extends Phaser.GameObjects.Container {
  private box: Phaser.GameObjects.Rectangle;
  private selected = false;

  constructor(scene: Phaser.Scene, opts: CardOptions) {
    super(scene, opts.x, opts.y);
    this.box = scene.add.rectangle(0, 0, opts.width, opts.height, 0x16213e).setStrokeStyle(2, 0x0f3460);
    this.add(this.box);
    this.add(scene.add.text(-opts.width / 2 + 12, -opts.height / 2 + 10, opts.title, { fontSize: '18px', color: '#ffffff' }));
    if (opts.subtitle) {
      this.add(scene.add.text(-opts.width / 2 + 12, -opts.height / 2 + 34, opts.subtitle, { fontSize: '13px', color: '#94a3b8' }));
    }
    opts.stats.forEach((s, i) => {
      const ry = -opts.height / 2 + 60 + i * 22;
      this.add(scene.add.text(-opts.width / 2 + 12, ry, s.label, { fontSize: '13px', color: '#e0e0e0' }));
      this.add(scene.add.text(opts.width / 2 - 28, ry, String(s.value), { fontSize: '13px', color: '#f5c518' }));
    });
    this.setSize(opts.width, opts.height);
    if (opts.onClick) {
      this.box.setInteractive({ useHandCursor: true });
      this.box.on('pointerover', () => { if (!this.selected) this.box.setStrokeStyle(2, 0xe94560); });
      this.box.on('pointerout', () => this.setSelected(this.selected));
      this.box.on('pointerup', opts.onClick);
    }
    scene.add.existing(this);
  }

  setSelected(value: boolean): this {
    this.selected = value;
    this.box.setStrokeStyle(value ? 3 : 2, value ? 0xf5c518 : 0x0f3460);
    this.box.setFillStyle(value ? 0x0f3460 : 0x16213e);
    return this;
  }
}
```

- [ ] **Step 2: Verify config still references the three scenes**

Run: `cat src/config.ts | grep -E "MainMenuScene|SeasonScene|RaceResultScene" | wc -l`
Expected: `3` (no change needed — scenes are rewritten in place in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/ui/Card.ts
git commit -m "feat(v2): reusable selectable Card UI component"
```

---

### Task 13: MainMenuScene — team + pilot + brand selection

**Files:**
- Modify (replace contents): `src/scenes/MainMenuScene.ts`

> Scenes are verified by build + the headless probe, not unit tests.

- [ ] **Step 1: Replace `src/scenes/MainMenuScene.ts`**

```typescript
import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { createSeason } from '../core/factories/SeasonFactory';
import { RNG } from '../core/RNG';
import { PILOT_ROSTER } from '../data/pilots';
import { BRAND_ROSTER } from '../data/brands';
import type { PilotArchetype, Brand } from '../core/types';

export class MainMenuScene extends Phaser.Scene {
  private team = 'My Team';
  private teamText!: Phaser.GameObjects.Text;
  private pilot: PilotArchetype | null = null;
  private brand: Brand | null = null;
  private pilotCards: Card[] = [];
  private brandCards: Card[] = [];
  private startButton!: Button;

  constructor() { super('MainMenuScene'); }

  create(): void {
    this.add.text(512, 40, 'MotoGT', { fontSize: '56px', color: '#f5c518' }).setOrigin(0.5);

    // Team name (native keyboard input).
    this.add.text(330, 96, 'Team:', { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const box = this.add.rectangle(560, 96, 240, 32, 0x0f3460).setStrokeStyle(2, 0x16213e);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => { this.editingTeam = true; });
    this.teamText = this.add.text(450, 96, this.team, { fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));

    this.add.text(80, 140, 'Choose your pilot', { fontSize: '18px', color: '#e0e0e0' });
    PILOT_ROSTER.forEach((p, i) => {
      const card = new Card(this, {
        x: 150 + (i % 3) * 240, y: 230 + Math.floor(i / 3) * 150, width: 220, height: 130,
        title: p.name, subtitle: p.nickname,
        stats: [{ label: 'Pace', value: p.skills.pace }, { label: 'Cornering', value: p.skills.cornering }, { label: 'Consistency', value: p.skills.consistency }],
        onClick: () => { this.pilot = p; this.pilotCards.forEach((c, j) => c.setSelected(j === i)); this.refresh(); },
      });
      this.pilotCards.push(card);
    });

    this.add.text(80, 540, 'Choose your bike', { fontSize: '18px', color: '#e0e0e0' });
    BRAND_ROSTER.forEach((b, i) => {
      const card = new Card(this, {
        x: 150 + i * 230, y: 630, width: 210, height: 120,
        title: b.name,
        stats: [{ label: 'Speed', value: b.params.speed }, { label: 'Handling', value: b.params.handling }, { label: 'Acceleration', value: b.params.acceleration }],
        onClick: () => { this.brand = b; this.brandCards.forEach((c, j) => c.setSelected(j === i)); this.refresh(); },
      });
      this.brandCards.push(card);
    });

    this.startButton = new Button(this, { x: 870, y: 700, width: 240, height: 56, label: 'START SEASON', onClick: () => this.start() });
    this.refresh();
  }

  private editingTeam = false;
  private onKey(e: KeyboardEvent): void {
    if (!this.editingTeam) return;
    if (e.key === 'Backspace') this.team = this.team.slice(0, -1);
    else if (e.key === 'Enter') this.editingTeam = false;
    else if (e.key.length === 1 && /[A-Za-z0-9 \-]/.test(e.key) && this.team.length < 20) this.team += e.key;
    else return;
    this.teamText.setText(this.team);
    this.refresh();
  }

  private refresh(): void {
    this.startButton.setEnabled(this.team.trim().length > 0 && this.pilot !== null && this.brand !== null);
  }

  private start(): void {
    if (!this.pilot || !this.brand) return;
    const season = createSeason(this.team.trim(), this.pilot, this.brand, new RNG(Date.now() >>> 0));
    this.scene.start('SeasonScene', { season });
  }
}
```

- [ ] **Step 2: Commit (app not runnable until Tasks 14–15 land)**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(v2): selection screen with pilot and brand cards"
```

---

### Task 14: SeasonScene — R&D + setup/risk + simulate

**Files:**
- Modify (replace contents): `src/scenes/SeasonScene.ts`
- Modify: `src/ui/StandingsTable.ts` (works with new Rider — verify `name`/`points` still used)

- [ ] **Step 1: Verify `StandingsTable.ts` is compatible**

Run: `cat src/ui/StandingsTable.ts | grep -E "\.stats|\.skills" || echo "compatible"`
Expected: `compatible` (it only reads `name`, `points`, `isPlayer`). If it references removed fields, update those lines to use `rider.points` / `rider.name` only.

- [ ] **Step 2: Replace `src/scenes/SeasonScene.ts`**

```typescript
import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { simulateRace } from '../core/RaceSimulator';
import { applyRaceResult, getStandings } from '../core/Championship';
import { applyProgression, investBikePoint } from '../core/Progression';
import { RNG } from '../core/RNG';
import { SETUPS, RISKS } from '../core/constants';
import type { SeasonState, Setup, Risk, BikeParams } from '../core/types';

const SETUP_LABEL: Record<Setup, string> = { topSpeed: 'Top Speed', handling: 'Handling', acceleration: 'Acceleration' };
const RISK_LABEL: Record<Risk, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export class SeasonScene extends Phaser.Scene {
  private season!: SeasonState;
  private setup: Setup = 'handling';
  private risk: Risk = 'medium';
  private setupBoxes: Record<Setup, Phaser.GameObjects.Rectangle> = {} as never;
  private riskBoxes: Record<Risk, Phaser.GameObjects.Rectangle> = {} as never;
  private bikeText!: Phaser.GameObjects.Text;
  private rndText!: Phaser.GameObjects.Text;

  constructor() { super('SeasonScene'); }
  init(data: { season: SeasonState }): void { this.season = data.season; }

  create(): void {
    const idx = this.season.currentRaceIndex;
    const track = this.season.calendar[idx];
    this.add.text(40, 24, `Race ${idx + 1} of ${this.season.calendar.length} — ${track.name}`, { fontSize: '24px', color: '#f5c518' });
    this.add.text(40, 60, `Track focus  Speed ${track.weights.speed.toFixed(2)}  Cornering ${track.weights.cornering.toFixed(2)}  Accel ${track.weights.acceleration.toFixed(2)}`, { fontSize: '15px', color: '#94a3b8' });

    const s = this.season.playerRider.skills;
    this.add.text(40, 110, `Pilot  Pace ${s.pace}  Cornering ${s.cornering}  Consistency ${s.consistency}`, { fontSize: '16px', color: '#e0e0e0' });
    this.bikeText = this.add.text(40, 140, '', { fontSize: '16px', color: '#e0e0e0' });

    // R&D panel
    this.rndText = this.add.text(40, 180, '', { fontSize: '16px', color: '#f5c518' });
    (['speed', 'handling', 'acceleration'] as (keyof BikeParams)[]).forEach((param, i) => {
      const x = 40 + i * 150;
      const plus = this.add.text(x, 210, `+${param}`, { fontSize: '15px', color: '#00c853' }).setInteractive({ useHandCursor: true });
      plus.on('pointerup', () => { if (investBikePoint(this.season.playerRider, param)) this.refreshBike(); });
    });
    this.refreshBike();

    // Setup selector
    this.add.text(40, 270, 'Setup', { fontSize: '18px', color: '#e0e0e0' });
    SETUPS.forEach((st, i) => {
      const box = this.add.rectangle(120 + i * 200, 310, 180, 34, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(120 + i * 200, 310, SETUP_LABEL[st], { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.setup = st; this.refreshSelectors(); });
      this.setupBoxes[st] = box;
    });

    // Risk selector
    this.add.text(40, 360, 'Risk', { fontSize: '18px', color: '#e0e0e0' });
    RISKS.forEach((rk, i) => {
      const box = this.add.rectangle(120 + i * 200, 400, 180, 34, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(120 + i * 200, 400, RISK_LABEL[rk], { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.risk = rk; this.refreshSelectors(); });
      this.riskBoxes[rk] = box;
    });
    this.refreshSelectors();

    this.add.text(720, 90, 'Standings', { fontSize: '20px', color: '#f5c518' });
    renderStandings(this, 720, 120, getStandings(this.season));

    new Button(this, { x: 320, y: 700, width: 280, height: 56, label: 'SIMULATE RACE', onClick: () => this.simulate() });
  }

  private refreshBike(): void {
    const b = this.season.playerRider.bike;
    this.bikeText.setText(`Bike   Speed ${b.speed}  Handling ${b.handling}  Acceleration ${b.acceleration}`);
    this.rndText.setText(`Development points: ${this.season.playerRider.rndPoints}`);
  }

  private refreshSelectors(): void {
    SETUPS.forEach((st) => this.setupBoxes[st].setFillStyle(st === this.setup ? 0x0f3460 : 0x16213e).setStrokeStyle(2, st === this.setup ? 0xf5c518 : 0x0f3460));
    RISKS.forEach((rk) => this.riskBoxes[rk].setFillStyle(rk === this.risk ? 0x0f3460 : 0x16213e).setStrokeStyle(2, rk === this.risk ? 0xf5c518 : 0x0f3460));
  }

  private simulate(): void {
    const rng = new RNG((Date.now() ^ (this.season.currentRaceIndex * 2654435761)) >>> 0);
    const result = simulateRace(this.season, this.setup, this.risk, rng);
    const summaries = applyProgression([this.season.playerRider, ...this.season.aiRiders], result);
    applyRaceResult(this.season, result);
    const playerSummary = summaries.find((s) => s.riderId === 'player')!;
    this.scene.start('RaceResultScene', { season: this.season, result, playerSummary });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/SeasonScene.ts
git commit -m "feat(v2): season hub with R&D investment and setup/risk decisions"
```

---

### Task 15: RaceResultScene — order + progression + season end

**Files:**
- Modify (replace contents): `src/scenes/RaceResultScene.ts`

- [ ] **Step 1: Replace `src/scenes/RaceResultScene.ts`**

```typescript
import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { getStandings, getChampion } from '../core/Championship';
import type { SeasonState, RaceResult } from '../core/types';
import type { ProgressionSummary } from '../core/Progression';

const SETUP_SHORT: Record<string, string> = { topSpeed: 'TS', handling: 'HN', acceleration: 'AC' };
const RISK_SHORT: Record<string, string> = { low: 'L', medium: 'M', high: 'H' };

export class RaceResultScene extends Phaser.Scene {
  private season!: SeasonState;
  private result!: RaceResult;
  private playerSummary!: ProgressionSummary;

  constructor() { super('RaceResultScene'); }
  init(data: { season: SeasonState; result: RaceResult; playerSummary: ProgressionSummary }): void {
    this.season = data.season; this.result = data.result; this.playerSummary = data.playerSummary;
  }

  create(): void {
    if (this.season.isSeasonComplete) { this.renderSeasonEnd(); return; }

    this.add.text(40, 24, `Results — ${this.result.track.name}`, { fontSize: '24px', color: '#f5c518' });
    const lines = this.result.finishingOrder.map((e) => {
      const tag = e.rider.isPlayer ? '>' : ' ';
      const crash = e.crashed ? ' !' : '  ';
      return `${tag}${String(e.position).padStart(2)}. ${e.rider.name.padEnd(16)} ${SETUP_SHORT[e.setup]}/${RISK_SHORT[e.risk]} ${String(e.pointsAwarded).padStart(3)}${crash}`;
    });
    this.add.text(40, 80, lines.join('\n'), { fontFamily: 'monospace', fontSize: '15px', color: '#e0e0e0' });

    const levels = this.playerSummary.pilotLevels;
    const msg = levels.length ? `Pilot improved: ${levels.map((l) => `+1 ${l}`).join(', ')}.  ` : '';
    this.add.text(40, 360, `${msg}Earned ${this.playerSummary.rndEarned} development points.`, { fontSize: '16px', color: '#00c853' });

    this.add.text(620, 60, 'Standings', { fontSize: '20px', color: '#f5c518' });
    renderStandings(this, 620, 90, getStandings(this.season));

    new Button(this, { x: 512, y: 700, width: 280, height: 56, label: 'NEXT RACE', onClick: () => this.scene.start('SeasonScene', { season: this.season }) });
  }

  private renderSeasonEnd(): void {
    const standings = getStandings(this.season);
    const champ = getChampion(this.season);
    this.add.text(512, 70, 'SEASON COMPLETE', { fontSize: '40px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(512, 130, `Champion: ${champ.name} (${champ.team}) — ${champ.points} pts`, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const pos = standings.findIndex((r) => r.isPlayer) + 1;
    const p = this.season.playerRider;
    this.add.text(512, 175, `You finished P${pos} — ${p.points} pts | Wins ${p.positionCounts[0]} | Podiums ${p.positionCounts[0] + p.positionCounts[1] + p.positionCounts[2]}`, { fontSize: '17px', color: '#e0e0e0' }).setOrigin(0.5);
    renderStandings(this, 380, 230, standings);
    new Button(this, { x: 512, y: 700, width: 280, height: 56, label: 'PLAY AGAIN', onClick: () => this.scene.start('MainMenuScene') });
  }
}
```

- [ ] **Step 2: Compile and build**

Run: `npx tsc --noEmit && echo OK`
Expected: `OK` (all scenes now compile together).

Run: `npm run build 2>&1 | grep -E "built in|error"`
Expected: `built in ...`, no `error`.

- [ ] **Step 3: Play-verify with the dev server + probe**

Run (background): `npm run dev`
Then run the headless probe to confirm START → selection works end-to-end (adapt `tools/uiprobe.mjs` to click a pilot card, a brand card, then START, asserting the scene becomes `SeasonScene`). Confirm no page errors and a full season can be simulated.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/RaceResultScene.ts
git commit -m "feat(v2): race result + progression display + season-end screen"
```

---

### Task 16: Full-season integration test

**Files:**
- Modify (replace contents): `tests/integration.test.ts`

- [ ] **Step 1: Replace `tests/integration.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { simulateRace } from '../src/core/RaceSimulator';
import { applyRaceResult, getChampion } from '../src/core/Championship';
import { applyProgression, resetProgression } from '../src/core/Progression';
import { dominantSetup } from '../src/core/AIDecision';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { SEASON_RACE_COUNT } from '../src/core/constants';

beforeEach(resetProgression);

describe('full season integration', () => {
  it('completes 6 races, applies progression, and crowns a champion', () => {
    const rng = new RNG(2026);
    const season = createSeason('Me', PILOT_ROSTER[3], BRAND_ROSTER[2], rng);
    const startPace = season.playerRider.skills.pace + season.playerRider.skills.cornering + season.playerRider.skills.consistency;
    let races = 0;
    while (!season.isSeasonComplete) {
      const track = season.calendar[season.currentRaceIndex];
      const result = simulateRace(season, dominantSetup(track), 'medium', rng);
      applyProgression([season.playerRider, ...season.aiRiders], result);
      applyRaceResult(season, result);
      races++;
    }
    expect(races).toBe(SEASON_RACE_COUNT);
    expect(season.raceResults).toHaveLength(SEASON_RACE_COUNT);
    expect(getChampion(season)).toBeDefined();
    // Progression happened: player skills grew over the season.
    const endPace = season.playerRider.skills.pace + season.playerRider.skills.cornering + season.playerRider.skills.consistency;
    expect(endPace).toBeGreaterThan(startPace);
    // Points conserved: 101 per race.
    const total = [season.playerRider, ...season.aiRiders].reduce((a, r) => a + r.points, 0);
    expect(total).toBe(101 * SEASON_RACE_COUNT);
  });

  it('throws if simulating past the calendar', () => {
    const rng = new RNG(1);
    const season = createSeason('Me', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
    while (!season.isSeasonComplete) {
      const r = simulateRace(season, 'handling', 'low', rng);
      applyProgression([season.playerRider, ...season.aiRiders], r);
      applyRaceResult(season, r);
    }
    expect(() => simulateRace(season, 'handling', 'low', rng)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and full suite**

Run: `npm test -- integration`
Expected: PASS (2 tests).

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test(v2): full-season integration with progression"
```

---

## Self-Review Notes (planner — already checked)

- **Spec coverage:** types (T1), constants (T2), rosters/tracks (T3), axes+setup (T4 §2/§4.1), crash model (T5 §4.3), AI setup/risk (T6 §4.5), simulator (T7 §4.4), standings/countback (T8 §6), progression pilot+bike+AI (T9 §5), factories/selection data (T10 §3), balance harness co-equal + risk-matters (T11 §9), Card UI (T12), selection screen (T13 §8.1), hub R&D + setup/risk (T14 §8.2), result + progression + season end (T15 §8.3), integration (T16). Phase B (§12) intentionally not built.
- **Type consistency:** `simulateRace(season, setup, risk, rng)`, `applyProgression(riders, result): ProgressionSummary[]`, `investBikePoint(rider, param): boolean`, `createSeason(team, pilot, brand, rng)`, `createPlayerRider(team, pilot, brand)`, `generateAIRiders(playerPilotId, playerBrandId, rng)`, `getStandings/getChampion(season)`, `baseAxes/applySetup/weightedBase`, `crashProbability(risk, consistency, track)` — consistent across tasks.
- **Progression module state:** `cumulativeEmphasis` is reset via `resetProgression()`, called in `createSeason` (T10) and `beforeEach` of progression/factory/integration tests. Flagged in T9.
- **Sequencing:** core (T1–T11) is independently testable; the app first compiles/runs after T15 (config imports all three scenes), flagged in T13/T15.
```
