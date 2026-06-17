# Race View Overhaul — Design Spec

**Status:** Approved · **Date:** 2026-06-16 · **Scope:** make the race watchable — on-track dots that match the standings, plus lap times. New pure `core/raceView.ts` + a `RaceScene` rewrite of the render/placement path. Engine untouched.

---

## Problem

Watching a race is unsatisfying and, worse, *misleading*: "a bike passes me on track and suddenly I'm three places down — what I see has no relation to the result."

This is a genuine decoupling, not a feel issue. In `RaceScene.renderFrame()`:

- The **standings list** (`RaceScene.ts:187`) and the **final result** sort by each rider's real cumulative `progress`.
- The **dot on the track** (`RaceScene.ts:176–178`) is placed at `loops = displayProg / progressPerLoop − offset`, then `loops mod 1` — i.e. *where around one lap-loop* the rider is, minus a cosmetic stagger keyed to **start number** (`offset = (startNumber−1) × (0.006 + 0.020 × gridFade)`).

Because every rider advances ~`progressPerLoop` of progress per lap, `displayProg / progressPerLoop mod 1` is nearly identical for everyone at any instant — so the *visible spacing between dots is almost entirely the start-number offset, not the race gaps*. The dots are arranged by car number; the standings by real progress. They are effectively unrelated views. (The EMA lag on `displayProg` and a permanent 0.006/rider offset make it worse.)

Two missing things follow:
1. The track view must encode **race order and gaps**, so an overtake you watch *is* a standings change.
2. There are **no lap times**, so there's no sense of pace or drama beyond raw position.

## Goal

A race you enjoy watching and trust: the dots form a train whose order is exactly the standings, close battles look close, overtakes are visible and real — and lap times give the race a pulse.

## Non-Goals

- No change to the simulation, scoring, crash model, or balance. The engine is untouched; this is entirely a view concern.
- No real physics/time model — lap times are a presentation-layer derivation from `progress`.
- Not a fix for lap-to-lap *churn*: this makes the view faithful, but the field will still reshuffle each lap if per-lap noise stays high. See **Dependency** below.

## Dependency (sequencing)

This overhaul makes the view honest. If per-lap noise is still ~3.11, the standings — and now the faithful dots — will still swing wildly each lap, just truthfully. The payoff lands when combined with the **race-stability** work (lower noise + AR(1) momentum + drafting), which is being built in parallel on the `race-stability` branch. Recommended: land stability first or merge the two together before judging the result.

---

## Architecture

All new logic is **pure and unit-testable**, in a new module `src/core/raceView.ts` (no Phaser import, no state):

- `trainLayout(...)` — given each rider's live progress + crash state, returns where each dot sits along the track.
- `lapTime(delta, progressPerLoop, base)` — converts a lap's progress gain into a race-fiction lap time.
- `formatLapTime(seconds)` — formats seconds as `M:SS.mmm` / `SS.mmm`.

`RaceScene` consumes these each frame / each lap and renders. The existing leaderboard, gap readout, chase ring, overtake flash, player ring, speed control, and skip already key off real `progress`, so they stay consistent with the new dots automatically (the gap readout is re-based onto the new clock — see Part 2).

---

## Part 1 — Honest gap-train on the circuit

### Placement model

Each frame, from every non-crashed rider's **interpolated** progress (`trueP`, the existing prev→cur lerp by `frac`):

1. **Order** riders by `trueP` descending — the same key the standings use, so the train order is guaranteed to equal the standings. Tie-break by grid number (stable start line).
2. **Anchor** the leader at `anchor = (leaderTrueP / progressPerLoop) mod 1`, so the whole train still sweeps around the circuit ~1 loop/lap (it reads as racing).
3. **Distance-behind-leader**, walking front-to-back:
   ```
   placeBehind[0] = 0                                  // leader
   placeBehind[i] = clamp(
       max(placeBehind[i-1] + MIN_SEP, gap_i * GAP_SCALE),
       0, MAX_SPREAD)
   where gap_i = leaderTrueP - trueP_i
   ```
   - `gap_i * GAP_SCALE` shows the **real** gap when it exceeds the running minimum.
   - `placeBehind[i-1] + MIN_SEP` guarantees dots never stack **and that the visible order is exactly the standings order** (placeBehind is strictly increasing).
   - `MAX_SPREAD` keeps the field within part of the ring so the tail never wraps onto the leader.
4. **Track position:** `t_i = (anchor − placeBehind[i] + 1) mod 1`, then `pointAt(path, t_i)`.

### `trainLayout` signature (pure)

```ts
export interface TrainEntry { id: string; progress: number; crashed: boolean; grid: number; }
export interface TrainSlot { id: string; placeBehind: number; crashed: boolean; rank: number; }

export function trainLayout(
  entries: TrainEntry[],
  opts: { minSep: number; gapScale: number; maxSpread: number },
): TrainSlot[];
```

- The leader is the non-crashed entry with the greatest `progress`; `gap_i = leaderProgress − progress_i` is computed inside the function (no separate leader arg — avoids desync).
- Non-crashed entries are sorted by `progress` desc, tie-broken by `grid` asc, and assigned monotonically increasing `placeBehind` per the formula (rank 1..k).
- Crashed entries are returned with `crashed: true` and `rank` after all runners; the scene renders them frozen/dimmed and excludes them from spacing.
- `entries[i].progress` carries the scene's current-frame interpolated value (`trueP`), so the function stays pure and the scene owns interpolation.

### Constants (tunable; defined in `constants.ts`)

- `MIN_SEP = 0.045` — minimum loop-fraction between consecutive dots.
- `MAX_SPREAD = 0.5` — field occupies at most half the ring (9 gaps × 0.045 = 0.405 < 0.5, leaving headroom for real gaps).
- `GAP_SCALE = 0.5 / progressPerLoop` — a one-loop-worth gap maps to half the ring. Computed in the scene from the live `progressPerLoop` and passed into `trainLayout`.

### Animation
Per-rider **EMA on `placeBehind`** (target from `trainLayout`, smoothed toward it), so when one rider catches and passes another the dot **slides past** rather than snapping. Because `gap_i` uses the within-lap interpolated `trueP`, that slide is smooth across the lap, not a jump at the lap tick. An overtake you watch is a standings change being animated.

### Crashed riders
Frozen at their last on-track position, dimmed red, excluded from train spacing (the leaderboard already shows them `OUT`/`DNF`). The train always equals the classified runners.

### Removed
`offset`, `gridFade`, and the `displayProg` progress-EMA in `renderFrame` are deleted (superseded by `trainLayout` + the `placeBehind` EMA). The train's `MIN_SEP` spacing produces a clean ordered grid line at the start, replacing the old start-stagger.

---

## Part 2 — Lap times

### The race-fiction clock
The engine has no time, only `progress`. Define a flavor clock: `LAP_TIME_BASE = 90.0` (seconds) is the time to cover one loop (`progressPerLoop`) at average pace. A rider who covers more progress in a lap was faster:

```ts
export function lapTime(delta: number, progressPerLoop: number, base: number): number {
  return base * progressPerLoop / Math.max(delta, 0.01);
}
```

- `delta` = a rider's `progress` gained in the lap = `cur − prev` (already snapshotted by `RaceScene.advanceOneLap()`).
- Faster lap (bigger `delta`) → smaller time. Average `delta ≈ progressPerLoop` → ≈ `LAP_TIME_BASE`.

### Consistency fix (gaps onto the same clock)
The leaderboard's gap-in-seconds currently uses the **animation** clock (`RACE_ANIM_SECONDS / RACE_LAPS = 10s`), which is playback speed, not race time. Re-base it onto the race-fiction clock so gaps and lap times agree:

```
gapSeconds = (progressDiff / progressPerLoop) * LAP_TIME_BASE
```

`RACE_ANIM_SECONDS` and the 1×/2×/4× control remain untouched — they govern *how fast you watch*, independent of displayed race time.

### Formatting (pure)
```ts
export function formatLapTime(sec: number): string; // 89.43 → "1:29.430"; 58.2 → "58.200"
```
`M:SS.mmm` at/over 60s, `SS.mmm` under. Always 3 decimal places.

### Tracking (scene state, computed in `advanceOneLap`)
- `lastLapTime[id]` — updated every lap from `lapTime(cur − prev, …)`.
- `bestLapTime[id]` — min over the rider's laps.
- `fastestLap = { riderId, time }` — session best across all riders ("purple lap" holder).
- A lap where the rider crashed records no time.

### Display
- **Leaderboard rows** gain a compact **last-lap** column; the row of the `fastestLap` holder shows their best in magenta (`#d500f9`).
- A **Fastest lap** line under the board: `⚡ FL  #4 Rossi  1:28.9`.
- The **player's last lap** is echoed near the lap counter for prominence.
- Crashed/again-no-time → `—`.

---

## Affected files

| File | Change |
|---|---|
| `src/core/raceView.ts` | **New, pure.** `trainLayout`, `lapTime`, `formatLapTime` (+ `TrainEntry`/`TrainSlot` types). |
| `src/core/constants.ts` | Add `MIN_SEP`, `MAX_SPREAD`, `LAP_TIME_BASE` (and the `GAP_SCALE` basis). |
| `src/scenes/RaceScene.ts` | Replace dot placement with `trainLayout` + `placeBehind` EMA; remove `offset`/`gridFade`/`displayProg`; add lap-time tracking + display; re-base gap seconds onto `LAP_TIME_BASE`. |
| `tests/raceView.test.ts` | **New.** Unit tests for the three pure helpers. |

## Verification

1. **Unit (`raceView.test.ts`):**
   - `trainLayout`: output order always equals progress-desc order; equal progress separates by `MIN_SEP` with grid tie-break; a large gap reflects `gap × GAP_SCALE` once it exceeds the running min; `placeBehind` never exceeds `MAX_SPREAD`; crashed riders are excluded from spacing and ranked last.
   - `lapTime`: `delta == progressPerLoop` → `base`; bigger `delta` → smaller time; guards `delta → 0` (no NaN/Infinity blow-past the clamp).
   - `formatLapTime`: `89.43 → "1:29.430"`, `58.2 → "58.200"`, sub-second and exact-minute boundaries.
2. **Regression:** `npm test` stays green (engine untouched; this is additive view code).
3. **Browser (`npm run dev`, ideally on a branch that also has the stability noise fix):** the dot order matches the leaderboard at all times; close battles look close; an overtake on track coincides with the standings swap; last-lap times and a plausible fastest-lap appear and update; gaps in seconds and lap times read on the same scale.
