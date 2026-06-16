# Race Stability Improvements — Design Spec

**Status:** Approved · **Date:** 2026-06-16 · **Scope:** 4 improvements, ~3 files, ~50 lines

---

## Problem

The lap-by-lap race view feels chaotic. Riders swing from 1st to 6th in a single lap because per-lap noise (`LAP_NOISE_STD = 3.11`) is ~45% of base pace (~7), while between-rider gaps average ~1 progress point. The noise was tuned to preserve Phase A's final-result SNR, but it destroys the lap-by-lap viewing experience.

## Goal

Races that feel like racing — gradual position shifts, narrative momentum, natural packs — not a random-walk slot machine.

---

## Improvement 1: Reduce per-lap noise

### What
Reduce `LAP_NOISE_STD` from `3.11` to `1.5` (from ~45% of base pace to ~21%).

### Why
Lap-to-lap position changes become gradual (1-2 places per lap max) instead of chaotic (±3-4 places). The final result becomes slightly more skill-driven (less luck), which is acceptable — the balance harness already ensures build-level co-equality.

### How
Change one constant: `LAP_NOISE_STD = 1.5` in `src/core/constants.ts`.

### Trade-off
Final-race randomness decreases (noise std over 8 laps: 8.8 → 4.2). The balance harness must still pass. If the spread between builds narrows too much, `TARGET_BUILD_RATE` bounds can be tightened.

---

## Improvement 2: Momentum / streak noise (AR(1) process)

### What
Each rider's per-lap noise is 60% carried over from their previous lap + 40% fresh random. A rider having a good lap tends to have another good lap; a rider struggling tends to stay struggling. Lap-to-lap noise is an AR(1) process rather than independent draws.

### Why
Independent noise means riders bounce randomly — 1st one lap, 7th the next, 2nd the lap after. Momentum creates narrative arcs: "she's on a charge," "he's fading," "can he hold on?" Single-lap noise variance is preserved (variance-preserving blend), so total randomness over the race is unchanged — only the distribution across laps shifts.

### How
- Add `lastNoise: number` (default 0) to `RiderState` in `src/core/RaceEngine.ts`.
- In `stepLap`, compute: `noise = MOMENTUM_WEIGHT * state.lastNoise + sqrt(1 - MOMENTUM_WEIGHT²) * freshNoise`, where `freshNoise = rng.gaussian(0, LAP_NOISE_STD)`.
- Store `state.lastNoise = noise`.
- Add `MOMENTUM_WEIGHT = 0.6` to `src/core/constants.ts`.

### Verification
Test: a rider with positive noise on lap 1 has >50% chance of positive noise on lap 2.

---

## Improvement 3: Drafting / pack effect

### What
Riders within 2 progress points of each other get pulled toward the pack center. The trailing rider receives a small convergence bonus (~0.3 per lap) toward the riders ahead.

### Why
Without drafting, 10 riders form an evenly-spread line with no natural groupings. Drafting creates lead pack, mid pack, back markers — the classic racing visual. Close battles feel tense; breakaways feel earned.

### How
- Add `DRAFT_RANGE = 2.0` and `DRAFT_BONUS = 0.3` to `src/core/constants.ts`.
- After computing base progress in `stepLap`, for each rider: if at least one non-crashed rider is within `DRAFT_RANGE` progress points ahead, add `DRAFT_BONUS` to this rider's progress. Simple binary check — being near the pack gives a small tow, being isolated gives nothing. Packs naturally cluster; solo breakaways stay solo.

### Verification
Test: two riders starting at identical progress converge slightly (trailing rider gains ~0.3/lap over leader), but don't overtake purely from drafting.

---

## Improvement 4: Smooth visual interpolation

### What
Between lap ticks, rider dots ease smoothly to their new positions rather than snapping.

### Why
The current RaceScene updates dot positions once per lap. With reduced noise, position changes are smaller, but snapping still looks mechanical. Smooth tweens make the race feel fluid and alive.

### How
- In `RaceScene`, when lap progress updates arrive, interpolate dot positions over ~0.3s using Phaser tweens instead of setting `x`/`y` directly.
- The progress-to-position mapping (`Path.getPointAt(progress)`) remains the same — only the visual update method changes.
- Respect speed control: interpolation time scales with `1 / speed`.

### Verification
Browser-verified: dots move smoothly between lap-state updates rather than teleporting.

---

## Affected Files

| File | Changes |
|---|---|
| `src/core/constants.ts` | LAP_NOISE_STD 3.11→1.5, add MOMENTUM_WEIGHT, DRAFT_RANGE, DRAFT_BONUS |
| `src/core/RaceEngine.ts` | RiderState.lastNoise, AR(1) noise in stepLap, drafting bonus in stepLap |
| `src/scenes/RaceScene.ts` | Smooth tween interpolation for dot positions |
| `tests/raceEngine.test.ts` | New tests for momentum correlation and drafting convergence |

## Non-Goals

- Increasing lap count (RACE_LAPS stays at 8)
- Changing basePace, push bonuses, or crash model
- Position-change caps (explicitly rejected as redundant with #1)
- AI behavior changes

## Verification Criteria

1. Balance harness: `npm test` — all 49 tests pass (no regressions)
2. Momentum: new test asserting positive autocorrelation on consecutive lap noise
3. Drafting: new test asserting trailing rider gains on leading rider within range
4. Visual: `npm run dev` → play a race → dots move smoothly, positions shift gradually, packs form naturally
