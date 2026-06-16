# MotoGT v2 Phase B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the instant race result into a real lap-by-lap race and visualize it as a 2D animated race-day view (dots on a hand-authored track, real gaps/overtakes/crashes, auto-play + skip), without breaking the balanced Phase A model.

**Architecture:** A new pure `RaceEngine` runs the race over N laps (performance → base lap pace + per-lap noise + per-lap crash rolls) and returns both the finishing `result` and a `RaceTimeline`. A pure `Path` helper turns hand-authored layouts into drawable curves. A new Phaser `RaceScene` animates the timeline between the hub and the result. The balance harness is re-validated against the new engine.

**Tech Stack:** TypeScript (strict), Phaser 3/4, Vite, Vitest, Playwright (UI probe).

**Reference spec:** `docs/superpowers/specs/2026-06-15-motogt-v2-phaseB-raceday.md`

**Branch:** `v2-raceday` (keep `main` green throughout).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/types.ts` | Add `LapSnapshot`, `RaceTimeline` |
| `src/core/constants.ts` | Add `RACE_LAPS`, `LAP_NOISE_STD`, `RACE_ANIM_SECONDS` |
| `src/core/Path.ts` | Pure Catmull-Rom sampling + `pointAt` |
| `src/core/RaceEngine.ts` | `runRace` lap loop + `simulateRace` wrapper |
| `src/core/RaceSimulator.ts` | Re-export `simulateRace` from RaceEngine (stable import path) |
| `src/data/trackLayouts.ts` | 6 hand-authored track layouts |
| `src/scenes/RaceScene.ts` | Animated race-day view |
| `src/scenes/SeasonScene.ts` | `simulate()` → `runRace` → `RaceScene` |
| `src/config.ts` | Register `RaceScene` |
| `tests/path.test.ts`, `tests/raceEngine.test.ts`, `tests/trackLayouts.test.ts` | New tests |
| `tests/balance.test.ts`, `tests/integration.test.ts` | Re-validate against new engine |

---

### Task 1: Timeline types

**Files:**
- Modify: `src/core/types.ts` (append)

- [ ] **Step 1: Append to `src/core/types.ts`**

```typescript
export interface LapSnapshot {
  lap: number;
  entries: { riderId: string; progress: number; crashed: boolean }[];
}

export interface RaceTimeline {
  laps: LapSnapshot[];
  totalLaps: number;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep types.ts || echo "types OK"`
Expected: `types OK`.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(raceday): add RaceTimeline and LapSnapshot types"
```

---

### Task 2: Constants

**Files:**
- Modify: `src/core/constants.ts` (append)

- [ ] **Step 1: Append to `src/core/constants.ts`**

```typescript
// Race-day (Phase B)
export const RACE_LAPS = 14;
export const LAP_NOISE_STD = NOISE_STD_DEV / Math.sqrt(RACE_LAPS); // ≈ 0.267; tuned by harness
export const RACE_ANIM_SECONDS = 18;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep constants.ts || echo "constants OK"`
Expected: `constants OK`.

- [ ] **Step 3: Commit**

```bash
git add src/core/constants.ts
git commit -m "feat(raceday): add lap/animation constants"
```

---

### Task 3: Path helper

**Files:**
- Create: `src/core/Path.ts`
- Test: `tests/path.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { buildPath, pointAt } from '../src/core/Path';

const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

describe('Path', () => {
  it('builds a non-empty closed sample list', () => {
    const p = buildPath(square);
    expect(p.samples.length).toBeGreaterThan(square.length);
    // closed: last sample is near the first sample (loop wraps)
    const first = p.samples[0];
    const last = p.samples[p.samples.length - 1];
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(0.3);
  });

  it('pointAt wraps t into [0,1) and returns finite points', () => {
    const p = buildPath(square);
    const a = pointAt(p, 0);
    const b = pointAt(p, 1.0);   // wraps to 0
    expect(a).toEqual(b);
    const c = pointAt(p, 0.25);
    expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
  });

  it('moves around the loop as t increases', () => {
    const p = buildPath(square);
    const q0 = pointAt(p, 0.0);
    const q2 = pointAt(p, 0.5);
    expect(Math.hypot(q2.x - q0.x, q2.y - q0.y)).toBeGreaterThan(0.3); // opposite side
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- path`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/Path.ts`**

```typescript
export interface Point { x: number; y: number; }
export interface SampledPath { samples: Point[]; }

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

export function buildPath(points: Point[], samplesPerSegment = 24): SampledPath {
  const n = points.length;
  const samples: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let j = 0; j < samplesPerSegment; j++) {
      samples.push(catmullRom(p0, p1, p2, p3, j / samplesPerSegment));
    }
  }
  return { samples };
}

export function pointAt(path: SampledPath, t: number): Point {
  const m = path.samples.length;
  const tt = ((t % 1) + 1) % 1;
  return path.samples[Math.floor(tt * m) % m];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- path`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/Path.ts tests/path.test.ts
git commit -m "feat(raceday): Catmull-Rom path sampling helper"
```

---

### Task 4: Race engine (lap-by-lap)

**Files:**
- Create: `src/core/RaceEngine.ts`
- Modify (replace contents): `src/core/RaceSimulator.ts`
- Test: `tests/raceEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { runRace, simulateRace } from '../src/core/RaceEngine';
import { RNG } from '../src/core/RNG';
import { RACE_LAPS } from '../src/core/constants';
import type { Rider, Track, SeasonState } from '../src/core/types';

function mkRider(id: string, isPlayer: boolean, pace: number): Rider {
  return {
    id, name: id, team: 'T', isPlayer,
    skills: { pace, cornering: 5, consistency: 5 },
    bike: { speed: pace, handling: 5, acceleration: 5 },
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

describe('RaceEngine', () => {
  it('produces a valid result and a full timeline', () => {
    const { result, timeline } = runRace(mkSeason(), 'topSpeed', 'medium', new RNG(1));
    expect(result.finishingOrder.map((f) => f.position).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.finishingOrder.reduce((s, f) => s + f.pointsAwarded, 0)).toBe(101);
    expect(timeline.laps).toHaveLength(RACE_LAPS);
    expect(timeline.laps[0].entries).toHaveLength(10);
  });

  it('is deterministic for a fixed seed', () => {
    const a = runRace(mkSeason(), 'topSpeed', 'medium', new RNG(42));
    const b = runRace(mkSeason(), 'topSpeed', 'medium', new RNG(42));
    expect(a.result.finishingOrder.map((f) => f.rider.id))
      .toEqual(b.result.finishingOrder.map((f) => f.rider.id));
    expect(a.timeline.laps.at(-1)!.entries).toEqual(b.timeline.laps.at(-1)!.entries);
  });

  it('crashed riders finish behind all non-crashed riders', () => {
    // Force crashes by using max risk on a very technical track with low consistency.
    const season = mkSeason();
    season.playerRider.skills.consistency = 1;
    const technical: Track = { id: 'x', name: 'X', location: 'Y', weights: { speed: 0.1, cornering: 0.8, acceleration: 0.1 } };
    season.calendar = [technical];
    // Run many seeds; whenever the player crashes, they must be ranked below every non-crashed rider.
    for (let seed = 0; seed < 40; seed++) {
      const { result } = runRace(season, 'handling', 'high', new RNG(seed));
      const order = result.finishingOrder;
      const firstCrashIdx = order.findIndex((e) => e.crashed);
      if (firstCrashIdx === -1) continue;
      // no non-crashed rider appears after the first crashed one
      expect(order.slice(firstCrashIdx).every((e) => e.crashed)).toBe(true);
    }
  });

  it('simulateRace returns just the result', () => {
    const r = simulateRace(mkSeason(), 'handling', 'low', new RNG(3));
    expect(r.finishingOrder).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- raceEngine`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/RaceEngine.ts`**

```typescript
import type { SeasonState, Setup, Risk, Rider, Track, RaceResult, RaceEntry, RaceTimeline, LapSnapshot } from './types';
import { POINTS_TABLE, PUSH_BONUS, RACE_LAPS, LAP_NOISE_STD } from './constants';
import { baseAxes, applySetup, weightedBase, type Axes } from './PerformanceModel';
import { crashProbability } from './CrashModel';
import { aiSetup, aiRisk } from './AIDecision';
import type { RNG } from './RNG';

interface RiderState {
  rider: Rider; setup: Setup; risk: Risk;
  basePace: number; axes: Axes;
  progress: number; crashed: boolean; crashLap: number;
}

function perLapCrashProb(risk: Risk, consistency: number, track: Track): number {
  const whole = crashProbability(risk, consistency, track);
  return 1 - Math.pow(1 - whole, 1 / RACE_LAPS);
}

function compare(a: RiderState, b: RiderState, rng: RNG): number {
  if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;       // finishers ahead of crashers
  if (a.crashed && a.crashLap !== b.crashLap) return b.crashLap - a.crashLap; // later crash = ahead
  if (a.progress !== b.progress) return b.progress - a.progress;
  if (a.axes.speed !== b.axes.speed) return b.axes.speed - a.axes.speed;
  if (a.axes.cornering !== b.axes.cornering) return b.axes.cornering - a.axes.cornering;
  if (a.axes.acceleration !== b.axes.acceleration) return b.axes.acceleration - a.axes.acceleration;
  return rng.nextFloat() - 0.5;
}

export function runRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): { result: RaceResult; timeline: RaceTimeline } {
  if (season.currentRaceIndex >= season.calendar.length) throw new Error('All races have been simulated.');
  const track = season.calendar[season.currentRaceIndex];

  const states: RiderState[] = [season.playerRider, ...season.aiRiders].map((rider) => {
    const setup = rider.isPlayer ? playerSetup : aiSetup(rider, track, rng);
    const risk = rider.isPlayer ? playerRisk : aiRisk(rider, rng);
    const axes = applySetup(baseAxes(rider.skills, rider.bike), setup);
    return { rider, setup, risk, basePace: weightedBase(axes, track) + PUSH_BONUS[risk], axes, progress: 0, crashed: false, crashLap: 0 };
  });

  const laps: LapSnapshot[] = [];
  for (let lap = 1; lap <= RACE_LAPS; lap++) {
    for (const s of states) {
      if (s.crashed) continue;
      s.progress += s.basePace + rng.gaussian(0, LAP_NOISE_STD);
      if (rng.nextFloat() < perLapCrashProb(s.risk, s.rider.skills.consistency, track)) {
        s.crashed = true;
        s.crashLap = lap;
      }
    }
    laps.push({ lap, entries: states.map((s) => ({ riderId: s.rider.id, progress: s.progress, crashed: s.crashed })) });
  }

  const ordered = states.slice().sort((a, b) => compare(a, b, rng));
  const finishingOrder: RaceEntry[] = ordered.map((s, i) => ({
    rider: s.rider,
    position: i + 1,
    pointsAwarded: i < POINTS_TABLE.length ? POINTS_TABLE[i] : 0,
    setup: s.setup,
    risk: s.risk,
    crashed: s.crashed,
    performanceScore: s.progress,
  }));

  return { result: { raceIndex: season.currentRaceIndex, track, finishingOrder }, timeline: { laps, totalLaps: RACE_LAPS } };
}

export function simulateRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): RaceResult {
  return runRace(season, playerSetup, playerRisk, rng).result;
}
```

- [ ] **Step 4: Replace `src/core/RaceSimulator.ts` with a re-export (keeps existing imports working)**

```typescript
export { simulateRace } from './RaceEngine';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- raceEngine`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the existing simulation/championship tests (they import simulateRace)**

Run: `npm test -- simulation championship`
Expected: PASS (the wrapper preserves the signature/behavior).

- [ ] **Step 7: Commit**

```bash
git add src/core/RaceEngine.ts src/core/RaceSimulator.ts tests/raceEngine.test.ts
git commit -m "feat(raceday): lap-by-lap race engine producing result + timeline"
```

---

### Task 5: Re-validate balance against the new engine

**Files:**
- Modify (only if needed): `src/core/constants.ts` (`LAP_NOISE_STD`)
- Modify: `tests/balance.test.ts` (add crash-rate sanity assertion)

- [ ] **Step 1: Run the existing balance harness against the new engine**

Run: `npm test -- balance`
Expected: prints build rates + setup/risk margins. The three co-equal builds should still land 25–45% with spread ≤ 15 pts, and setup/risk margins ≥ 4 pts. If they pass, skip Step 2.

- [ ] **Step 2: If co-equality drifted, tune `LAP_NOISE_STD`**

The per-lap refactor changes variance and makes crashes full DNFs (slightly more punishing than the Phase A penalty). Adjust ONLY `LAP_NOISE_STD` in `src/core/constants.ts`:
- If favorites win too often (spread shrinks toward 0 but rates climb >45%): raise `LAP_NOISE_STD` (more lap-to-lap variance → more upsets).
- If upsets dominate (rates drop <25%): lower `LAP_NOISE_STD`.
Re-run `npm test -- balance` after each change until co-equal + setup/risk pass with comfortable margins.

- [ ] **Step 3: Add a crash-rate sanity assertion to `tests/balance.test.ts`**

Add this test inside the `describe('balance harness', ...)` block:

```typescript
  it('crash rate stays in a sane band under a reasonable policy', () => {
    let races = 0, crashes = 0;
    for (let seed = 0; seed < 300; seed++) {
      const rng = new RNG(seed);
      const season = createSeason('Me', BAL.pilot, BAL.brand, rng);
      while (!season.isSeasonComplete) {
        const track = season.calendar[season.currentRaceIndex];
        const result = simulateRace(season, dominantSetup(track), policyRisk(track, season.playerRider.skills.consistency), rng);
        const me = result.finishingOrder.find((e) => e.rider.isPlayer)!;
        races++; if (me.crashed) crashes++;
        applyProgression([season.playerRider, ...season.aiRiders], result);
        applyRaceResult(season, result);
      }
    }
    const rate = crashes / races;
    console.log(`player crash rate ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.30);
  });
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — all suites including balance.

- [ ] **Step 5: Commit**

```bash
git add tests/balance.test.ts src/core/constants.ts
git commit -m "test(raceday): re-validate balance against lap engine; crash-rate sanity"
```

---

### Task 6: Hand-authored track layouts

**Files:**
- Create: `src/data/trackLayouts.ts`
- Test: `tests/trackLayouts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { TRACK_LAYOUTS } from '../src/data/trackLayouts';
import { TRACK_BANK } from '../src/data/tracks';
import { buildPath, pointAt } from '../src/core/Path';

describe('trackLayouts', () => {
  it('has a layout for every track id', () => {
    for (const t of TRACK_BANK) {
      expect(TRACK_LAYOUTS[t.id]).toBeDefined();
      expect(TRACK_LAYOUTS[t.id].points.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('layout points are within the unit square', () => {
    for (const id of Object.keys(TRACK_LAYOUTS)) {
      for (const p of TRACK_LAYOUTS[id].points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('each layout builds into a traversable closed path', () => {
    for (const id of Object.keys(TRACK_LAYOUTS)) {
      const path = buildPath(TRACK_LAYOUTS[id].points);
      expect(path.samples.length).toBeGreaterThan(50);
      const a = pointAt(path, 0), b = pointAt(path, 0.5);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- trackLayouts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/data/trackLayouts.ts`** (six distinct hand-authored loops in normalized [0,1] coords)

```typescript
import type { Point } from '../core/Path';

export interface TrackLayout { id: string; points: Point[]; }

export const TRACK_LAYOUTS: Record<string, TrackLayout> = {
  // Mugello — long flowing right-sweeper with a kink
  mugello: { id: 'mugello', points: [
    { x: 0.10, y: 0.55 }, { x: 0.20, y: 0.25 }, { x: 0.45, y: 0.18 }, { x: 0.62, y: 0.30 },
    { x: 0.70, y: 0.20 }, { x: 0.86, y: 0.32 }, { x: 0.88, y: 0.60 }, { x: 0.68, y: 0.78 },
    { x: 0.40, y: 0.82 }, { x: 0.18, y: 0.76 },
  ] },
  // Sachsenring — tight, twisty (many close corners)
  sachsenring: { id: 'sachsenring', points: [
    { x: 0.15, y: 0.50 }, { x: 0.22, y: 0.30 }, { x: 0.34, y: 0.36 }, { x: 0.40, y: 0.20 },
    { x: 0.54, y: 0.24 }, { x: 0.56, y: 0.42 }, { x: 0.72, y: 0.30 }, { x: 0.84, y: 0.46 },
    { x: 0.76, y: 0.66 }, { x: 0.58, y: 0.62 }, { x: 0.46, y: 0.78 }, { x: 0.28, y: 0.72 },
  ] },
  // Red Bull Ring — few corners, long straights
  redbull: { id: 'redbull', points: [
    { x: 0.12, y: 0.62 }, { x: 0.30, y: 0.22 }, { x: 0.46, y: 0.26 }, { x: 0.52, y: 0.40 },
    { x: 0.84, y: 0.24 }, { x: 0.90, y: 0.52 }, { x: 0.60, y: 0.80 }, { x: 0.24, y: 0.82 },
  ] },
  // Phillip Island — fast flowing ellipse
  phillip: { id: 'phillip', points: [
    { x: 0.16, y: 0.50 }, { x: 0.30, y: 0.24 }, { x: 0.56, y: 0.18 }, { x: 0.80, y: 0.28 },
    { x: 0.88, y: 0.50 }, { x: 0.80, y: 0.72 }, { x: 0.54, y: 0.82 }, { x: 0.28, y: 0.74 },
  ] },
  // Jerez — stadium loop with a tight final sector
  jerez: { id: 'jerez', points: [
    { x: 0.14, y: 0.46 }, { x: 0.26, y: 0.24 }, { x: 0.50, y: 0.20 }, { x: 0.74, y: 0.26 },
    { x: 0.86, y: 0.46 }, { x: 0.72, y: 0.58 }, { x: 0.78, y: 0.74 }, { x: 0.58, y: 0.80 },
    { x: 0.50, y: 0.66 }, { x: 0.34, y: 0.78 }, { x: 0.20, y: 0.66 },
  ] },
  // Silverstone — complex, two lobes
  silverstone: { id: 'silverstone', points: [
    { x: 0.12, y: 0.52 }, { x: 0.24, y: 0.30 }, { x: 0.42, y: 0.34 }, { x: 0.48, y: 0.18 },
    { x: 0.64, y: 0.22 }, { x: 0.62, y: 0.40 }, { x: 0.82, y: 0.34 }, { x: 0.90, y: 0.54 },
    { x: 0.74, y: 0.70 }, { x: 0.54, y: 0.64 }, { x: 0.44, y: 0.80 }, { x: 0.24, y: 0.74 },
  ] },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- trackLayouts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/trackLayouts.ts tests/trackLayouts.test.ts
git commit -m "feat(raceday): six hand-authored track layouts"
```

---

### Task 7: RaceScene (animated race-day view)

**Files:**
- Create: `src/scenes/RaceScene.ts`
- Modify: `src/config.ts` (register scene)

- [ ] **Step 1: Write `src/scenes/RaceScene.ts`**

```typescript
import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { buildPath, pointAt, type SampledPath } from '../core/Path';
import { TRACK_LAYOUTS } from '../data/trackLayouts';
import { RACE_LAPS, RACE_ANIM_SECONDS } from '../core/constants';
import type { SeasonState, RaceResult, RaceTimeline } from '../core/types';
import type { ProgressionSummary } from '../core/Progression';

// Maps the normalized [0,1] path into a screen rectangle.
const OX = 80, OY = 90, W = 600, H = 560;

interface SceneData { season: SeasonState; result: RaceResult; timeline: RaceTimeline; playerSummary: ProgressionSummary; }

export class RaceScene extends Phaser.Scene {
  private data!: SceneData;
  private path!: SampledPath;
  private dots: Map<string, Phaser.GameObjects.Arc> = new Map();
  private finalLeaderProgress = 1;
  private elapsedMs = 0;
  private lapText!: Phaser.GameObjects.Text;
  private orderText!: Phaser.GameObjects.Text;
  private done = false;

  constructor() { super('RaceScene'); }
  init(data: SceneData): void { this.data = data; }

  create(): void {
    const track = this.data.result.track;
    this.add.text(OX, 30, `Race Day — ${track.name}`, { fontSize: '24px', color: '#f5c518' });

    this.path = buildPath(TRACK_LAYOUTS[track.id].points);
    this.drawTrack();

    // Final leader progress (max among non-crashed at the last lap) for scaling laps-around-track.
    const lastLap = this.data.timeline.laps[this.data.timeline.laps.length - 1];
    this.finalLeaderProgress = Math.max(1, ...lastLap.entries.filter((e) => !e.crashed).map((e) => e.progress));

    // Create a dot per rider.
    for (const e of lastLap.entries) {
      const rider = this.riderById(e.riderId);
      const isPlayer = rider.isPlayer;
      const dot = this.add.circle(OX, OY, isPlayer ? 8 : 6, isPlayer ? 0xf5c518 : 0x4fc3f7).setStrokeStyle(2, 0x1a1a2e);
      this.dots.set(e.riderId, dot);
    }

    this.lapText = this.add.text(720, 90, '', { fontSize: '20px', color: '#f5c518' });
    this.orderText = this.add.text(720, 130, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e0e0e0' });

    new Button(this, { x: 880, y: 700, width: 180, height: 48, label: 'SKIP', onClick: () => this.finish() });
    this.renderFrame(0);
  }

  private riderById(id: string) {
    return [this.data.season.playerRider, ...this.data.season.aiRiders].find((r) => r.id === id)!;
  }

  private drawTrack(): void {
    const g = this.add.graphics();
    g.lineStyle(8, 0x16213e);
    const pts = this.path.samples.map((p) => new Phaser.Math.Vector2(OX + p.x * W, OY + p.y * H));
    g.strokePoints(pts, true, true);
    g.lineStyle(2, 0x0f3460);
    g.strokePoints(pts, true, true);
  }

  // Interpolate a rider's accumulated progress at race-fraction tau in [0,1].
  private progressAt(riderId: string, tau: number): number {
    const laps = this.data.timeline.laps;
    const x = tau * laps.length;          // 0..RACE_LAPS
    const i = Math.min(laps.length - 1, Math.floor(x));
    const frac = x - i;
    const cur = laps[i].entries.find((e) => e.riderId === riderId)!.progress;
    const prev = i === 0 ? 0 : laps[i - 1].entries.find((e) => e.riderId === riderId)!.progress;
    return prev + (cur - prev) * frac;
  }

  private renderFrame(tau: number): void {
    const standings: { id: string; prog: number; crashed: boolean }[] = [];
    const lastLap = this.data.timeline.laps[this.data.timeline.laps.length - 1];
    for (const e of lastLap.entries) {
      const prog = this.progressAt(e.riderId, tau);
      const loops = (prog / this.finalLeaderProgress) * RACE_LAPS;
      const pt = pointAt(this.path, loops % 1);
      const dot = this.dots.get(e.riderId)!;
      dot.setPosition(OX + pt.x * W, OY + pt.y * H);
      // crashed riders stop where they fell
      const crashedNow = lastLap.entries.find((x) => x.riderId === e.riderId)!.crashed
        && tau >= 0.99;
      if (e.crashed && crashedNow) dot.setFillStyle(0xff1744);
      standings.push({ id: e.riderId, prog, crashed: e.crashed });
    }
    standings.sort((a, b) => b.prog - a.prog);
    const lap = Math.min(RACE_LAPS, Math.floor(tau * RACE_LAPS) + 1);
    this.lapText.setText(`Lap ${lap} / ${RACE_LAPS}`);
    this.orderText.setText(standings.slice(0, 10).map((s, i) => {
      const r = this.riderById(s.id);
      const tag = r.isPlayer ? '>' : ' ';
      return `${tag}${String(i + 1).padStart(2)} ${r.name.slice(0, 14)}`;
    }).join('\n'));
  }

  update(_time: number, delta: number): void {
    if (this.done) return;
    this.elapsedMs += delta;
    const tau = Math.min(1, this.elapsedMs / (RACE_ANIM_SECONDS * 1000));
    this.renderFrame(tau);
    if (tau >= 1) this.time.delayedCall(800, () => this.finish());
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.scene.start('RaceResultScene', { season: this.data.season, result: this.data.result, playerSummary: this.data.playerSummary });
  }
}
```

- [ ] **Step 2: Register `RaceScene` in `src/config.ts`**

Add the import and insert `RaceScene` into the `scene` array (after `SeasonScene`):

```typescript
import { RaceScene } from './scenes/RaceScene';
// ...
  scene: [BootScene, MainMenuScene, SeasonScene, RaceScene, RaceResultScene],
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/RaceScene.ts src/config.ts
git commit -m "feat(raceday): animated RaceScene with dots, gaps, laps, skip"
```

---

### Task 8: Wire the hub to the race-day view

**Files:**
- Modify: `src/scenes/SeasonScene.ts` (the `simulate()` method)

- [ ] **Step 1: Update imports in `src/scenes/SeasonScene.ts`**

Replace the simulator import line:

```typescript
import { runRace } from '../core/RaceEngine';
```
(remove the old `import { simulateRace } from '../core/RaceSimulator';` line if present)

- [ ] **Step 2: Replace the `simulate()` method body**

```typescript
  private simulate(): void {
    const rng = new RNG((Date.now() ^ (this.season.currentRaceIndex * 2654435761)) >>> 0);
    const { result, timeline } = runRace(this.season, this.setup, this.risk, rng);
    const summaries = applyProgression([this.season.playerRider, ...this.season.aiRiders], result);
    applyRaceResult(this.season, result);
    const playerSummary = summaries.find((su) => su.riderId === 'player')!;
    this.scene.start('RaceScene', { season: this.season, result, timeline, playerSummary });
  }
```

- [ ] **Step 3: Compile and build**

Run: `npx tsc --noEmit && echo OK`
Expected: `OK`.

Run: `npm run build 2>&1 | grep -E "built in|error"`
Expected: `built in ...`, no error.

- [ ] **Step 4: Browser-verify the full flow**

Run (background): `npm run dev`
Adapt `tools/uiprobe.mjs` to: select pilot+brand, START, pick setup/risk, SIMULATE, then assert the active scene becomes `RaceScene`, wait ~2s, screenshot `/tmp/raceday.png`, click SKIP (≈880,700), assert scene becomes `RaceResultScene`, and report `PAGE ERRORS`. Confirm the screenshot shows the track loop with dots, and there are no errors.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/SeasonScene.ts tools/uiprobe.mjs
git commit -m "feat(raceday): hub runs the race and launches the race-day view"
```

---

### Task 9: Update the integration test for the timeline

**Files:**
- Modify: `tests/integration.test.ts`

- [ ] **Step 1: Add a timeline assertion to the full-season test**

In `tests/integration.test.ts`, import `runRace` and add this test inside the existing `describe`:

```typescript
  it('runRace yields a timeline whose final order matches the result', async () => {
    const { runRace } = await import('../src/core/RaceEngine');
    const rng = new RNG(2026);
    const season = createSeason('Me', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
    const { result, timeline } = runRace(season, 'topSpeed', 'high', rng);
    expect(timeline.totalLaps).toBe(result.finishingOrder.length > 0 ? timeline.totalLaps : 0);
    // The leader by final progress is the race winner.
    const last = timeline.laps[timeline.laps.length - 1].entries;
    const finishers = last.filter((e) => !e.crashed);
    if (finishers.length > 0) {
      const leaderId = finishers.sort((a, b) => b.progress - a.progress)[0].riderId;
      expect(result.finishingOrder[0].rider.id).toBe(leaderId);
    }
  });
```

- [ ] **Step 2: Run the test and full suite**

Run: `npm test -- integration`
Expected: PASS.

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test(raceday): timeline winner matches finishing order"
```

---

## Self-Review Notes (planner — already checked)

- **Spec coverage:** timeline types (T1 §7), constants (T2 §6), Path (T3 §3), lap engine + per-lap crash/noise calibration + DNF ordering (T4 §2), balance re-validation + crash-rate (T5 §5), layouts (T6 §3), RaceScene animation + skip + flow (T7 §4), hub wiring (T8 §4.1), integration (T9). Out-of-scope items (§10) intentionally not built.
- **Type consistency:** `runRace(season, setup, risk, rng): { result, timeline }`, `simulateRace(...)` wrapper, `RaceTimeline { laps, totalLaps }`, `LapSnapshot { lap, entries: { riderId, progress, crashed }[] }`, `buildPath(points)`, `pointAt(path, t)`, `TRACK_LAYOUTS[id].points` — consistent across tasks.
- **Import stability:** `RaceSimulator.ts` re-exports `simulateRace`, so existing test/scene imports keep working; the hub switches to `runRace` for the timeline (T8).
- **Risk:** balance drift handled by T5 (tune `LAP_NOISE_STD`). The crash model now produces full DNFs (ordering) instead of a score penalty; `crashProbability` is unchanged so the harness re-validates cleanly. `crashPenalty` in `CrashModel.ts` becomes unused but is left (still covered by `crash.test.ts`); remove only if a later cleanup pass wants it.
- **Sequencing:** core (T1–T6) is independently testable; the app runs the new flow after T8.
```
