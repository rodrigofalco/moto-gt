# Race Stability Improvements — Design Spec

**Status:** Revised · **Date:** 2026-06-16 · **Scope:** 3 sim changes + 1 visual tuning, ~3 files, ~50 lines

> Revision note: this version corrects three errors in the first draft — (a) Improvement 4 was based on a
> misreading of `RaceScene`, which already interpolates every frame; (b) Improvement 2's "total randomness
> unchanged" claim was wrong (AR(1) momentum *increases* race-total variance); (c) Improvement 3's "How"
> contradicted its own verification. See each section for the corrected reasoning.

---

## Problem

The lap-by-lap race view feels chaotic. Riders swing from 1st to 6th in a single lap because per-lap noise (`LAP_NOISE_STD ≈ 3.11`) is ~44% of base pace (~7), while between-rider gaps average ~1 progress point. The noise was tuned to preserve Phase A's final-result signal-to-noise ratio, but it destroys the lap-by-lap viewing experience.

Note on the current value: `LAP_NOISE_STD` is presently a *derived* constant, `NOISE_STD_DEV * Math.sqrt(RACE_LAPS) = 1.1 × √8 ≈ 3.11` (`src/core/constants.ts:46`). The inline comment there says `≈ 2.83`, which is stale (it predates `NOISE_STD_DEV` becoming 1.1) and should be fixed as part of this work.

## Goal

Races that feel like racing — gradual position shifts, narrative momentum, natural packs — not a random-walk slot machine. **Crucially, do this without flattening final-result variance**, because the balance harness depends on race outcomes retaining enough spread to distinguish builds.

### Design throughline (read before the individual improvements)

The four changes are not independent. The central idea is:

- **Lower the per-lap noise** (#1) so lap-to-lap motion is smooth.
- **Add positive autocorrelation** (#2) so the *cumulative* (race-total) noise climbs back up even though each lap is quiet — preserving final-result variance and therefore balance.
- **Add drafting** (#3) for pack structure.
- **Confirm** the existing per-frame interpolation (#4) still reads well at the lower noise level.

Concretely, race-total noise std over 8 laps:

| Configuration | per-lap σ | race-total std | effect |
|---|---|---|---|
| Current | 3.11 | 8.8 | chaotic laps, high final variance |
| #1 alone (independent noise) | 1.5 | **4.2** | smooth laps, but final variance halved (balance risk) |
| #1 + #2 (AR(1), ρ=0.6) | 1.5 | **≈7.1** | smooth laps **and** final variance near original |

(The 7.1 figure is the transient case where each rider's momentum seeds from 0 on lap 1; steady-state would be ~7.4. Treat it as approximate and confirm empirically via the balance harness.)

This is why #2 is not optional polish — it is what makes #1 safe for balance.

---

## Improvement 1: Reduce per-lap noise

### What
Reduce `LAP_NOISE_STD` from `≈3.11` to `1.5` (from ~44% of base pace to ~21%).

### Why
Lap-to-lap position changes become gradual (1–2 places per lap max) instead of chaotic (±3–4 places).

### How
- In `src/core/constants.ts`, replace the derived expression with a literal: `export const LAP_NOISE_STD = 1.5;`
- Remove or rewrite the now-incorrect `NOISE_STD_DEV · √N` comment block (lines ~43–46). The √N relationship no longer holds once the value is set directly, and Improvement 2 takes over the job of preserving race-total variance. Replace it with a one-line pointer to this spec.

### Trade-off
On its own, #1 halves race-total noise std (8.8 → 4.2), which would make finishing order substantially more skill-driven and could narrow build-rate spread below `TARGET_BUILD_RATE` bounds. **#1 must ship together with #2**, which restores most of that variance (→ ~7.1). The balance harness is the gate: if spread still narrows too much after #1+#2, raise `MOMENTUM_WEIGHT` slightly or revisit `LAP_NOISE_STD`.

---

## Improvement 2: Momentum / streak noise (AR(1) process)

### What
Each rider's per-lap noise is partly carried over from their previous lap (`MOMENTUM_WEIGHT = 0.6`) plus a fresh random component. Lap-to-lap noise becomes an AR(1) process rather than independent draws. A rider having a good lap tends to keep having good laps; a struggling rider tends to keep struggling.

### Why
Two reasons, in priority order:

1. **Balance preservation (the load-bearing reason).** Finishing order is decided by *cumulative* progress (`s.progress`, the sum of per-lap deltas). Positive autocorrelation makes the variance of that sum larger than the same per-lap variance drawn independently — because the cross-lap covariances are all positive. This lifts race-total noise std from ~4.2 (independent, post-#1) back to ~7.1, close to the original 8.8. So we get smooth laps *and* a near-unchanged final-result spread.

2. **Narrative.** Independent noise makes riders bounce randomly (1st → 7th → 2nd). Momentum creates arcs: "she's on a charge," "he's fading," "can he hold on?"

> Correction from the first draft: the per-lap **marginal** variance is approximately preserved (it asymptotes to σ² after a 1–2 lap transient), but the **race-total** variance is *not* unchanged — it deliberately increases. That increase is the point, not a side effect.

### How
- Add `lastNoise: number` to `RiderState` in `src/core/RaceEngine.ts`, initialized to `0` in `createRace`.
- In `stepLap`, replace the inline `run.rng.gaussian(0, LAP_NOISE_STD)` with:
  ```ts
  const fresh = run.rng.gaussian(0, LAP_NOISE_STD);
  const noise = MOMENTUM_WEIGHT * s.lastNoise + Math.sqrt(1 - MOMENTUM_WEIGHT * MOMENTUM_WEIGHT) * fresh;
  s.lastNoise = noise;
  s.progress += s.basePace + PUSH_BONUS[risk] + noise;
  ```
- Add `export const MOMENTUM_WEIGHT = 0.6;` to `src/core/constants.ts`.

RNG consumption is unchanged (still exactly one gaussian draw per non-crashed rider per lap), so determinism is preserved — but seeded outcomes *will differ* from current code because the applied noise value changes. See Verification Criteria for the test impact.

### Known transient
`lastNoise` starts at 0, so lap-1 noise has reduced variance ((1 − ρ²)·σ² = 64% of steady state). Riders are quietest on lap 1 and reach full per-lap variance after ~2 laps. This is acceptable (a calm opening lap is realistic) and is already accounted for in the ~7.1 race-total figure.

### Verification
Statistical test (many seeds, aggregate): a rider with positive noise on lap *n* has >50% probability of positive noise on lap *n+1* — i.e. positive lag-1 autocorrelation. Do **not** assert exact values for a single seed.

---

## Improvement 3: Drafting / pack effect

### What
A rider who is not at the front of a local group gets a small tow (`DRAFT_BONUS = 0.3` progress/lap) when there is at least one non-crashed rider close ahead (within `DRAFT_RANGE = 2.0` progress points). The rider at the front of a group, with clear air ahead, gets no tow. This gently compresses the field into packs.

### Why
Without drafting, 10 riders form an evenly spread line with no natural groupings. The tow pulls trailing riders toward those just ahead, producing a lead pack, mid pack, and back markers — the classic racing visual.

### Breakaway behaviour (corrected design intent)
Because only the front-of-group rider lacks a tow, drafting creates a mild "rubber-band" that resists a rider pulling clear. This does **not** prevent breakaways — it prices them. The tow is 0.3/lap; a rider whose pace + push edge over the pack exceeds ~0.3/lap will still escape and stay escaped (e.g. `high` push is +1.2). So a breakaway is *earned* by a genuine pace advantage rather than handed out by noise. The first draft's claim that "solo breakaways stay solo" was misleading — the accurate statement is "a breakaway holds only while the leader's real advantage outweighs the pack's tow."

### How
- Add `export const DRAFT_RANGE = 2.0;` and `export const DRAFT_BONUS = 0.3;` to `src/core/constants.ts`.
- In `stepLap`, **after** all riders' base progress for the lap has been computed (compute the lap's progress into a temp, or run drafting as a second pass over `run.states` reading the pre-draft progress), for each non-crashed rider: if any *other* non-crashed rider has `progress` strictly greater than this rider's by no more than `DRAFT_RANGE` (`0 < other.progress - self.progress <= DRAFT_RANGE`), add `DRAFT_BONUS` to this rider's progress.
- **Define "ahead" as strict** (`other.progress > self.progress`). Two riders at *exactly* equal progress give neither a tow that lap; the next lap's noise breaks the tie, after which the trailing one draws the tow. (This matters for the test below.)
- Apply drafting as a separate pass so a rider's tow is based on positions *before* this lap's tows are applied, avoiding order-dependent cascades within a single lap.

### Verification
- Convergence test: two riders with a **small initial gap** (e.g. 0.5 progress points, within `DRAFT_RANGE`) — the trailing rider gains ~`DRAFT_BONUS`/lap on the leader. (Do not start them at identical progress; with strict "ahead", equal progress yields no tow and they would not converge — that scenario was the contradiction in the first draft.)
- Non-overtake-from-tow-alone: with equal pace and no noise, the trailing rider closes the gap but the tow switches off once it reaches the front of the pair, so drafting alone does not flip the order.

---

## Improvement 4: Visual smoothness (tune existing interpolation, not new tweens)

### Corrected premise
The first draft said `RaceScene` "updates dot positions once per lap" and proposed adding Phaser tweens. **That is false.** `RaceScene` already interpolates continuously:

- `update()` (`src/scenes/RaceScene.ts:232`) advances laps off a time accumulator and calls `renderFrame(frac)` **every frame**.
- `renderFrame` (`:163`) lerps each dot from `prev → cur` by `frac`, then applies a second smoothing pass via an exponential moving average (`EMA = 0.14`, `:164`) into `displayProg`.
- Speed control already feeds in naturally: `acc += delta * this.speed` (`:235`), and `frac = acc / lapMs`.

Adding Phaser tweens on top of this would create two systems writing dot positions each frame (the tween target gets overwritten by the next `renderFrame`), producing jitter — the opposite of the goal.

### What
Treat #4 as **verification + optional tuning**, not new machinery:
1. Confirm that with #1's lower noise, the existing per-frame lerp + EMA already reads as smooth (it very likely does — smaller per-lap deltas mean less to smooth).
2. Only if motion still looks sluggish or laggy, adjust the existing `EMA` constant (higher = snappier/less lag, lower = smoother/more lag). This is a one-number tweak, browser-verified.

### Optional follow-up (not required for this spec)
The `EMA` is applied per *frame*, so its effective lag in lap-fraction terms grows at higher speed settings (fewer frames per lap of sim time). If high-speed playback looks laggy, make the EMA delta-aware (`alpha = 1 - exp(-k * dt * speed)`) in a later change. Out of scope here.

### Verification
Browser-verified (`npm run dev` → play a race): dots glide smoothly between lap states at 1×, 2×, and 4×, with no jitter and no perceptible teleporting. Unit tests do not cover this (per project memory: UI/motion changes must be browser-verified).

---

## Affected Files

| File | Changes |
|---|---|
| `src/core/constants.ts` | `LAP_NOISE_STD` → literal `1.5` (+ fix stale comment); add `MOMENTUM_WEIGHT = 0.6`, `DRAFT_RANGE = 2.0`, `DRAFT_BONUS = 0.3` |
| `src/core/RaceEngine.ts` | `RiderState.lastNoise` (init 0 in `createRace`); AR(1) noise in `stepLap`; drafting second-pass in `stepLap` |
| `src/scenes/RaceScene.ts` | Tune existing `EMA` only if needed — no new tween system |
| `tests/raceEngine.test.ts` | New statistical tests for momentum autocorrelation and drafting convergence |

## Non-Goals

- Increasing lap count (`RACE_LAPS` stays at 8)
- Changing `basePace`, push bonuses, or the crash model
- Position-change caps (rejected as redundant with #1)
- AI behaviour changes
- A new Phaser tween system in `RaceScene` (existing per-frame interpolation is sufficient)

## Verification Criteria

1. **Balance harness is the gate.** Run the full suite (`npm test`). Note: the suite includes seeded *exact-order* assertions (`tests/raceEngine.test.ts:34` "deterministic for a fixed seed" and `:61` "runRace equals manual…"); these compare new-vs-new runs so they still pass, but any test asserting a *specific* finishing order/score from a hard-coded seed against old behaviour will need its expectations regenerated. Audit for those before claiming "no regressions"; do not assert a fixed pass count until the suite is actually run.
2. **Balance preserved.** Build-rate spread stays within `TARGET_BUILD_RATE` / `MAX_BUILD_RATE_SPREAD` after #1+#2 combined (not #1 alone). If it narrows too far, raise `MOMENTUM_WEIGHT`.
3. **Momentum:** statistical test asserting positive lag-1 autocorrelation on consecutive-lap noise (aggregate over many seeds, not single-seed exact values).
4. **Drafting:** test asserting a trailing rider with a small initial gap (within range) gains ~`DRAFT_BONUS`/lap on the leader, and that the tow alone does not flip the order.
5. **Visual:** `npm run dev` → play a race → dots move smoothly at all speeds, positions shift gradually, packs form naturally.
