# Race Experience Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four small presentation/QoL improvements — recommended-setup badge, dynamic result headline + DNF clarity, standings gap-to-leader, and a persisted risk default — without touching the simulation or balance.

**Architecture:** Decision/messaging logic lives in one new pure module (`src/core/Advice.ts`, no Phaser, no state) that is unit-tested directly; the Phaser scenes stay thin and just render the returned strings. UI-only changes are verified by TypeScript typecheck + the existing test suite (no regressions) + manual browser check, consistent with this project's rule that UI changes must be browser-verified.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest.

## Global Constraints

- No change to the simulation, scoring, crash model, progression, or balance constants. The balance harness must behave exactly as before.
- No change to crashed-rider classification or points — only the visible label changes (`' !'` → `' DNF'`).
- New `core/Advice.ts` must have zero Phaser imports and no module-level mutable state (keep it pure and testable).
- Backward compatibility: the new `SeasonState.lastRisk` field is **optional**, and `renderStandings`'s gap column is **opt-in** — existing test fixtures and callers must keep compiling and passing unchanged.
- Setup ↔ weight mapping is fixed: `speed→topSpeed`, `cornering→handling`, `acceleration→acceleration`.
- Test runner: `npx vitest run <file>` for one file, `npm test` for the whole suite. Typecheck: `npx tsc --noEmit`.

---

### Task 1: `recommendedSetup` pure helper

**Files:**
- Create: `src/core/Advice.ts`
- Test: `tests/advice.test.ts`

**Interfaces:**
- Consumes: `Setup`, `TrackWeights` from `src/core/types.ts` (`TrackWeights = { speed: number; cornering: number; acceleration: number }`; `Setup = 'topSpeed' | 'handling' | 'acceleration'`).
- Produces: `recommendedSetup(w: TrackWeights): Setup` — returns the setup favored by the dominant track weight, deterministic on ties (favors `topSpeed`, then `handling`).

- [ ] **Step 1: Write the failing test**

Create `tests/advice.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recommendedSetup } from '../src/core/Advice';

describe('recommendedSetup', () => {
  it('picks topSpeed for a power track', () => {
    expect(recommendedSetup({ speed: 0.55, cornering: 0.25, acceleration: 0.20 })).toBe('topSpeed');
  });
  it('picks handling for a technical track', () => {
    expect(recommendedSetup({ speed: 0.20, cornering: 0.60, acceleration: 0.20 })).toBe('handling');
  });
  it('picks acceleration for a stop-go track', () => {
    expect(recommendedSetup({ speed: 0.20, cornering: 0.30, acceleration: 0.50 })).toBe('acceleration');
  });
  it('breaks ties toward topSpeed then handling', () => {
    expect(recommendedSetup({ speed: 0.40, cornering: 0.40, acceleration: 0.20 })).toBe('topSpeed');
    expect(recommendedSetup({ speed: 0.20, cornering: 0.40, acceleration: 0.40 })).toBe('handling');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/advice.test.ts`
Expected: FAIL — cannot find module `../src/core/Advice` (or `recommendedSetup` is not a function).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/Advice.ts`:

```ts
import type { Setup, TrackWeights } from './types';

// speed→topSpeed, cornering→handling, acceleration→acceleration.
// `>=` precedence makes ties deterministic (topSpeed, then handling).
export function recommendedSetup(w: TrackWeights): Setup {
  if (w.speed >= w.cornering && w.speed >= w.acceleration) return 'topSpeed';
  if (w.cornering >= w.acceleration) return 'handling';
  return 'acceleration';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/advice.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/Advice.ts tests/advice.test.ts
git commit -m "feat(core): add recommendedSetup advice helper"
```

---

### Task 2: `resultHeadline` pure helper

**Files:**
- Modify: `src/core/Advice.ts`
- Test: `tests/advice.test.ts`

**Interfaces:**
- Consumes: nothing new (plain number/boolean args).
- Produces: `resultHeadline(position: number, crashed: boolean, champPosition: number, racesLeft: number): string` — a short one-line race summary; appends a championship tail when `racesLeft <= 2`.

- [ ] **Step 1: Write the failing test**

Append to `tests/advice.test.ts`:

```ts
import { resultHeadline } from '../src/core/Advice';

describe('resultHeadline', () => {
  it('celebrates a win', () => {
    expect(resultHeadline(1, false, 1, 5)).toBe('WIN! 🏆');
  });
  it('marks a podium', () => {
    expect(resultHeadline(3, false, 2, 5)).toBe('Podium! P3.');
  });
  it('notes a points finish', () => {
    expect(resultHeadline(7, false, 4, 5)).toBe('P7 — points scored.');
  });
  it('reports a crash', () => {
    expect(resultHeadline(8, true, 5, 5)).toBe('Crashed out — finished P8.');
  });
  it('appends the title tail late in the season', () => {
    expect(resultHeadline(2, false, 1, 2)).toBe("Podium! P2. You're P1 in the title race.");
  });
  it('omits the title tail early in the season', () => {
    expect(resultHeadline(2, false, 1, 3)).toBe('Podium! P2.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/advice.test.ts`
Expected: FAIL — `resultHeadline` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core/Advice.ts`:

```ts
// racesLeft = calendar.length - currentRaceIndex (after this race is recorded).
export function resultHeadline(
  position: number, crashed: boolean, champPosition: number, racesLeft: number,
): string {
  let head: string;
  if (crashed) head = `Crashed out — finished P${position}.`;
  else if (position === 1) head = 'WIN! 🏆';
  else if (position <= 3) head = `Podium! P${position}.`;
  else if (position <= 10) head = `P${position} — points scored.`;
  else head = `P${position}.`;
  if (racesLeft <= 2) head += ` You're P${champPosition} in the title race.`;
  return head;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/advice.test.ts`
Expected: PASS (all `recommendedSetup` + `resultHeadline` tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/Advice.ts tests/advice.test.ts
git commit -m "feat(core): add resultHeadline advice helper"
```

---

### Task 3: Recommended-setup badge + smart default in `SeasonScene`

**Files:**
- Modify: `src/scenes/SeasonScene.ts`

**Interfaces:**
- Consumes: `recommendedSetup` (Task 1), `SETUPS` (already imported from `../core/constants`, value `['topSpeed', 'handling', 'acceleration']`).
- Produces: none (UI only).

- [ ] **Step 1: Add the import**

At the top of `src/scenes/SeasonScene.ts`, after the existing `import { SETUPS } from '../core/constants';` line, add:

```ts
import { recommendedSetup } from '../core/Advice';
```

- [ ] **Step 2: Make the setup field assigned-in-create**

Change the class field (currently `private setup: Setup = 'handling';`) to:

```ts
private setup!: Setup;
```

- [ ] **Step 3: Default the selection to the recommendation**

In `create()`, immediately after `const track = this.season.calendar[idx];`, add:

```ts
this.setup = recommendedSetup(track.weights);
```

- [ ] **Step 4: Derive the hint text from the helper (single source of truth)**

Replace the inline hint block (the `const w = track.weights;` line and the `const hint = ...` ternary and its `this.add.text(40, 84, hint, ...)` call) with:

```ts
const HINT: Record<Setup, string> = {
  topSpeed: 'Power track → Top Speed setup favored',
  handling: 'Technical track → Handling setup favored',
  acceleration: 'Stop-go track → Acceleration setup favored',
};
this.add.text(40, 84, HINT[this.setup], { fontSize: '15px', color: '#00e5ff' });
```

- [ ] **Step 5: Draw the "★ Recommended" badge above the favored box**

In `create()`, immediately after the `SETUPS.forEach(...)` block that builds `this.setupBoxes` (and before `this.refreshSelectors();`), add:

```ts
const recIdx = SETUPS.indexOf(this.setup);
this.add.text(130 + recIdx * 200, 298, '★ Recommended', { fontSize: '13px', color: '#f5c518' }).setOrigin(0.5);
```

(`refreshSelectors()` already highlights `this.setup`, so the box is pre-selected for free.)

- [ ] **Step 6: Typecheck + regression suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all tests pass (no test changes in this task — this confirms the edits compile and break nothing).

- [ ] **Step 7: Browser-verify**

Run: `npm run dev`, open the app, start a season, reach the hub.
Expected: the setup matching the track's dominant weight is **pre-selected** (highlighted) and shows a gold **★ Recommended** tag above it; the cyan hint text names the same setup; clicking a different setup still selects it normally.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/SeasonScene.ts
git commit -m "feat(season): pre-select and badge the track-recommended setup"
```

---

### Task 4: Standings gap-to-leader + races-left

**Files:**
- Modify: `src/ui/StandingsTable.ts`
- Modify: `src/scenes/SeasonScene.ts`
- Modify: `src/scenes/RaceResultScene.ts`

**Interfaces:**
- Consumes: `renderStandings(scene, x, y, riders, opts?)`.
- Produces: `renderStandings(scene: Phaser.Scene, x: number, y: number, riders: Rider[], opts?: { showGap?: boolean }): Phaser.GameObjects.Text` — when `opts.showGap`, appends a right-padded `+{leaderPoints - points}` column (blank for the leader). Default (no opts) renders identically to before.

- [ ] **Step 1: Add the opt-in gap column to `renderStandings`**

Replace the entire body of `src/ui/StandingsTable.ts` with:

```ts
import Phaser from 'phaser';
import type { Rider } from '../core/types';

export function renderStandings(
  scene: Phaser.Scene, x: number, y: number, riders: Rider[],
  opts: { showGap?: boolean } = {},
): Phaser.GameObjects.Text {
  const leaderPoints = riders[0]?.points ?? 0;
  const lines = riders.map((r, i) => {
    const tag = r.isPlayer ? '> ' : '  ';
    const base = `${tag}${String(i + 1).padStart(2)}. ${r.name.padEnd(18)} ${String(r.points).padStart(3)}`;
    if (!opts.showGap) return base;
    const gap = i === 0 ? '' : `+${leaderPoints - r.points}`;
    return `${base}  ${gap.padStart(4)}`;
  });
  return scene.add.text(x, y, lines.join('\n'), {
    fontFamily: 'monospace', fontSize: '16px', color: '#e0e0e0',
  });
}
```

- [ ] **Step 2: Run the suite to confirm the default path is unchanged**

Run: `npm test`
Expected: PASS — existing callers pass no `opts`, so output is byte-identical; nothing breaks.

- [ ] **Step 3: Turn on the gap + races-left header in `SeasonScene`**

In `src/scenes/SeasonScene.ts`, find the standings block:

```ts
this.add.text(720, 90, 'Standings', { fontSize: '20px', color: '#f5c518' });
renderStandings(this, 720, 120, getStandings(this.season));
```

Replace it with:

```ts
this.add.text(720, 64, `Races left: ${this.season.calendar.length - this.season.currentRaceIndex}`, { fontSize: '14px', color: '#94a3b8' });
this.add.text(720, 90, 'Standings', { fontSize: '20px', color: '#f5c518' });
renderStandings(this, 720, 120, getStandings(this.season), { showGap: true });
```

- [ ] **Step 4: Turn on the gap in `RaceResultScene` season-end standings**

In `src/scenes/RaceResultScene.ts`, in `renderSeasonEnd()`, change:

```ts
renderStandings(this, 400, 398, standings);
```

to:

```ts
renderStandings(this, 400, 398, standings, { showGap: true });
```

- [ ] **Step 5: Add the gap column + races-left header to the mid-season standings**

In `src/scenes/RaceResultScene.ts`, in `create()`, change:

```ts
this.add.text(620, 60, 'Standings', { fontSize: '20px', color: '#f5c518' });
this.renderStandingsWithArrows(620, 90);
```

to:

```ts
this.add.text(620, 36, `Races left: ${this.season.calendar.length - this.season.currentRaceIndex}`, { fontSize: '14px', color: '#94a3b8' });
this.add.text(620, 60, 'Standings', { fontSize: '20px', color: '#f5c518' });
this.renderStandingsWithArrows(620, 90);
```

Then in `renderStandingsWithArrows`, add a leader-points line after `const standings = getStandings(this.season);`:

```ts
const leaderPoints = standings[0]?.points ?? 0;
```

and change the `return` inside its `.map(...)` from:

```ts
return `${tag}${String(cur).padStart(2)} ${arrow} ${r.name.slice(0, 16).padEnd(16)} ${String(r.points).padStart(3)}`;
```

to:

```ts
const gap = i === 0 ? '' : `+${leaderPoints - r.points}`;
return `${tag}${String(cur).padStart(2)} ${arrow} ${r.name.slice(0, 16).padEnd(16)} ${String(r.points).padStart(3)}  ${gap.padStart(4)}`;
```

- [ ] **Step 6: Typecheck + regression suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 7: Browser-verify**

Run: `npm run dev`, play through ≥2 races.
Expected: hub and result standings show a `+N` gap column (leader blank), and a `Races left: N` header that decrements as the season progresses.

- [ ] **Step 8: Commit**

```bash
git add src/ui/StandingsTable.ts src/scenes/SeasonScene.ts src/scenes/RaceResultScene.ts
git commit -m "feat(standings): add gap-to-leader column and races-left header"
```

---

### Task 5: Result headline + DNF clarity

**Files:**
- Modify: `src/scenes/RaceResultScene.ts`

**Interfaces:**
- Consumes: `resultHeadline` (Task 2), `getStandings` (already imported).
- Produces: none (UI only).

- [ ] **Step 1: Add the import**

In `src/scenes/RaceResultScene.ts`, add near the other core imports:

```ts
import { resultHeadline } from '../core/Advice';
```

- [ ] **Step 2: Render the headline under the title**

In `create()` (the non-season-end path), immediately after:

```ts
this.add.text(40, 24, `Results — ${this.result.track.name}`, { fontSize: '24px', color: '#f5c518' });
```

add:

```ts
const pe = this.result.finishingOrder.find((e) => e.rider.isPlayer)!;
const champPos = getStandings(this.season).findIndex((r) => r.isPlayer) + 1;
const racesLeft = this.season.calendar.length - this.season.currentRaceIndex;
this.add.text(40, 52, resultHeadline(pe.position, pe.crashed, champPos, racesLeft), { fontSize: '18px', color: '#00e5ff' });
```

- [ ] **Step 3: Relabel crashes as DNF in the finishing list**

In the same `create()`, in the `this.result.finishingOrder.map((e) => {...})` block, change:

```ts
const crash = e.crashed ? ' !' : '  ';
```

to:

```ts
const crash = e.crashed ? ' DNF' : '    ';
```

- [ ] **Step 4: Add a DNF count to the season-end summary**

In `renderSeasonEnd()`, immediately before the `this.add.text(512, 118, ...)` summary line, add:

```ts
const dnfs = this.season.raceResults.filter((r) => r.finishingOrder.find((e) => e.rider.isPlayer)?.crashed).length;
```

and change that summary line from:

```ts
this.add.text(512, 118, `You finished P${pos} — ${p.points} pts | Wins ${p.positionCounts[0]} | Podiums ${p.positionCounts[0] + p.positionCounts[1] + p.positionCounts[2]}`, { fontSize: '15px', color: '#e0e0e0' }).setOrigin(0.5);
```

to:

```ts
this.add.text(512, 118, `You finished P${pos} — ${p.points} pts | Wins ${p.positionCounts[0]} | Podiums ${p.positionCounts[0] + p.positionCounts[1] + p.positionCounts[2]} | DNFs ${dnfs}`, { fontSize: '15px', color: '#e0e0e0' }).setOrigin(0.5);
```

- [ ] **Step 5: Typecheck + regression suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Browser-verify**

Run: `npm run dev`, play a full season including at least one race where the player crashes (use the Attack order repeatedly to raise crash odds).
Expected: each result screen shows a fitting cyan headline (win/podium/points/crash, with a title-race tail in the final two races); crashed riders read `DNF` in the finishing list; the season-end summary shows a `DNFs N` count.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/RaceResultScene.ts
git commit -m "feat(result): dynamic headline, DNF labels, season DNF count"
```

---

### Task 6: Persist risk default across races

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/factories/SeasonFactory.ts`
- Modify: `src/scenes/RaceScene.ts`
- Test: `tests/factories.test.ts`

**Interfaces:**
- Consumes: `Risk` type (already in `types.ts`).
- Produces: optional `SeasonState.lastRisk?: Risk`, initialized to `'medium'` by `createSeason`; read/written by `RaceScene`.

- [ ] **Step 1: Write the failing test**

In `tests/factories.test.ts`, add this case inside the `describe('factories', ...)` block (after the existing `createSeason` test):

```ts
it('createSeason seeds lastRisk to medium', () => {
  const s = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(2));
  expect(s.lastRisk).toBe('medium');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/factories.test.ts`
Expected: FAIL — `s.lastRisk` is `undefined`, not `'medium'`.

- [ ] **Step 3: Add the optional field to `SeasonState`**

In `src/core/types.ts`, inside the `SeasonState` interface, add a line after `isSeasonComplete: boolean;`:

```ts
  lastRisk?: Risk;           // player's last-used in-race order, carried between races
```

- [ ] **Step 4: Initialize it in the factory**

In `src/core/factories/SeasonFactory.ts`, change the returned object:

```ts
return { playerRider, aiRiders, calendar, currentRaceIndex: 0, raceResults: [], isSeasonComplete: false };
```

to:

```ts
return { playerRider, aiRiders, calendar, currentRaceIndex: 0, raceResults: [], isSeasonComplete: false, lastRisk: 'medium' };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/factories.test.ts`
Expected: PASS.

- [ ] **Step 6: Read the persisted risk as the race default**

In `src/scenes/RaceScene.ts`, in `init()`, change:

```ts
this.lapsDone = 0; this.acc = 0; this.speed = 1; this.order = 'medium'; this.done = false;
```

to:

```ts
this.lapsDone = 0; this.acc = 0; this.speed = 1; this.order = data.season.lastRisk ?? 'medium'; this.done = false;
```

- [ ] **Step 7: Write the chosen risk back when the player changes it**

In `src/scenes/RaceScene.ts`, in `create()`, find the order radio handler:

```ts
box.on('pointerup', () => { this.order = o.risk; this.refreshOrder(); });
```

and change it to:

```ts
box.on('pointerup', () => { this.order = o.risk; this.sd.season.lastRisk = o.risk; this.refreshOrder(); });
```

- [ ] **Step 8: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all tests pass (including the new factory test).

- [ ] **Step 9: Browser-verify**

Run: `npm run dev`. In race 1, set the order to **Attack**; finish the race; start race 2.
Expected: race 2 opens with **Attack** already selected (not Defend).

- [ ] **Step 10: Commit**

```bash
git add src/core/types.ts src/core/factories/SeasonFactory.ts src/scenes/RaceScene.ts tests/factories.test.ts
git commit -m "feat(raceday): persist player's risk order between races"
```

---

## Final verification

- [ ] Run the full suite once more: `npm test` — all green.
- [ ] Typecheck + production build: `npm run build` — no TypeScript errors, build succeeds.
- [ ] Full browser playthrough of one season confirming all four improvements together (setup badge, headline/DNF, gap/races-left, risk persistence).
