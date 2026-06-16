# MotoGT v2 — Race-Day Interactive Upgrade (Spec)

> **Version:** 2.0-B.1
> **Date:** 2026-06-15
> **Status:** Approved design — building inline on `v2-raceday`.
> **Builds on:** Phase B (race-day view). Enhances it; keeps the lap model and balance intent.

---

## 1. Goal

Make the race-day view richer and **interactive**: brand-colored numbered dots, speed control, and — the headline — **live tactical orders** that replace the pre-race Risk pick. Risk leaves the hub and becomes an in-race decision (Attack/Defend/Settle) you change as the race unfolds. The race now **resolves live** as you watch.

---

## 2. Visual changes

- **Dot color by bike brand** (each rider carries `brandId`): Velocita `#e94560` (red), Apex `#4fc3f7` (blue), Titan `#cfd8dc` (silver), Vortex `#ff9800` (orange). The **player keeps its brand color but gets a thick gold ring + larger radius**.
- **Fixed race numbers** drawn centered on each dot (1–10), assigned by grid order (`[player, ...ai]` → 1..10).
- **Speed control:** `0.5× / 1× / 2×` buttons; default **1×** with a slower base race (`RACE_ANIM_SECONDS = 30`). Speed scales the per-lap tick duration.

## 3. Risk → live tactical orders

- **Hub:** the **Risk selector is removed**; the hub keeps Setup + R&D only.
- **In-race radio buttons: Attack / Defend / Settle**, changeable any lap, default **Defend**. They map onto the existing risk model (no new tuning of the risk constants):
  - `Attack → high`, `Defend → medium`, `Settle → low`.
- The player's order applies to the **next lap(s)** until changed. AI choose a risk per race as today (`aiRisk`).

## 4. Engine: lap-stepped, live resolution

The race is no longer fully precomputed before the animation. New stepped API in `RaceEngine` (additive — existing functions kept):

```typescript
interface RaceRun {
  track: Track;
  states: RiderState[];   // internal per-rider state (progress, crashed, axes, basePace, aiRisk)
  lap: number;            // laps completed so far (0..RACE_LAPS)
  rng: RNG;
}
function createRace(season, playerSetup, rng): RaceRun;        // AI pick setup+risk here; player order applied per lap
function stepLap(run: RaceRun, playerRisk: Risk): void;        // advance ONE lap; player uses playerRisk this lap
function finalizeRace(run: RaceRun, rng: RNG): RaceResult;     // sort → positions/points (same ordering rules)

// Convenience (non-interactive) — used by the harness/tests, unchanged signatures:
function runRace(season, playerSetup, playerRisk, rng): { result, timeline };  // createRace + RACE_LAPS×stepLap + finalize
function simulateRace(season, playerSetup, playerRisk, rng): RaceResult;        // runRace(...).result
```

- `runRace`/`simulateRace` keep their signatures (player holds `playerRisk` constant across laps), so **the balance harness and all existing tests are unchanged** beyond the harness now expressing the player policy as an order (still a per-race `Risk`). Co-equality + "orders matter" (adaptive vs always-settle) re-validated; no expected re-tune.

## 5. Flow change (race resolves in the scene)

Because orders are live, resolution moves into `RaceScene`:

```
SeasonScene.simulate():
  rng = seeded(...)
  run = createRace(season, setup, rng)
  scene.start('RaceScene', { season, run, rng })     // no result yet

RaceScene:
  every lap-tick (duration = RACE_ANIM_SECONDS/RACE_LAPS / speed):
    prevProgress = snapshot; stepLap(run, currentPlayerRisk); curProgress = snapshot
    interpolate dot positions between prev→cur over the tick
  on last lap OR Skip (Skip = step remaining laps instantly with current order):
    result = finalizeRace(run, rng)
    applyProgression([...], result); applyRaceResult(season, result)
    scene.start('RaceResultScene', { season, result, playerSummary })
```

Progression/`applyRaceResult` move from `SeasonScene` to `RaceScene` (after the race actually finishes). Skip stays consistent because it just fast-forwards the same run.

## 6. Data model

- Add `brandId: string` to `Rider` (set by factories: player = chosen brand id; AI = assigned brand id).
- Race numbers are derived in the scene from grid order — no storage.

## 7. Files

| File | Change |
|---|---|
| `src/core/types.ts` | `Rider.brandId`; (Order is just the UI label for Risk — no new type) |
| `src/core/constants.ts` | `RACE_ANIM_SECONDS = 30`; `BRAND_COLORS` map; `RACE_SPEEDS = [0.5,1,2]` |
| `src/core/RaceEngine.ts` | Add `createRace`/`stepLap`/`finalizeRace`; refactor `runRace` to use them |
| `src/core/factories/RiderFactory.ts` | Set `brandId` on player + AI riders |
| `src/scenes/SeasonScene.ts` | Remove Risk selector; `simulate()` → `createRace` → `RaceScene` |
| `src/scenes/RaceScene.ts` | Brand colors + numbers + gold ring; speed buttons; Attack/Defend/Settle radio; live stepping + interpolation; owns progression/result/skip |
| `tests/raceEngine.test.ts` | Stepped API: determinism (runRace == manual steps), invariants |
| `tests/balance.test.ts` | Re-validate (order policy); rename "risk" wording if helpful |
| `tests/factories.test.ts` | `brandId` set correctly |

## 8. Balance re-validation

Run the harness after the engine refactor; co-equal builds (25–45%, spread ≤15) and orders-matter (adaptive beats always-settle by ≥4 pts) must hold. The lap model and risk constants are unchanged, so this should pass as-is; tune `LAP_NOISE_STD` only if it drifts.

## 9. Edge cases

| Case | Handling |
|---|---|
| Skip on lap 1 | Step remaining laps instantly with current order, finalize, go to result |
| Player never touches radio | Stays on default Defend (medium) all race — equals a sensible baseline |
| Order changed every lap | Allowed; each lap uses whatever order is current at step time |
| Determinism | Same seed + same per-lap orders → identical race; `runRace` (constant order) stays reproducible for the harness |

## 10. Out of scope

Per-lap AI order changes (AI hold one risk per race), drafting/slipstream physics, pit/tyres, replay scrubbing, gap-time-in-seconds readout (progress-based order only).
