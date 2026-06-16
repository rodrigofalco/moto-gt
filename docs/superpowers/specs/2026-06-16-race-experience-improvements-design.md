# Race Experience Improvements — Design Spec

**Status:** Approved · **Date:** 2026-06-16 · **Scope:** 4 QoL/clarity improvements, 2 new files + 6 edits, ~120 lines

---

## Problem

The V2 interactive build plays well, but several small rough edges blunt the experience:

1. The pre-race hub prints a text hint about which setup the track favors, yet always **defaults the selection to `handling`** — the player must re-read and re-pick every race.
2. The result screen has **no performance message** — finishing P2 and finishing P9 look the same except for a number, and crashes are marked only by a terse `' !'`.
3. The standings show raw points but **no gap-to-leader and no "races left"**, so the title fight is hard to read at a glance.
4. The race screen **resets the risk order to `Defend` every race**, ignoring the player's established preference.

None of these touch the simulation. They are presentation and quality-of-life only.

## Goal

Make each race's one real decision (setup + in-race risk) better-informed, and make the payoff (result + championship state) legible — without altering game balance.

## Non-Goals

- No change to the simulation, scoring, crash model, progression, or balance constants. The balance harness is untouched.
- No change to crashed-rider classification/points (the engine already classifies and awards points by final order; we only relabel it as `DNF`).
- No new pre-race decisions (weather, tires, etc.).

---

## Shared architecture decision

Two improvements need decision/messaging logic that must be **unit-testable without Phaser**. Add one small pure module:

- **`src/core/Advice.ts`** — pure functions, no Phaser import, no module state. Holds `recommendedSetup` (#1) and `resultHeadline` (#2).

This also removes an existing duplication: `SeasonScene` currently computes the "favored setup" hint inline (`SeasonScene.ts:28–32`). That logic moves into `recommendedSetup`, so the hint text and the new badge derive from one source and can never disagree.

The Phaser scenes stay thin: they call the pure helpers and render the returned strings.

---

## Improvement 1: Recommended-setup badge + smart default

### What
In the pre-race hub, highlight **and** pre-select the setup the track favors. The player can still override.

### How
- Add to `src/core/Advice.ts`:
  ```ts
  import type { Setup, TrackWeights } from './types';
  // speed→topSpeed, cornering→handling, acceleration→acceleration.
  // Mirrors the precedence already used by the inline hint (deterministic on ties).
  export function recommendedSetup(w: TrackWeights): Setup {
    if (w.speed >= w.cornering && w.speed >= w.acceleration) return 'topSpeed';
    if (w.cornering >= w.acceleration) return 'handling';
    return 'acceleration';
  }
  ```
- `SeasonScene`:
  - Replace the class-field default `private setup: Setup = 'handling'` — instead set `this.setup = recommendedSetup(track.weights)` in `create()` (before the selector is drawn, so `refreshSelectors()` highlights it for free).
  - Rewrite the inline hint (`SeasonScene.ts:28–32`) to derive its favored setup from `recommendedSetup` (single source of truth) rather than its own `>=` chain.
  - Draw a small gold tag — text `★ Recommended` — above the recommended setup's box (compute the box x from the index of `this.setup` in `SETUPS`).

### Edge cases
- Tie in weights: `>=` precedence makes it deterministic (favors `topSpeed`, then `handling`). Acceptable and matches the prior hint behavior.

### Verification
- Unit: `recommendedSetup` returns `topSpeed` / `handling` / `acceleration` for power / technical / stop-go weight profiles, including a tie case.
- Browser: opening the hub pre-selects and badges the favored setup; clicking another setup still works.

---

## Improvement 2: Result headline + DNF clarity

### What
A dynamic one-line headline on the result screen, a clear `DNF` label, and a season-summary crash count.

### How
- Add to `src/core/Advice.ts`:
  ```ts
  // racesLeft = calendar.length - currentRaceIndex AFTER this race is recorded.
  export function resultHeadline(
    position: number, crashed: boolean, champPosition: number, racesLeft: number,
  ): string { ... }
  ```
  Buckets (first match wins):
  - `crashed` → `Crashed out — finished P{position}.`
  - `position === 1` → `WIN! 🏆`
  - `position <= 3` → `Podium! P{position}.`
  - `position <= 10` → `P{position} — points scored.`
  - else → `P{position}.`
  - Championship tail appended when `racesLeft <= 2`: ` You're P{champPosition} in the title race.` (The result screen's headline path only runs for non-final races — the final race routes to the season-end view — so `racesLeft >= 1` here.)
- `RaceResultScene.create()` (non-season-end path): render the headline under the `Results —` title. Source values from `this.result.finishingOrder` (player entry → `position`, `crashed`), `getStandings(season)` (champ position), and `racesLeft = season.calendar.length - season.currentRaceIndex`.
- Finishing list: change the crash marker from `' !'` to `' DNF'` (and pad the non-crash case to keep column alignment).
- Season-end summary (`RaceResultScene.ts:68`): append `| DNFs {n}`, where `n = season.raceResults.filter(r => r.finishingOrder.find(e => e.rider.isPlayer)?.crashed).length`. No new state.

### Edge cases
- `champPosition` for the headline tail uses standings order; player always present.
- Season-end path is separate (`renderSeasonEnd`) and only gets the DNF count, not the per-race headline.

### Verification
- Unit: `resultHeadline` returns the correct string for each bucket (win, podium, points, out-of-points, crash) and appends the title tail only when `racesLeft <= 2`.
- Browser: headline reflects actual finish; crashes read `DNF`; season summary shows DNF count.

---

## Improvement 3: Standings gap-to-leader + races-left

### What
Show `+N` points behind the leader per row, and a `Races left: N` header, in both the hub and the result screen.

### How
- `src/ui/StandingsTable.ts`: extend the signature to
  `renderStandings(scene, x, y, riders, opts?: { showGap?: boolean })`.
  When `opts.showGap`, append `  +{leaderPoints - r.points}` to each row except the leader (leader row gets blank padding). `leaderPoints = riders[0].points` (already sorted by `getStandings`). Default (no opts) is byte-identical to today, so existing callers are unaffected.
- `SeasonScene`: call with `{ showGap: true }`; add a `Races left: ${calendar.length - currentRaceIndex}` text near the "Standings" header.
- `RaceResultScene`: its mid-season standings use a separate `renderStandingsWithArrows` render path — add the same `+N` gap column there, and a `Races left` header. (Season-end uses `renderStandings`; pass `{ showGap: true }` there too.)

### Edge cases
- Leader: no `+0`, blank instead.
- Ties on points: gap is `0` for co-equal non-leaders; acceptable (they're sorted by countback already).
- "Races left" at the hub counts the upcoming race inclusively (`length - currentRaceIndex`); at the result screen `currentRaceIndex` has already been incremented, so it naturally shows races still to come.

### Verification
- Browser: hub and result standings show `+N` gaps and a correct `Races left` count that decrements across the season; leader shows no gap.
- (Gap math is trivial arithmetic rendered in Phaser; no unit test required, consistent with the project's "browser-verify UI" rule.)

---

## Improvement 4: Persist risk default

### What
Remember the player's last Attack/Defend/Settle choice as the default for the next race.

### How
- `types.ts`: add **optional** `lastRisk?: Risk` to `SeasonState` (optional → no existing test fixture that builds a `SeasonState` literal breaks).
- `SeasonFactory.createSeason`: initialize `lastRisk: 'medium'` in the returned object.
- `RaceScene.init`: set `this.order = this.sd.season.lastRisk ?? 'medium'` (replacing the hard-coded `'medium'`).
- `RaceScene` order radio handler (`RaceScene.ts:88`): after `this.order = o.risk`, also write `this.sd.season.lastRisk = o.risk` so the preference persists immediately and survives to the next race.

### Edge cases
- A fresh season with no `lastRisk` (e.g. older in-memory state) falls back to `'medium'` via `??`.

### Verification
- Browser: set risk to Attack in race 1; race 2 opens with Attack pre-selected.

---

## Affected Files

| File | Change |
|---|---|
| `src/core/Advice.ts` | **New.** Pure `recommendedSetup` (#1) and `resultHeadline` (#2). |
| `src/scenes/SeasonScene.ts` | Default setup to recommendation + `★ Recommended` badge; hint derives from helper; standings `showGap` + `Races left` header. |
| `src/scenes/RaceResultScene.ts` | Result headline; `DNF` label; season-summary DNF count; standings gap + `Races left`. |
| `src/ui/StandingsTable.ts` | Optional `{ showGap }` to render a gap-to-leader column. |
| `src/core/types.ts` | Optional `lastRisk?: Risk` on `SeasonState`. |
| `src/core/factories/SeasonFactory.ts` | Initialize `lastRisk: 'medium'`. |
| `src/scenes/RaceScene.ts` | Read/write `season.lastRisk` for the risk default. |
| `tests/advice.test.ts` | **New.** Unit tests for `recommendedSetup` and `resultHeadline`. |

## Verification Criteria

1. `npm test` — new `advice.test.ts` passes and there are **no regressions** (presentation-only changes; the optional `lastRisk` field and the default-off `showGap` opt keep existing fixtures and callers valid). Run the suite; do not assert a fixed test count.
2. Balance untouched: no simulation/constant changes, so the balance harness behaves exactly as before.
3. Browser (`npm run dev`, play a season): (a) hub pre-selects + badges the favored setup and is overridable; (b) result screen shows a fitting headline and `DNF` labels, season summary shows a DNF count; (c) standings show `+N` gaps and a decrementing `Races left`; (d) risk order carries over between races.
