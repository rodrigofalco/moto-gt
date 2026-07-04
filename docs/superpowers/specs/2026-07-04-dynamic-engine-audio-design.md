# Dynamic Engine Audio — Design Spec

**Status:** Approved · **Date:** 2026-07-04 · **Scope:** the player's engine sound reacts to the track — accelerating with gear shifts on straights, braking into corners, holding steady mid-corner, accelerating again on exit. Simulation untouched.

---

## Problem

The current race-day engine sound (`SoundEngine.playEngine`, fixed 2026-07-03) is a single tone whose pitch only tracks the 1×/2×/4× playback-speed control. It doesn't respond to anything happening on track: no sense of braking into a corner, no gear changes, no relief on corner exit. The user wants to *hear* the track the way they'd feel it on a real bike.

## Why this has to be a presentation-layer fiction

`RaceEngine` has no sub-lap physics — `progress` advances once per lap as a single scalar (`RaceEngine.ts:stepLap`), and `raceView.ts`'s circulation is deliberately constant-rate, not tied to the leader's noisy pace (see its own header comment). There is no real "instantaneous speed" signal to sonify. This mirrors why lap times are already a race-fiction derivation (`raceView.ts:lapTime`) rather than real physics — the engine sound has to be built the same way: from the *shape of the track*, not the sim.

## Non-Goals

- No change to `RaceEngine`, balance, or scoring — audio-only.
- Player's bike only. AI riders are silent (as they are today); this is not a full engine-mix system for all 10 bikes.
- No new gameplay mechanic — Orders (Settle/Defend/Attack) already exist and get a very subtle audio read, not new behavior.

---

## Architecture

Three pieces, split by responsibility:

1. **`src/core/TrackShape.ts`** (new, pure, tested) — geometry: curvature profile + corner-zone detection.
2. **`src/core/EngineDynamics.ts`** (new, pure, tested) — decision-making: given the player's live track position, what engine state are we in and what should the pitch be doing?
3. **`src/core/SoundEngine.ts`** (extended) — playback: turns directives into Web Audio (continuous pitch glide, one-shot brake thunk, shift blips). Stays manually/browser-verified (no `AudioContext` in Node).

`RaceScene.ts` wiring is thin: compute curvature + zones once per race (after `buildPath`), and each frame pass the player's current track-position `t` (already computed for dot placement) through `EngineDynamics` into `SoundEngine`.

This split keeps the same boundary the codebase already uses: pure math in `src/core/`, Phaser/Web-Audio glue in `src/scenes/` (CLAUDE.md: "Keep game logic out of scenes").

---

## Part 1 — Track geometry (`TrackShape.ts`)

### Curvature profile

Given a track's `SampledPath` (from `Path.ts`, already built per race), compute a parallel array of curvature magnitude at each sample point: the turn angle between the incoming and outgoing direction vectors, divided by the arc-length step (so curvature is comparable across tracks/segment spacings, not raw angle).

```ts
export function buildCurvatureProfile(path: SampledPath): number[]
```

### Curvature lookup by lap-fraction

Mirrors `pointAt`'s interpolation style (binary search on `cum`, linear-interpolate between the two bracketing samples), for a given `t` in `[0, 1)`:

```ts
export function curvatureAt(path: SampledPath, curvature: number[], t: number): number
```

### Corner zones

A simple peak-detection pass over the profile: walk it once, find contiguous runs where curvature exceeds `CORNER_ENTER_THRESHOLD`, expand each run's boundaries outward while curvature stays above a lower `CORNER_EXIT_THRESHOLD` (hysteresis, so a corner doesn't have jittery edges), and record the peak curvature within the run. Handles the lap's start/finish wraparound with modular arithmetic (a corner can straddle `t=1 → 0`).

```ts
export interface CornerZone { start: number; end: number; peakT: number; peakCurvature: number; }
export function findCornerZones(path: SampledPath, curvature: number[]): CornerZone[]
```

Computed once per race (in `RaceScene.create`, right after `buildPath`), not per frame.

---

## Part 2 — Engine decision state machine (`EngineDynamics.ts`)

### States

- **`accel`** — on a straight, or past a corner's end. Target pitch climbs continuously from a base. Tracks how long (real ms, scaled by playback speed) the current accel run has lasted; every `SHIFT_INTERVAL_MS` (~1100ms at 1×) it emits a `shiftEvent` — a momentary dip-and-recover in the pitch curve — and raises the plateau, capping at 3 shifts before holding at the rev ceiling. A short straight naturally gets 0-1 shifts; a long one gets 2-3, without per-track tuning.
- **`brake`** — entered when the player's `t` comes within `BRAKE_LOOKAHEAD` (lap-fraction) of a corner zone's `start`. Target pitch drops smoothly, proportional to remaining distance into the zone (closer = lower target, so deceleration reads as continuous, not a snap). Emits a single `brakeEvent` exactly on the state-entry transition (not every frame).
- **`corner`** — while `t` is inside `[zone.start, zone.end]`. Target pitch holds near a value derived from `zone.peakCurvature` (tighter corner → lower held pitch), plus a small deterministic wobble (`sin` of `t`, not RNG — this is presentation flavor, not simulation, but stays reproducible) so it doesn't feel frozen.

Exit is not a separate state: crossing a zone's `end` simply flips the state back to `accel`, and the pitch resumes climbing from wherever it was — the "accelerating out of the corner" feel falls out of the state machine for free.

### Step function

```ts
export interface EngineDynamicsState { /* internal: current state, pitch, accel-run elapsed, shift count */ }
export interface EngineFrame { state: 'accel' | 'brake' | 'corner'; targetHz: number; shiftEvent: boolean; brakeEvent: boolean; }

export function createEngineDynamicsState(): EngineDynamicsState;
export function stepEngineDynamics(
  state: EngineDynamicsState, t: number, zones: CornerZone[], risk: Risk, deltaMs: number,
): EngineFrame; // returns the frame directive; mutates state in place for the next call
```

Called once per animation frame from `RaceScene.update()`, after `renderFrame` has computed the player's current interpolated `t`.

### Risk coupling (subtle)

Small multipliers only, applied inside `stepEngineDynamics`:

| Risk | Brake look-ahead | Rev ceiling |
|---|---|---|
| Attack | ×0.85 (brakes later) | ×1.05 |
| Defend | ×1.0 (baseline) | ×1.0 |
| Settle | ×1.15 (brakes earlier) | ×0.95 |

The look-ahead multiplier is the *only* brake-shape lever: pitch drops linearly from the accel pitch at zone entry to the corner's held pitch across the look-ahead window, so a shorter window (Attack) compresses the same total drop into less track distance — reading as harder/later braking — without a second, independently-tuned "steepness" constant to keep in sync.

These are read from the existing `season.lastRisk` / live `order` state already threaded through `RaceScene` — no new game logic.

---

## Part 3 — Playback (`SoundEngine.ts`)

Extends the persistent-oscillator engine hum fixed on 2026-07-03 (one oscillator + lowpass filter, smooth `setTargetAtTime` re-pitch, fade in/out — no per-frame restart):

- `engineTick(frame: EngineFrame): void` — glides the oscillator toward `frame.targetHz` via `setTargetAtTime` (time constant scaled by playback speed, so shifts/brakes don't feel rushed at 4×); on `shiftEvent`, layers a quick blip (brief frequency dip + a short filtered click, reusing the noise-burst technique from `playCrash`); on `brakeEvent`, triggers a one-shot descending sweep + soft noise burst.
- `playGearShift()` / `playBrakeBurst()` — the one-shot layers, callable independently for testing/tuning in the browser.

`RaceScene` replaces its current per-frame `this.soundEngine.playEngine(this.speed)` call with the new `engineTick` call fed by `EngineDynamics`.

---

## Testing

- **`tests/trackShape.test.ts`**: synthetic point sets with a known straight segment (near-zero curvature) and a known tight corner (high curvature); assert `buildCurvatureProfile` reflects that shape, and `findCornerZones` recovers the expected zone boundaries (including a zone forced to straddle the `t=1→0` wraparound).
- **`tests/engineDynamics.test.ts`**: synthetic `CornerZone[]`, no Web Audio involved — assert `accel` state far from any zone, `brake` state (and exactly one `brakeEvent`) once `t` enters the look-ahead window, `corner` state with pitch near the expected value inside zone bounds, `shiftEvent` firing at the expected cadence during a long simulated `accel` run, and the risk-multiplier table above (Attack brakes measurably later/harder than Settle for the same zone).
- `SoundEngine` playback stays manually/browser-verified (`npm run dev`, listen), consistent with today — Node has no `AudioContext`.
- Full regression: `npm run test`, `npm run build`, and a headless browser pass (`tools/app-flow.test.mjs` / `tools/full-season.test.mjs`) confirming no console/page errors with the new per-frame audio calls.

## Risks and Open Questions

- **Tuning by ear**: thresholds (`CORNER_ENTER_THRESHOLD`, `BRAKE_LOOKAHEAD`, shift interval, pitch ranges) are starting values; expect a listen-and-adjust pass once it's running in the browser, same as any procedural audio work.
- **Speed scaling**: glide/blip durations must scale down at 2×/4× or shifts will sound smeared into each other; flagged in Part 3, verify by ear at all three speeds.
- **Wraparound correctness**: corner-zone detection and lookahead math must handle a zone or lookahead window crossing `t=1→0` (the start/finish line) — covered by a dedicated test case, not just assumed.

## Related

- Prior art: `docs/superpowers/specs/2026-06-16-race-view-overhaul-design.md` (`raceView.ts` — same "pure presentation-fiction module" pattern this design follows).
- Sound engine click/pop fix: 2026-07-03 session (persistent oscillator + lowpass filter, no per-frame restart) — this design builds on top of that fix, doesn't replace it.
