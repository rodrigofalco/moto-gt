# Race Stability Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is intended to be executed by a dedicated agent **in its own git worktree** (see "Worktree setup" below).

**Goal:** Make the lap-by-lap race read like racing — smooth per-lap motion, narrative momentum, natural packs — while preserving final-result variance so the balance harness still passes.

**Architecture:** Three simulation changes in the pure `core/` layer plus one optional visual tweak. (1) Lower per-lap noise and (2) add an AR(1) "momentum" process so race-total variance is preserved — these two ship together. (3) Add a drafting tow that pulls trailing riders toward those just ahead. (4) Optionally tune the existing per-frame interpolation in `RaceScene`. The AR(1) blend and the drafting predicate are extracted as **tiny pure exported helpers** (`momentumNoise`, `hasDraftTow`) so they can be unit-tested directly — a deliberate, testability-driven refinement of the spec's "inline" wording.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest.

**Source spec:** `docs/superpowers/specs/2026-06-16-race-stability-improvements.md`

## Worktree setup

REQUIRED SUB-SKILL: Use superpowers:using-git-worktrees to create an isolated worktree **before** any code change, branched from `main`. Do all work for this plan inside that worktree on a branch named `race-stability`. Do not touch the user's primary checkout. When finished and verified, use superpowers:finishing-a-development-branch to present integration options — do **not** merge to `main` yourself.

## Global Constraints

- All gameplay tuning lives in `src/core/constants.ts`. No magic numbers in logic files.
- The **balance harness is the acceptance gate**: `tests/balance.test.ts` runs 1000 seasons per reference build and asserts each build's champion rate ∈ `TARGET_BUILD_RATE` ([0.25, 0.45]) and spread ≤ `MAX_BUILD_RATE_SPREAD` (0.15). It must pass at every commit boundary.
- Because of the gate, **noise reduction (#1) and momentum (#2) must land in the same task/commit** — noise alone halves race-total variance and would fail balance.
- RNG consumption order per rider per lap must stay exactly one `gaussian()` then one `nextFloat()` (preserves seeded determinism structure). Drafting consumes no RNG.
- Crashed riders neither receive nor provide a draft tow.
- "Ahead" for drafting is **strict** (`other.progress > self.progress`).
- Do not change `basePace`, push bonuses, the crash model, `RACE_LAPS`, or AI behavior.
- Test runner: `npx vitest run <file>` for one file; `npm test` for the full suite (includes the balance harness — it takes a while, that's expected). Typecheck: `npx tsc --noEmit`.

---

### Task 1: Lower noise + AR(1) momentum (ship together)

**Files:**
- Modify: `src/core/constants.ts`
- Modify: `src/core/RaceEngine.ts`
- Test: `tests/raceEngine.test.ts`

**Interfaces:**
- Consumes: `MOMENTUM_WEIGHT`, `LAP_NOISE_STD` from constants.
- Produces: `momentumNoise(lastNoise: number, fresh: number): number` (exported from `RaceEngine.ts`); `RiderState.lastNoise: number`.

- [ ] **Step 1: Update constants**

In `src/core/constants.ts`, replace the comment block + `LAP_NOISE_STD` line (currently the 3-line comment ending in `…fewer laps also = smoother motion.)` and `export const LAP_NOISE_STD = NOISE_STD_DEV * Math.sqrt(RACE_LAPS); // ≈ 2.83`) with:

```ts
// Per-lap noise is kept low for smooth lap-to-lap motion. Race-total variance — and
// therefore build balance — is preserved by the AR(1) momentum process in
// RaceEngine.stepLap (see docs/superpowers/specs/2026-06-16-race-stability-improvements.md).
export const LAP_NOISE_STD = 1.5;
export const MOMENTUM_WEIGHT = 0.6;   // AR(1): fraction of last lap's noise carried into this lap
```

(Leave `NOISE_STD_DEV` defined; it is used elsewhere / by Phase A.)

- [ ] **Step 2: Write the failing test**

Append to `tests/raceEngine.test.ts`. First extend the existing import from `'../src/core/RaceEngine'` to also import `momentumNoise`, then add:

```ts
import { RNG } from '../src/core/RNG';

describe('momentum noise (AR1)', () => {
  it('is positively autocorrelated lap-to-lap', () => {
    const rng = new RNG(7);
    let last = 0;
    const series: number[] = [];
    for (let i = 0; i < 5000; i++) { last = momentumNoise(last, rng.gaussian(0, 1.5)); series.push(last); }
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    let num = 0, den = 0;
    for (let i = 1; i < series.length; i++) num += (series[i] - mean) * (series[i - 1] - mean);
    for (let i = 0; i < series.length; i++) den += (series[i] - mean) ** 2;
    expect(num / den).toBeGreaterThan(0.4); // ~0.6 in expectation
  });

  it('preserves marginal variance in steady state (~input sigma)', () => {
    const rng = new RNG(11);
    let last = 0;
    const xs: number[] = [];
    for (let i = 0; i < 20000; i++) { last = momentumNoise(last, rng.gaussian(0, 1.5)); if (i > 50) xs.push(last); }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    expect(Math.sqrt(variance)).toBeGreaterThan(1.2);
    expect(Math.sqrt(variance)).toBeLessThan(1.8);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/raceEngine.test.ts`
Expected: FAIL — `momentumNoise` is not exported.

- [ ] **Step 4: Implement the helper + field + wire into stepLap**

In `src/core/RaceEngine.ts`:

(a) Extend the constants import to include `MOMENTUM_WEIGHT`:

```ts
import { POINTS_TABLE, PUSH_BONUS, RACE_LAPS, LAP_NOISE_STD, MOMENTUM_WEIGHT } from './constants';
```

(b) Add `lastNoise` to the `RiderState` interface (after `progress: number; crashed: boolean; crashLap: number;`):

```ts
  lastNoise: number;        // AR(1) state: last lap's applied noise (0 before lap 1)
```

(c) In `createRace`, add `lastNoise: 0` to the returned rider-state object (alongside `progress: 0, crashed: false, crashLap: 0`).

(d) Add the exported helper above `stepLap`:

```ts
// AR(1) momentum: blend carryover with fresh noise. Variance-preserving for the per-lap
// marginal; positive autocorrelation lifts race-total variance back toward the old level.
export function momentumNoise(lastNoise: number, fresh: number): number {
  return MOMENTUM_WEIGHT * lastNoise + Math.sqrt(1 - MOMENTUM_WEIGHT * MOMENTUM_WEIGHT) * fresh;
}
```

(e) In `stepLap`, replace the progress line:

```ts
    s.progress += s.basePace + PUSH_BONUS[risk] + run.rng.gaussian(0, LAP_NOISE_STD);
```

with:

```ts
    s.lastNoise = momentumNoise(s.lastNoise, run.rng.gaussian(0, LAP_NOISE_STD));
    s.progress += s.basePace + PUSH_BONUS[risk] + s.lastNoise;
```

- [ ] **Step 5: Run the helper tests**

Run: `npx vitest run tests/raceEngine.test.ts`
Expected: PASS (existing raceEngine tests + the two new momentum tests).

- [ ] **Step 6: Run the FULL suite — balance is the gate**

Run: `npm test`
Expected: all green, including `balance harness`. The console prints `pace …%  corner …%  balanced …%` and `spread …`.

**If the balance harness fails** (a build outside [25%, 45%], or spread > 15%): the per-lap noise reduction removed too much (or the wrong amount of) final-result variance. Tune **only constants**, re-running `npx vitest run balance` after each change:
- Rates too *tight*/clustered or a build too low → race-total variance is too low → **raise `MOMENTUM_WEIGHT`** toward 0.7–0.75 (more carryover ⇒ higher cumulative variance), or as a fallback raise `LAP_NOISE_STD` toward 1.7–1.8 (costs some lap smoothness).
- Rates too *spread*/swingy → **lower `MOMENTUM_WEIGHT`** toward 0.5.
Iterate until the harness passes. Do not modify simulation logic — constants only.

- [ ] **Step 7: Commit**

```bash
git add src/core/constants.ts src/core/RaceEngine.ts tests/raceEngine.test.ts
git commit -m "feat(raceday): lower per-lap noise + AR(1) momentum (balance-preserving)"
```

---

### Task 2: Drafting / pack tow

**Files:**
- Modify: `src/core/constants.ts`
- Modify: `src/core/RaceEngine.ts`
- Test: `tests/raceEngine.test.ts`

**Interfaces:**
- Consumes: `DRAFT_RANGE`, `DRAFT_BONUS` from constants.
- Produces: `hasDraftTow(progress: number[], crashed: boolean[], i: number): boolean` (exported from `RaceEngine.ts`).

- [ ] **Step 1: Add constants**

In `src/core/constants.ts`, after the `MOMENTUM_WEIGHT` line, add:

```ts
export const DRAFT_RANGE = 2.0;       // progress-points: a trailing rider within this of someone ahead gets a tow
export const DRAFT_BONUS = 0.3;       // progress-points/lap tow for a rider with a non-crashed rider close ahead
```

- [ ] **Step 2: Write the failing test**

Append to `tests/raceEngine.test.ts` (extend the `'../src/core/RaceEngine'` import to add `hasDraftTow`):

```ts
describe('drafting tow (hasDraftTow)', () => {
  it('tows a trailing rider within range but not an isolated leader or a far-back rider', () => {
    const progress = [10, 9.5, 3];           // r0 leader, r1 0.5 behind, r2 7 behind
    const crashed = [false, false, false];
    expect(hasDraftTow(progress, crashed, 0)).toBe(false); // clear air ahead
    expect(hasDraftTow(progress, crashed, 1)).toBe(true);  // within DRAFT_RANGE of r0
    expect(hasDraftTow(progress, crashed, 2)).toBe(false); // out of range
  });
  it('gives no tow at exactly equal progress (strict ahead)', () => {
    expect(hasDraftTow([5, 5], [false, false], 0)).toBe(false);
    expect(hasDraftTow([5, 5], [false, false], 1)).toBe(false);
  });
  it('ignores crashed riders as tow providers and skips crashed receivers', () => {
    expect(hasDraftTow([10, 9.5], [false, true], 1)).toBe(false); // only rider ahead is crashed
    expect(hasDraftTow([9.5, 10], [true, false], 0)).toBe(false); // receiver crashed
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/raceEngine.test.ts`
Expected: FAIL — `hasDraftTow` is not exported.

- [ ] **Step 4: Implement the predicate + second pass in stepLap**

In `src/core/RaceEngine.ts`:

(a) Extend the constants import to add `DRAFT_RANGE, DRAFT_BONUS`.

(b) Add the exported predicate (next to `momentumNoise`):

```ts
// A rider gets a tow if at least one non-crashed rider is strictly ahead within DRAFT_RANGE.
export function hasDraftTow(progress: number[], crashed: boolean[], i: number): boolean {
  if (crashed[i]) return false;
  return progress.some((p, j) =>
    j !== i && !crashed[j] && p > progress[i] && p - progress[i] <= DRAFT_RANGE);
}
```

(c) At the END of `stepLap` (after the existing per-rider loop closes), add the second pass. It reads each rider's post-movement progress *before* any tow is applied, so tows don't cascade within one lap:

```ts
  // Drafting: a second pass over post-movement positions (pre-tow), so tows don't cascade.
  const preDraft = run.states.map((s) => s.progress);
  const crashed = run.states.map((s) => s.crashed);
  run.states.forEach((s, i) => {
    if (hasDraftTow(preDraft, crashed, i)) s.progress += DRAFT_BONUS;
  });
```

- [ ] **Step 5: Run the drafting tests**

Run: `npx vitest run tests/raceEngine.test.ts`
Expected: PASS (all raceEngine + momentum + drafting tests).

- [ ] **Step 6: Run the FULL suite — re-confirm balance**

Run: `npm test`
Expected: all green including the balance harness. Drafting applies a near-uniform small bonus and should be close to balance-neutral; if the harness drifts out of band, re-tune `MOMENTUM_WEIGHT`/`LAP_NOISE_STD` per Task 1 Step 6 guidance (do not touch `DRAFT_*` for balance — those control pack feel, verified visually in Task 3).

- [ ] **Step 7: Commit**

```bash
git add src/core/constants.ts src/core/RaceEngine.ts tests/raceEngine.test.ts
git commit -m "feat(raceday): drafting tow pulls trailing riders into packs"
```

---

### Task 3: Visual smoothness — verify (and only-if-needed tune) existing interpolation

**Files:**
- Modify (only if needed): `src/scenes/RaceScene.ts`

**Interfaces:** none (UI only).

> Context: `RaceScene` already interpolates every frame — `update()` calls `renderFrame(frac)` continuously, which lerps `prev→cur` by `frac` and applies an EMA (`EMA = 0.14`, `RaceScene.ts:164`). Do **not** add Phaser tweens; they would fight the per-frame loop. The lever, if any, is the existing `EMA` constant.

- [ ] **Step 1: Typecheck + suite (sanity after Tasks 1–2)**

Run: `npx tsc --noEmit && npm test`
Expected: clean + green.

- [ ] **Step 2: Browser-verify motion**

Run: `npm run dev`. Play a race at 1×, 2×, and 4×.
Expected: with the lower noise + momentum + drafting, dots glide smoothly, positions shift gradually (1–2 places/lap, not ±3–4), and riders visibly cluster into packs with occasional earned breakaways.

- [ ] **Step 3: Tune EMA only if motion looks wrong**

If dots look laggy/sluggish, raise `EMA` (e.g. 0.14 → 0.20) for snappier tracking; if they look jittery, lower it (e.g. → 0.10). Change only the `EMA` constant in `renderFrame`. Re-verify in the browser. If motion already looks good, make no change and skip to Step 4.

- [ ] **Step 4: Commit (only if you changed EMA)**

```bash
git add src/scenes/RaceScene.ts
git commit -m "tune(raceday): adjust dot interpolation EMA for smoother motion"
```

(If no change was needed, note that in your report and skip the commit.)

---

## Final verification

- [ ] `npm test` — full suite green, **including the balance harness** (record the printed `pace/corner/balanced` rates and `spread` in your report).
- [ ] `npm run build` — TypeScript + production build succeed.
- [ ] Browser playthrough confirms smooth motion, gradual position changes, and natural packs.
- [ ] Use superpowers:finishing-a-development-branch to present merge/PR options for the `race-stability` branch. Report the final balance numbers and whether `EMA` was changed.
```

## Spec coverage self-check

- Spec #1 (reduce noise) + #2 (momentum) → Task 1 (shipped together for balance). ✓
- Spec #3 (drafting) → Task 2. ✓
- Spec #4 (visual interpolation: verify existing, tune EMA, no tweens) → Task 3. ✓
- Spec verification (balance harness gate, momentum autocorrelation test, drafting convergence/strict-ahead test) → Task 1 Step 6 + Task 1 Step 2 + Task 2 Step 2. ✓
