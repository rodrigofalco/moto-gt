# MotoGT v2 — Phase B: Race-Day View (Spec)

> **Version:** 2.0-B
> **Date:** 2026-06-15
> **Status:** Approved design — pending spec review
> **Builds on:** Phase A (manager redesign), now on `main`. Phase B work happens on branch `v2-raceday`.
> **Branch invariant:** `main` (V1 + Phase A) stays green and playable throughout.

---

## 1. Goal

Replace the instant race result with a **lap-by-lap race that actually runs**, then **animate it in 2D**: riders as dots moving around a hand-authored track layout, with real gaps, overtakes, and crashes emerging from the simulation. A new `RaceScene` plays between the hub's SIMULATE and the result screen; it auto-plays (~18s) with a Skip button.

The race-day view IS the race — the finishing order is whatever the laps produce, and that order awards the points.

---

## 2. The core change: lap-by-lap resolution

Today `simulateRace` computes one `performance` per rider and sorts. Phase B turns that single performance into a **base lap pace** and runs the race over `RACE_LAPS` laps.

### 2.1 Per-lap model

For each rider, compute the **deterministic part** of performance exactly as Phase A does (axes + setup + push), but **without** the single-shot Gaussian noise:

```
basePace(rider, setup, risk, track) =
    weightedBase(applySetup(baseAxes(skills, bike), setup), track) + PUSH_BONUS[risk]
```

Then run the race:

```
for each rider: progress = 0; crashed = false; crashLap = null
for lap in 1..RACE_LAPS:
  for each non-crashed rider:
    progress += basePace + rng.gaussian(0, LAP_NOISE_STD)      // per-lap variation
    if (not crashed and rng.nextFloat() < perLapCrashProb(rider, risk, track)):
      crashed = true; crashLap = lap                            // DNF — stops accumulating
  record a LapSnapshot (every rider's progress + crashed flag + crashLap)
```

- **Finishing order:** non-crashed riders sorted by `progress` desc; then crashed riders sorted by `crashLap` desc (later crash = more distance covered = ahead of earlier crashes). All crashed riders rank behind all finishers. Assign positions 1–10 and points `[25…1]`.
- **Determinism:** same seed → identical race (the seeded RNG drives lap noise and crash rolls in a fixed order).

### 2.2 Per-lap crash calibration

The season-total crash probability must stay equivalent to Phase A so the balance carries over. Convert the Phase A whole-race crash probability into a per-lap probability so the cumulative chance over `RACE_LAPS` matches:

```
perLapCrashProb(rider, risk, track):
  P = crashProbability(risk, rider.skills.consistency, track)   // Phase A whole-race prob
  return 1 - Math.pow(1 - P, 1 / RACE_LAPS)
```

This keeps `crashProbability` (and all crash constants) as the single source of truth; only the *distribution across laps* is new.

### 2.3 Noise calibration

Phase A applied one `gaussian(0, NOISE_STD_DEV=1.0)` to performance. Accumulating `RACE_LAPS` independent per-lap noises of σ=`LAP_NOISE_STD` gives total σ ≈ `LAP_NOISE_STD * sqrt(RACE_LAPS)`. Starting point: `LAP_NOISE_STD = NOISE_STD_DEV / sqrt(RACE_LAPS)` so total race variance ≈ Phase A. **The balance harness re-validates this** (§5) and `LAP_NOISE_STD` is tuned if co-equality drifts.

### 2.4 Engine API

```typescript
// src/core/RaceEngine.ts  (replaces the body of RaceSimulator; keep simulateRace's name/role)
interface LapSnapshot {
  lap: number;
  entries: { riderId: string; progress: number; crashed: boolean }[];
}
interface RaceTimeline {
  laps: LapSnapshot[];           // length RACE_LAPS, ascending
  totalLaps: number;
}
// Returns BOTH the result (for points/standings/harness) and the timeline (for the view).
function runRace(season, playerSetup, playerRisk, rng): { result: RaceResult; timeline: RaceTimeline };
// Thin wrapper kept for the harness/tests that only need the order:
function simulateRace(season, playerSetup, playerRisk, rng): RaceResult; // = runRace(...).result
```

`RaceResult`/`RaceEntry` are unchanged (still carry setup/risk/crashed/performanceScore — `performanceScore` becomes final `progress`). The harness calls `simulateRace` and is unaffected beyond re-tuning.

---

## 3. Track layouts (hand-authored)

```typescript
// src/data/trackLayouts.ts
// A closed loop per track as normalized control points in [0,1]×[0,1],
// smoothed (Catmull-Rom) into a path. Distinct, recognizable silhouettes.
interface TrackLayout { id: string; points: { x: number; y: number }[]; }
export const TRACK_LAYOUTS: Record<string, TrackLayout>; // keyed by Track.id (6 entries)
```

A path helper provides arc-length sampling so a rider at lap-progress fraction `f ∈ [0,1)` maps to a screen point:

```typescript
// src/core/Path.ts  (pure, no Phaser)
function buildPath(points): SampledPath;          // precompute smoothed, arc-length-parameterized samples
function pointAt(path, t: number): { x: number; y: number }; // t in [0,1), wraps
```

Layouts are authored once; correctness is "renders a closed, non-self-intersecting loop." The 6 ids: `mugello, sachsenring, redbull, phillip, jerez, silverstone`.

---

## 4. RaceScene (new)

Inserted between the hub and the result. Receives the already-computed `timeline` plus the (already applied) `result`/`playerSummary`, and animates.

### 4.1 Flow

```
SeasonScene.simulate():
  { result, timeline } = runRace(season, setup, risk, rng)
  summaries = applyProgression([...], result)
  applyRaceResult(season, result)                 // state locked BEFORE animation
  scene.start('RaceScene', { season, result, timeline, playerSummary })

RaceScene:
  auto-play timeline (~RACE_ANIM_SECONDS) → on finish OR Skip → scene.start('RaceResultScene', { season, result, playerSummary })
```

Because state is locked before the animation, Skip is always consistent.

### 4.2 Rendering & animation

- Draw the track path as a thick rounded polyline (Graphics) from `TRACK_LAYOUTS[track.id]`.
- Each rider = a filled circle (Ø ~10px) with a 2–3 char label; **player = gold, Ø ~14px**; AI = team-ish colors. 
- Position each rider at `pointAt(path, lapFraction)` where the animation clock maps elapsed time → continuous lap+fraction, **interpolating between `LapSnapshot`s** for smooth motion (progress within a lap is linear; positions ordered by cumulative progress give the gaps).
- HUD: `Lap k / N`, current order list (small, right side) with gap-to-leader, player highlighted.
- **Crash:** when a rider's snapshot shows `crashed` turning true, flash the dot red and freeze it (mark DNF on the order list).
- **Skip** button (uses the fixed `Button`).
- Auto-advance to `RaceResultScene` when the clock reaches the final lap (short pause on the finish).

### 4.3 Pacing

`RACE_LAPS` (start 14), `RACE_ANIM_SECONDS` (start 18). The animation maps wall-clock to lap progress; Skip ends it immediately.

---

## 5. Balance re-validation (mandatory)

The per-lap refactor changes the result distribution, so the Phase A harness (`tests/balance.test.ts`) is **re-run against the new engine** and must still pass:
- Co-equal builds (pace/cornering/balanced each 25–45%, spread ≤ 15 pts).
- Setup matters (read-the-track beats fixed setup by ≥ 4 pts).
- Risk matters (adaptive beats always-low by ≥ 4 pts).

If co-equality drifts, tune `LAP_NOISE_STD` (and only if needed, `RACE_LAPS`) — never the build/track data, which is already balanced. Add one new assertion: **crash rate is in a sane band** (e.g. the player crashes in 5–25% of races under a reasonable policy) so the per-lap calibration didn't inflate/erase crashes.

---

## 6. Constants (additions to `src/core/constants.ts`)

```typescript
export const RACE_LAPS = 14;
export const LAP_NOISE_STD = NOISE_STD_DEV / Math.sqrt(RACE_LAPS); // ≈ 0.267, tuned by harness
export const RACE_ANIM_SECONDS = 18;
```

---

## 7. Data model additions (`src/core/types.ts`)

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

`RaceResult`, `RaceEntry`, `Rider`, `SeasonState`, `Track` unchanged. (`Track` gains no fields — layouts live in `trackLayouts.ts` keyed by id, so the data model and harness stay clean.)

---

## 8. Files

| File | Change |
|---|---|
| `src/core/types.ts` | Add `LapSnapshot`, `RaceTimeline` |
| `src/core/constants.ts` | Add `RACE_LAPS`, `LAP_NOISE_STD`, `RACE_ANIM_SECONDS` |
| `src/core/Path.ts` | New — Catmull-Rom + arc-length sampling (pure) |
| `src/core/RaceEngine.ts` | New — `runRace` (lap loop) + `simulateRace` wrapper |
| `src/core/RaceSimulator.ts` | Re-export `simulateRace` from RaceEngine (keep import paths stable) OR fold in; tests import `simulateRace` |
| `src/data/trackLayouts.ts` | New — 6 hand-authored layouts |
| `src/scenes/RaceScene.ts` | New — the animated race |
| `src/scenes/SeasonScene.ts` | `simulate()` calls `runRace`, starts `RaceScene` |
| `src/config.ts` | Register `RaceScene` |
| `tests/path.test.ts` | New — closed-loop + arc-length sampling |
| `tests/raceEngine.test.ts` | New — invariants, determinism, crash→DNF ordering |
| `tests/balance.test.ts` | Re-run/re-tune against the new engine |

---

## 9. Edge cases

| Case | Handling |
|---|---|
| Everyone crashes (extreme) | Order by `crashLap` desc; still 10 unique positions, points sum 101 |
| Skip pressed on lap 1 | State already applied; jump to result immediately |
| Two riders equal `progress` | Tiebreak by axes (as Phase A), then deterministic RNG |
| Crash on the final lap | Rider DNFs behind all finishers; later crashLap still ranks ahead of earlier crashes |
| Path self-intersects (authoring error) | Acceptable visually for V2; the loop just needs to be closed and traversable |
| Window resize during animation | Phaser FIT handles it; positions are recomputed from normalized path each frame |

---

## 10. Out of scope (future)

Pit stops, tyre wear within the race, weather, multiple racing lines, rider AI behaviors mid-race (drafting, defending), replay scrubbing, variable lap counts per track. Phase B is a faithful animated visualization of the per-lap sim with auto-play + skip.

---

## Appendix — risks
1. **Balance drift** from the per-lap refactor (mitigated by §5 re-validation; `LAP_NOISE_STD` is the dial).
2. **Authoring 6 layouts** is hand work; keep them simple closed loops.
3. **Animation smoothness** — interpolate between snapshots; don't snap per lap.
