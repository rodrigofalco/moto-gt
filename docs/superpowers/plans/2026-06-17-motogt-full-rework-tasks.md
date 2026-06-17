# MotoGT — Overnight Task Plan (50 items for the coding agent)

_Date: 2026-06-17 · Design: `docs/superpowers/specs/2026-06-17-motogt-full-rework-design.md`_

## How to use this document (READ FIRST — for the coding agent)

You are implementing a full rework of MotoGT in **small, ordered steps**. Do **one item at a
time, top to bottom**. Each item is self-contained and tells you exactly which files to touch,
gives you the context you need, and tells you how to prove it works.

**Hard rules — never break these:**
1. **Do not break the existing game.** After every item, the app must still boot and play a
   season. The universal gate is: `npm run build` passes (no TypeScript errors).
2. **Pure logic goes in `src/core/` and never imports Phaser.** Only `src/scenes/` and `src/ui/`
   import Phaser. If you can test it with plain inputs/outputs, it belongs in `core/`.
3. **No `Math.random()` in deterministic simulation/gameplay core modules.** Anything that
   affects race outcomes, progression, economy, or off-season churn must use the seeded RNG
   (`src/core/RNG.ts`), threaded through function arguments, so tests are deterministic. This
   covers `RaceEngine`, `PerformanceModel`, `CrashModel`, `AIDecision`, `Progression`, `OffSeason`,
   `Qualifying`, `Tyres`, `Form`, `Rivalry`, `CostCurve`, `Economy`, and the factories.
   **Exempt:** `src/core/SoundEngine.ts` — its `Math.random()` is audio noise, never simulation.
   Do NOT change SoundEngine's noise generation.
4. **Keep all pilot skills and bike params as integers 1–10.** We fix balance with cost curves,
   not by rescaling. Do **not** edit `tests/balance.test.ts` to make something pass.
5. **New optional fields** on existing types must be optional (`field?: T`) or defaulted, so old
   code and old saved games keep working.

**Validation (every item says which apply):**
- **BUILD (always):** `npm run build` must succeed.
- **TEST:** `npm test` must be green. Add tests in `tests/<name>.test.ts` (vitest). Use a fixed
  `new RNG(123)` for determinism.
- **SCREENSHOT:** for visual items. Start the dev server (`npm run dev` in the background), then
  copy `tools/uiprobe.mjs` to `tools/probe-<feature>.mjs`, drive the UI to the new state, and
  `await page.screenshot({ path: '/tmp/<feature>.png' })`. The probe must log `PAGE ERRORS: none`.
  Open the screenshot and confirm the change is actually visible before marking done.

**Commit after each item** with a message like `feat(career): add CareerStore (P1.2)`.

**Key files you will refer to constantly:**
- Types: `src/core/types.ts` · Constants: `src/core/constants.ts`
- Engine: `src/core/RaceEngine.ts` · Models: `PerformanceModel.ts`, `CrashModel.ts`
- Progression: `src/core/Progression.ts` · Standings: `src/core/Championship.ts`
- Factories: `src/core/factories/SeasonFactory.ts`, `RiderFactory.ts`
- Scenes: `src/scenes/{Boot,MainMenu,Season,Race,RaceResult}Scene.ts`
- UI: `src/ui/{Button,Card,StandingsTable}.ts` · RNG: `src/core/RNG.ts`

---

# PHASE 0 — Safety net & foundation

### P0.1 — Commit the current working tree as a clean baseline
**Goal:** Lock the in-progress audio + race-day scene changes so we build on a known-good commit.
**Files:** none (git only).
**Context:** The working tree has modified `src/main.ts`, `src/scenes/RaceScene.ts`,
`RaceResultScene.ts`, `SeasonScene.ts` and a new `src/core/SoundEngine.ts`. It ALSO has
local/generated artifacts that must NOT be committed: `.opencode/`, `.playwright-mcp/`, and probe
PNGs (e.g. `/tmp/*.png` or any `*.png` written into the repo).
**Steps:**
1. Run `npm run build` and `npm test`. If red, fix the smallest thing that makes them green first.
2. **Stage only the intended baseline source files — do NOT use `git add -A`:**
   ```
   git add src/main.ts src/scenes/RaceScene.ts src/scenes/RaceResultScene.ts \
           src/scenes/SeasonScene.ts src/core/SoundEngine.ts
   ```
3. Commit: `git commit -m "chore: baseline race-day audio + scenes before rework (P0.1)"`.
4. Leave generated artifacts uncommitted. As a separate, optional follow-up commit, add them to
   `.gitignore` (e.g. lines `.opencode/`, `.playwright-mcp/`, `*.png`) — do this in its own commit,
   not mixed with the source baseline.
**Validate:** BUILD + TEST green; `git status` shows the 5 source files committed and the
generated artifacts still untracked (never staged).
**Done when:** the 5 baseline source files are committed and no generated artifact was added.

### P0.2 — Characterization test: a whole season plays start→finish
**Goal:** A safety net so later refactors can't silently break the season loop.
**Files:** `tests/career-baseline.test.ts` (new).
**Context:** `SeasonFactory.createSeason(team, pilot, brand, rng)` builds a `SeasonState`;
`RaceEngine.simulateRace(season, setup, risk, rng)` returns a `RaceResult`;
`Championship.applyRaceResult(season, result)` advances it; `season.isSeasonComplete` flips true
after `SEASON_RACE_COUNT` (6) races.
**Steps:** Write a test that creates a season (use `PILOT_ROSTER[0]`, `BRAND_ROSTER[0]`,
`new RNG(7)`), loops 6 races calling `simulateRace` + `applyRaceResult`, and asserts:
season completes, exactly 6 results, every result has 10 finishers, and `getChampion` returns a
rider. This documents current behavior.
**Validate:** TEST green.
**Done when:** the new test passes and fails if you delete a race from the loop.

### P0.3 — Central theme tokens (`src/ui/theme.ts`)
**Goal:** One place for the colors/fonts currently hardcoded as hex across scenes.
**Files:** `src/ui/theme.ts` (new). Do NOT yet change scenes (that's P4.1).
**Context:** Colors in use today: gold `#f5c518`/`0xf5c518`, cyan `#00e5ff`, bg `#1a1a2e`,
panel `#16213e`, border `#0f3460`, green `#00c853`, red `#e94560`, text `#e0e0e0`, muted
`#94a3b8`. Brand colors live in `constants.ts` `BRAND_COLORS`.
**Steps:** Export a `THEME` object with named string colors (for text) and number colors (for
Phaser fills), plus font sizes (`h1`,`h2`,`body`,`mono`). Add a helper `hex(n: number): string`.
**Validate:** BUILD passes; `import { THEME } from '../ui/theme'` compiles in a scratch import.
**Done when:** `theme.ts` exists and builds.

### P0.4 — Shared formatting helpers (`src/core/format.ts`)
**Goal:** Reusable display helpers used by many later items.
**Files:** `src/core/format.ts` (new), `tests/format.test.ts` (new).
**Context:** `formatLapTime` already lives in `src/core/raceView.ts` — leave it there.
**Steps:** Add pure functions: `ordinal(n)` → `"1st"`,`"2nd"`,`"3rd"`,`"4th"`;
`formatMoney(n)` → `"$1,250"`; `formatSigned(n)` → `"+3"`/`"-1"`. Write tests covering 1,2,3,4,11,
21,0 and negative money.
**Validate:** TEST green.
**Done when:** all format tests pass.

### P0.5 — Versioned localStorage helper (`src/core/persist.ts`)
**Goal:** A safe, single low-level read/write so every later save uses the same path.
**Files:** `src/core/persist.ts` (new), `tests/persist.test.ts` (new).
**Context:** Only `SoundEngine` touches `localStorage` today (key `moto-gt-muted`). Browser
`localStorage` isn't in node tests — guard access with `typeof localStorage !== 'undefined'`.
**Steps:** Export `loadJSON<T>(key, fallback): T` and `saveJSON(key, value): void` and
`clearKey(key)`, all wrapped in try/catch (return fallback on parse error or missing
`localStorage`). For tests, inject a tiny in-memory `localStorage` polyfill in the test file.
**Validate:** TEST green (round-trip save→load; corrupt value → fallback).
**Done when:** persist tests pass.

### P0.6 — Expand the rookie name pool (`src/data/names.ts`)
**Goal:** Enough unique names for off-season rookie generation later (P2.8).
**Files:** `src/data/names.ts`, `tests/data.test.ts` (extend).
**Context:** `RiderFactory.generateAIRiders` already pulls `AI_EXTRA_NAMES` from
`src/data/pilots.ts`. Check what `names.ts` currently exports before editing.
**Steps:** Ensure there is an exported pool of at least **40** unique first+last name strings
(add more if short). Add/extend a test asserting the pool has ≥40 entries and no duplicates.
**Validate:** TEST green.
**Done when:** name-pool test passes.

---

# PHASE 1 — Career spine & save

### P1.1 — Career & Tier types
**Goal:** The data model for a persistent career.
**Files:** `src/core/types.ts`.
**Context:** `SeasonState` already exists (playerRider, aiRiders, calendar, currentRaceIndex,
raceResults, isSeasonComplete, lastRisk).
**Steps:** Add interfaces (additively):
`Tier { id: string; name: string; aiStatBonus: number; order: number }`;
`CareerState { version: number; team: string; pilotArchetypeId: string; brandId: string;
tierId: string; seasonNumber: number; money: number; reputation: number; player: Rider;
field: Rider[]; season: SeasonState | null; }`. Export them.
**Validate:** BUILD passes.
**Done when:** types compile and are exported.

### P1.2 — CareerStore (create / save / load / clear)
**Goal:** Persist and restore a whole career.
**Files:** `src/core/CareerStore.ts` (new).
**Context:** Use `persist.ts` (P0.5). One key, e.g. `CAREER_KEY = 'moto-gt-career'`. Current
`CareerState.version = 1`.
**Steps:** Export `newCareer(team, pilot, brand, rng): CareerState` (builds player via
`createPlayerRider`, field via `generateAIRiders`, tier = first tier, money/reputation = starting
values, season = null); `saveCareer(c)`, `loadCareer(): CareerState | null` (returns null if
absent or `version` mismatched), `hasCareer(): boolean`, `clearCareer()`.
**Validate:** BUILD + (covered by P1.3).
**Done when:** functions exist and build.

### P1.3 — CareerStore tests
**Goal:** Prove round-trip + version safety.
**Files:** `tests/careerStore.test.ts` (new).
**Context:** Reuse the in-memory `localStorage` polyfill approach from P0.5's test.
**Steps:** Test: `newCareer` → `saveCareer` → `loadCareer` returns an equal-enough object
(same team, money, field length 9, player id `player`). Test: a stored object with
`version: 0` → `loadCareer()` returns null. Test: `clearCareer` then `hasCareer()` is false.
**Validate:** TEST green.
**Done when:** all three pass.

### P1.4 — Main menu: Continue vs New Career
**Goal:** Let a returning player resume.
**Files:** `src/scenes/MainMenuScene.ts`.
**Context:** Today `MainMenuScene` always shows pilot/brand selection then `start()` builds a
season directly. `CareerStore.hasCareer()` tells you if a save exists.
**Steps:** On `create()`, if `hasCareer()`, show two buttons at top: **CONTINUE CAREER** (loads
career and goes to `SeasonScene` with `season = career.season`, creating the first season if
null) and **NEW CAREER** (reveals the existing pilot/brand selection UI). If no save, show
selection as today. Keep selection code intact.
**Validate:** SCREENSHOT (`/tmp/menu-continue.png`) — with a save present, both buttons visible;
BUILD passes.
**Done when:** menu branches correctly and screenshot shows it.

### P1.5 — New-career flow writes a CareerState
**Goal:** Starting a season creates and persists the career.
**Files:** `src/scenes/MainMenuScene.ts`, `src/core/factories/SeasonFactory.ts`.
**Context:** `MainMenuScene.start()` currently calls `createSeason(...)` and starts SeasonScene
with `{ season }`. We now want the season to live inside a `CareerState`.
**Steps:** In `start()`, call `CareerStore.newCareer(team, pilot, brand, rng)`, then create the
first `SeasonState` from the career (add `SeasonFactory.createSeasonForCareer(career, rng)` that
builds the calendar and wires `career.player` + `career.field` as the riders), set
`career.season`, `saveCareer(career)`, and start `SeasonScene` with `{ career }`.
**IMPORTANT — per-season reset (used every season, critical from season 2 on):**
`createSeasonForCareer` reuses the *persistent* riders (`career.player`, `career.field`), so it
MUST reset their per-season championship fields before the season starts, or points/positions
carry over and standings break. For every rider it builds into the season:
- reset `points = 0` and `positionCounts = new Array(10).fill(0)`;
- reset any per-season race fields (e.g. clear `season.raceResults = []`, `currentRaceIndex = 0`,
  `isSeasonComplete = false`).
It must **preserve** long-term fields: `skills`, `bike`, `pilotXp`, `rndPoints`, `age`, `form`,
`rivalId`, and career-level `money`/`reputation`/`tierId` (those live on `CareerState`, not the
season). For season 1 the riders are fresh so the reset is a no-op; the test in P1.10 proves it
works for season 2.
**Validate:** SCREENSHOT (play into the hub) `/tmp/career-start.png`; BUILD passes;
`localStorage` has a career after starting (log it in the probe).
**Done when:** a new career is persisted and the hub loads from it.

### P1.6 — Autosave after every race
**Goal:** A career survives a reload mid-season.
**Files:** `src/scenes/RaceResultScene.ts` (and `SeasonScene.ts` if it now holds `career`).
**Context:** Scenes currently pass `{ season }`. After P1.5 they pass `{ career }` (with
`career.season`). `applyRaceResult` mutates the season in place.
**Steps:** Thread `career` through `SeasonScene → RaceScene → RaceResultScene` instead of bare
`season` (use `career.season` everywhere a season is read). After `applyRaceResult` in
`RaceScene.finish()`, call `CareerStore.saveCareer(career)`. On "NEXT RACE" keep passing `career`.
**Validate:** SCREENSHOT + manual: in the probe, after one race reload the page and CONTINUE —
the standings reflect the completed race. BUILD + TEST green.
**Done when:** mid-season reload restores progress.

### P1.7 — OffSeason report (no churn yet)
**Goal:** The seam where seasons chain.
**Files:** `src/core/OffSeason.ts` (new), `tests/offSeason.test.ts` (new), `types.ts`
(`OffSeasonReport`).
**Context:** A season ends when `season.isSeasonComplete`. Final standings via
`Championship.getStandings(season)`.
**Steps:** Add `OffSeasonReport { previousSeason: number; playerFinish: number; champion: string;
promoted: boolean; retired: string[]; rookies: string[]; statChanges: {riderId:string;
note:string}[] }`. Implement `runOffSeason(career, rng): OffSeasonReport` that for now only:
records `playerFinish`, increments `career.seasonNumber`, clears `career.season = null`, and
returns a report with empty churn arrays. Test the finish position and season increment.
**Validate:** TEST green.
**Done when:** off-season test passes.

### P1.8 — OffSeasonScene
**Goal:** A screen between seasons.
**Files:** `src/scenes/OffSeasonScene.ts` (new), register it in `src/config.ts` scene list.
**Context:** `RaceResultScene.renderSeasonEnd()` currently ends with a "PLAY AGAIN" → MainMenu
button. We instead route the season-end to the off-season.
**Steps:** Build a scene that takes `{ career, report }`, shows season number, your finish,
champion, and (later) churn lists, with a **START NEXT SEASON** button that creates the next
`SeasonState` (`createSeasonForCareer`), saves, and starts `SeasonScene`. In
`RaceResultScene.renderSeasonEnd`, replace PLAY AGAIN with a button that calls
`runOffSeason(career, rng)` and starts `OffSeasonScene`.
**Validate:** SCREENSHOT `/tmp/offseason.png` (drive a full 6-race season; for speed temporarily
lower `SEASON_RACE_COUNT`? No — instead use SKIP each race). BUILD passes.
**Done when:** finishing a season shows the off-season screen and next season starts.

### P1.9 — Tiers data + promotion check
**Goal:** Give the career an arc.
**Files:** `src/data/tiers.ts` (new), `src/core/OffSeason.ts`, `tests/offSeason.test.ts`.
**Context:** `CareerState.tierId` (P1.1). Tier raises AI strength via `aiStatBonus`.
**Steps:** Define 3 tiers in `tiers.ts`: Rookie (`aiStatBonus 0`), Pro (`+1`), Factory (`+2`).
In `runOffSeason`, if `playerFinish <= 3` and not already top tier, set `career.tierId` to the
next tier and `report.promoted = true`. (AI bonus is *applied* when generating the field in
P2.8/P3 — for now just set the tier.) Test: a top-3 finish promotes; a P8 finish does not.
**Validate:** TEST green; BUILD passes.
**Done when:** promotion logic is tested.

### P1.10 — Multi-season reset test
**Goal:** Prove season 2 starts clean but keeps long-term progress.
**Files:** `tests/seasonReset.test.ts` (new); depends on P1.5 (`createSeasonForCareer`).
**Context:** `createSeasonForCareer(career, rng)` reuses persistent riders and must reset
per-season championship fields while preserving long-term ones (see P1.5 "per-season reset").
**Steps:** Build a career, run season 1 to completion (award some points and bump a stat — e.g.
set `career.player.points = 80`, `career.player.skills.pace += 1`, give `rndPoints`), then call
`runOffSeason` (clears `career.season`) and `createSeasonForCareer` for season 2. Assert on the
season-2 riders: `points === 0` and `positionCounts` is all zeros, season `currentRaceIndex === 0`,
`raceResults.length === 0`, `isSeasonComplete === false`. Assert preserved: the upgraded
`skills.pace`, `bike`, `pilotXp`/`rndPoints`, and that `career.money`/`tierId` are untouched.
**Validate:** TEST green.
**Done when:** the test passes and fails if the reset is removed.

---

# PHASE 2 — Progression & economy rebalance (the stat-cap fix)

### P2.1 — Cost-curve module
**Goal:** Make high stats expensive (diminishing returns), per design §5.
**Files:** `src/core/CostCurve.ts` (new), `src/core/constants.ts` (add growth constants),
`tests/costCurve.test.ts` (new).
**Context:** Today pilot level cost is flat `PILOT_XP_PER_LEVEL = 25`; bike upgrade is a flat 1
R&D point (`Progression.investBikePoint`).
**Steps:** Add constants `PILOT_COST_GROWTH = 0.6`, `BIKE_COST_GROWTH = 0.5`, `BIKE_UPGRADE_BASE
= 2`. Export `pilotLevelCost(currentStat)` = `Math.round(PILOT_XP_PER_LEVEL * (1 +
PILOT_COST_GROWTH * (currentStat - 1)))` and `bikeUpgradeCost(currentParam)` = `Math.round(
BIKE_UPGRADE_BASE * (1 + BIKE_COST_GROWTH * (currentParam - 1)))`. Test monotonic increase and
that cost at stat 9 ≫ cost at stat 2.
**Validate:** TEST green.
**Done when:** cost-curve tests pass.

### P2.2 — Apply pilot cost curve in Progression
**Goal:** Pilot leveling slows near the top.
**Files:** `src/core/Progression.ts`, `tests/progression.test.ts` (extend).
**Context:** `applyProgression` currently does `while (rider.pilotXp >= PILOT_XP_PER_LEVEL)` and
spends a flat 25. The skill chosen is `pickSkillToLevel`.
**Steps:** Replace the flat threshold with `pilotLevelCost(rider.skills[skill])` for the skill
about to be raised: peek the next skill, compare XP to its scaled cost, subtract that cost on
level-up. Keep the "no skill left to raise" break. Extend tests: a rider at high skills needs far
more XP per point than a low-skill rider.
**Validate:** TEST green (including existing progression tests).
**Done when:** leveling uses the curve and tests pass.

### P2.3 — Apply bike cost curve to R&D spend
**Goal:** Maxing the bike takes most of a career.
**Files:** `src/core/Progression.ts`, `src/scenes/SeasonScene.ts`, `tests/progression.test.ts`.
**Context:** `investBikePoint(rider, param)` spends exactly 1 point. The hub (`SeasonScene`) shows
`[+] speed/handling/acceleration` and `Development points: N`.
**Steps:** Change `investBikePoint` to cost `bikeUpgradeCost(rider.bike[param])` points: only
upgrade if `rider.rndPoints >= cost && bike[param] < 10`; subtract `cost`. Update the AI auto-spend
loop (`weakestParam`) to respect the new cost. In `SeasonScene.refreshBike`, show the cost of the
next upgrade per axis (e.g. `[+] speed (3)`). Update tests.
**Validate:** TEST green; SCREENSHOT `/tmp/hub-costs.png` shows per-axis costs; BUILD passes.
**Done when:** R&D respects scaled cost in logic and UI.

### P2.4 — Anti-cap regression test
**Goal:** Prove the "maxes out in 2 seasons" bug is fixed.
**Files:** `tests/progression-cap.test.ts` (new).
**Context:** Simulate progression across multiple seasons using `applyProgression` with realistic
per-race XP/R&D.
**Steps:** Drive ~2 seasons (12 races) of `applyProgression` for a mid-tier rider finishing ~mid
pack; assert that **not all** pilot skills reach 10 and the bike is **not** fully maxed after 2
seasons (i.e. growth still remains). Also assert at least *some* growth happened (curve isn't so
steep it's static).
**Validate:** TEST green.
**Done when:** the cap test passes (fails if you revert P2.2/P2.3).

### P2.5 — Money wallet + prize table
**Goal:** Introduce economy.
**Files:** `src/core/Economy.ts` (new), `src/core/constants.ts`, `tests/economy.test.ts` (new).
**Context:** `CareerState.money` exists (P1.1). Points table is `POINTS_TABLE` in constants.
**Steps:** Add `PRIZE_MONEY: readonly number[]` (per finishing position 1..10, e.g.
`[5000,3500,2500,1800,1300,1000,700,500,300,150]`) and `STARTING_MONEY = 2000`. Export
`prizeFor(position): number` in `Economy.ts`. Test bounds (pos 1 highest, pos > 10 → 0).
**Validate:** TEST green.
**Done when:** economy module tested.

### P2.6 — Award & spend money
**Goal:** Make money flow.
**Files:** `src/scenes/RaceScene.ts` (or RaceResult), `src/scenes/SeasonScene.ts`,
`src/core/Economy.ts`.
**Context:** Player finishing position is in `result.finishingOrder` (`e.rider.isPlayer`).
R&D currently uses `rndPoints`. We add money as a *second* currency the player can convert to R&D
or save (keep it simple: money buys R&D points in the hub).
**Steps:** After a race, add `prizeFor(playerPosition)` to `career.money`. In `SeasonScene` show
`Money: $X` and add a **BUY R&D POINT ($cost)** button that converts money→`rndPoints` at a fixed
rate (`RND_POINT_COST = 800`). Persist via `saveCareer`.
**Validate:** SCREENSHOT `/tmp/hub-money.png`; BUILD passes.
**Done when:** money is earned per race and spendable in the hub.

### P2.7 — Aging
**Goal:** Long careers manage decline, not just accumulation.
**Files:** `src/core/types.ts` (`Rider.age?`), `RiderFactory.ts`, `src/core/OffSeason.ts`,
`tests/offSeason.test.ts`.
**Context:** `runOffSeason` (P1.7) is the per-year hook.
**Steps:** Give riders an `age` (player starts ~22; AI random 20–32 in `RiderFactory`, threaded
via RNG). Add `PEAK_AGE = 30`. In `runOffSeason`, increment every rider's age; for riders past
`PEAK_AGE`, with a probability rising with age, decrement one random non-zero skill by 1 and add a
`statChanges` note. Use the seeded RNG. Test: an old rider can decline; a young one never does in
the same call with a fixed seed.
**Validate:** TEST green.
**Done when:** aging is deterministic and tested.

### P2.8 — Off-season churn: retire + rookies + AI growth
**Goal:** The field evolves so the grid is never identical.
**Files:** `src/core/OffSeason.ts`, `RiderFactory.ts`, `tests/offSeason.test.ts`.
**Context:** Field is `career.field` (9 AI). Rookie names from `names.ts` (P0.6). Tier
`aiStatBonus` (P1.9). `generateAIRiders` shows how to build riders.
**Steps:** In `runOffSeason`: (1) retire the 1–2 oldest/weakest AI (push names to
`report.retired`); (2) generate that many **rookies** via a new `RiderFactory.createRookie(rng,
tierBonus)` with fresh names and tier-scaled stats (clamped 1–10), push to `report.rookies`;
(3) give surviving AI a small chance to +1 a random non-max skill (so they improve too). Keep
`career.field.length === 9`. Test field size invariant + that retired names leave and rookie names
enter.
**Validate:** TEST green.
**Done when:** churn keeps a 9-rider field that changes year to year.

### P2.9 — Wire churn into the OffSeasonScene
**Goal:** Show the player what changed.
**Files:** `src/scenes/OffSeasonScene.ts`.
**Context:** `OffSeasonReport` now has `retired`, `rookies`, `statChanges`, `promoted`.
**Steps:** Render lists: "Retired: …", "New rookies: …", "Promoted to <tier>!" (if any), and a
few notable stat changes. Next season's `createSeasonForCareer` must use the churned
`career.field`.
**Validate:** SCREENSHOT `/tmp/offseason-churn.png`; BUILD passes.
**Done when:** the off-season screen reflects real churn and the next season uses the new field.

---

# PHASE 3 — Race-weekend depth

### P3.1 — Qualifying (logic)
**Goal:** Grid order earned, not fixed.
**Files:** `src/core/Qualifying.ts` (new), `tests/qualifying.test.ts` (new), `types.ts`
(`QualifyingResult`).
**Context:** `createRace` builds `states` from `[player, ...ai]` in roster order; `progress`
starts at 0 for all. `weightedBase(axes, track)` is each rider's pace.
**Steps:** Export `runQualifying(riders, track, setup, rng): QualifyingResult` = a one-shot
pace + small noise sort producing a grid order (array of riderIds, fastest first). Pure, seeded.
Test: faster riders tend to qualify ahead; output length == field size; deterministic per seed.
**Validate:** TEST green.
**Done when:** qualifying produces a sensible deterministic grid.

### P3.2 — Apply grid as a small race-start offset
**Goal:** Grid position matters at lights-out.
**Files:** `src/core/RaceEngine.ts`, `src/core/constants.ts`, `tests/raceEngine.test.ts`.
**Context:** In `createRace`, all `progress` start at 0. The race-day view already draws a start
grid visually; here we give a tiny mechanical head start.
**Steps:** Accept an optional `grid?: string[]` (riderId order) in `createRace`. Add
`GRID_SPACING = 0.15` progress units; set each rider's starting `progress = (fieldSize - gridPos)
* GRID_SPACING`. Keep behavior identical when `grid` is undefined. Test that a front-row rider
starts with more progress.
**Validate:** TEST green; BUILD passes (callers still work without grid).
**Done when:** grid offset works and is backward compatible.

### P3.2b — Run qualifying and feed the grid into the race
**Goal:** Actually use P3.1 + P3.2 — without this, qualifying logic is dead code.
**Files:** `src/scenes/SeasonScene.ts` (run + display), `src/scenes/RaceScene.ts` /
`SeasonScene.simulate()` (pass the grid), uses `Qualifying.runQualifying` (P3.1) and the
`createRace(season, setup, rng, grid)` grid param (P3.2).
**Context:** Today `SeasonScene.simulate()` does `createRace(this.season, this.setup, rng)` then
starts `RaceScene`. The grid currently equals roster order (player first). We replace that with the
qualifying result.
**Steps:**
1. In the hub flow (when the player commits to the race), call
   `runQualifying([player, ...ai], track, setup, rng)` to get the grid order (riderId array).
2. Store it on the run/season (e.g. pass alongside `run`) and **display it**: show a short
   "Starting grid" list on the hub (or a brief grid panel) so the player sees where they start.
3. Pass the grid into `createRace(season, setup, rng, grid)` so P3.2's offset applies, and make
   the race-day numbered dots / start positions reflect the qualified order.
**Validate:** SCREENSHOT `/tmp/qualifying.png` showing the starting grid (player not always P1);
BUILD passes; TEST green.
**Done when:** qualifying runs each race, the grid is shown, and `createRace` receives it.

### P3.3 — Weather generation
**Goal:** Variety + strategy.
**Files:** `src/core/types.ts` (`Weather = 'dry' | 'wet'`), `SeasonFactory.ts`,
`tests/factories.test.ts`.
**Context:** `createSeasonForCareer`/`createSeason` build the calendar of 6 tracks.
**Steps:** When building the season, roll a `Weather` per race (e.g. 25% wet) with the seeded RNG;
store as `season.weatherByRace: Weather[]` (add to `SeasonState`, optional). Test the array length
matches the calendar and is deterministic per seed.
**Validate:** TEST green.
**Done when:** each race has deterministic weather.

### P3.4 — Weather affects the sim
**Goal:** Wet flips the calculus.
**Files:** `src/core/CrashModel.ts`, `src/core/PerformanceModel.ts` (or RaceEngine where setup is
applied), `tests/crash.test.ts`.
**Context:** `crashProbability(risk, consistency, track)` and `applySetup` are the levers.
Pass weather down from `createRace` (it knows `season` + race index).
**Steps:** Add an optional `weather` param to `crashProbability` (wet multiplies crash chance by
e.g. `WET_CRASH_MULT = 1.4`) and make **handling** setup relatively stronger in the wet (small
bonus) while **topSpeed** is relatively weaker. Keep dry behavior byte-identical (default param =
`'dry'`). Test wet > dry crash prob for the same inputs.
**Validate:** TEST green; balance test still green (dry path unchanged).
**Done when:** weather changes wet outcomes without touching dry balance.

### P3.5 — Weather UI
**Goal:** Tell the player it's wet.
**Files:** `src/scenes/SeasonScene.ts`, `src/scenes/RaceScene.ts`.
**Context:** Hub shows track focus + setup hint; race day has a header.
**Steps:** Show a ☀️/🌧️ badge + label on the hub (next to track name) and on the race-day header.
When wet, update the setup hint text to recommend Handling.
**Validate:** SCREENSHOT `/tmp/weather.png` (force a wet race by seeding); BUILD passes.
**Done when:** weather is visible on hub and race day.

### P3.6 — Tyres (logic + wear)
**Goal:** A real in-race strategy lever.
**Files:** `src/core/types.ts` (`TyreChoice = 'soft'|'medium'|'hard'`), `src/core/Tyres.ts` (new),
`src/core/RaceEngine.ts`, `tests/tyres.test.ts` (new).
**Context:** `stepLap` advances each rider per lap; pace = `meanPace + FIELD_COMPRESSION * dev`.
**Steps:** In `Tyres.ts` export `tyrePaceModifier(choice, lapFraction)`: soft = fast early, drops
off after ~60% distance; hard = slower early, steady; medium = between. Apply the player's choice
as a small additive term in `stepLap` (thread `tyre` + `lap/RACE_LAPS` in). AI pick a default
(medium). Keep effect modest so balance stays sane. Test: soft beats hard early, hard beats soft
late.
**Validate:** TEST green; balance test green.
**Done when:** tyre wear curve works and is tested.

### P3.7 — Tyre selector UI + wear readout
**Goal:** Let the player choose and see wear.
**Files:** `src/scenes/SeasonScene.ts` (choose), `src/scenes/RaceScene.ts` (readout).
**Context:** Hub already has a Setup selector pattern (`setupBoxes`); copy it for tyres.
**Steps:** Add a Soft/Medium/Hard selector to the hub, stored on the season/career and passed into
the race. On race day, show a simple wear bar/percent that drops over the laps.
**Validate:** SCREENSHOT `/tmp/tyres.png`; BUILD passes.
**Done when:** tyre choice is selectable and wear is visible.

### P3.8 — Rivalry / nemesis
**Goal:** A personal story hook.
**Files:** `src/core/types.ts` (`Rider.rivalId?`), `src/core/Rivalry.ts` (new),
`tests/rivalry.test.ts` (new), `src/scenes/RaceResultScene.ts`.
**Context:** Field is stable within a career (P2.8 only churns at season end).
**Steps:** `assignRival(player, field, rng)` picks a nemesis (e.g. closest in standings or random
at career start); store `player.rivalId`. `beatRival(result, player): boolean` checks if the
player finished ahead of the rival. On the result screen, add a one-line callout ("You beat your
rival!" / "Your rival got you this time."). Optional small reputation bonus for beating them.
Test `beatRival` both ways.
**Validate:** TEST green; SCREENSHOT `/tmp/rival.png`; BUILD passes.
**Done when:** a rival is assigned and called out post-race.

### P3.9 — Pilot form / morale
**Goal:** Momentum across races.
**Files:** `src/core/types.ts` (`Rider.form?`), `src/core/Form.ts` (new), `Progression.ts` or a
hook after results, `tests/form.test.ts` (new), `PerformanceModel.ts`.
**Context:** `form` is a small modifier (~-2..+2). It should nudge pace slightly, not dominate.
**Steps:** `updateForm(rider, finishPos, fieldSize)`: good results raise form, bad/DNF lower it,
clamped. In `baseAxes`/`weightedBase`, add a tiny `form` term (e.g. `+0.15 * form`) — keep it
small so balance is preserved (the balance harness uses neutral form = 0). Test form rises after a
win and falls after a DNF.
**Validate:** TEST green; balance test green (form defaults to 0).
**Done when:** form updates and lightly affects pace.

---

# PHASE 4 — Visual juice

### P4.1 — Apply theme tokens across scenes
**Goal:** One coherent palette; kill scattered hex.
**Files:** all `src/scenes/*.ts`, `src/ui/*.ts`; uses `src/ui/theme.ts` (P0.3).
**Context:** Many literals like `'#f5c518'`, `0x16213e` are repeated.
**Steps:** Replace hardcoded colors/fonts with `THEME.*`. Do it scene by scene; build after each.
No visual change intended — this is a refactor that *enables* later restyling.
**Validate:** SCREENSHOT `/tmp/theme-applied.png` (looks the same as before); BUILD passes.
**Done when:** scenes import from `theme.ts` and look unchanged.

### P4.2 — Motion trails on race-day dots
**Goal:** Speed read at a glance.
**Files:** `src/scenes/RaceScene.ts`.
**Context:** Dots are `Phaser.GameObjects.Arc` positioned each frame in `renderFrame` (the
`g.dot.setPosition(sx, sy)` loop). The player dot has a gold ring.
**Steps:** For each dot, keep a short history of recent positions and draw 2–3 fading
trailing circles (lower alpha) behind it, or use a faint line. Keep it cheap (reuse objects, don't
allocate per frame). Make trails subtle so the track stays readable.
**Validate:** SCREENSHOT `/tmp/trails.png`; probe logs `PAGE ERRORS: none`.
**Done when:** dots leave visible, smooth trails.

### P4.3 — Crash particle burst
**Goal:** Crashes feel like events.
**Files:** `src/scenes/RaceScene.ts`.
**Context:** A rider crash sets `s.crashed`; `renderFrame` already turns the dot red
(`0xff1744`) and `playCrash()` fires. Crash happens in `stepLap` (detect new crashes between
`advanceOneLap` snapshots).
**Steps:** When a rider transitions to crashed, spawn a brief particle burst (a few small circles
tweened outward + fading) at the dot's position. Clean up the particles after the tween.
**Validate:** SCREENSHOT `/tmp/crash.png` (seed a high-risk wet race to force a crash); BUILD.
**Done when:** crashing shows a burst.

### P4.4 — Overtake pop
**Goal:** Reward position changes.
**Files:** `src/scenes/RaceScene.ts`.
**Context:** The player overtake flash + `playOvertake()` already exist (`flashText`,
`prevPlayerPos`). Generalize the *visual pop* to any dot that gains a place.
**Steps:** When a dot moves up the order at a lap boundary, briefly tween its scale up and back
(a "pop"), optionally a quick white flash on the ring. Keep it short (~200ms).
**Validate:** SCREENSHOT `/tmp/overtake.png`; BUILD passes.
**Done when:** overtakes visibly pop.

### P4.5 — Leader glow
**Goal:** The leader is obvious.
**Files:** `src/scenes/RaceScene.ts`.
**Context:** Leaderboard order is computed each frame (`order[0]` is the leader).
**Steps:** Give the current P1 dot a soft pulsing halo (a second translucent circle whose
alpha/scale oscillates). Move the halo when the lead changes.
**Validate:** SCREENSHOT `/tmp/leader-glow.png`; BUILD passes.
**Done when:** the leader has a visible pulsing glow.

### P4.6 — Animated standings rows (result screen)
**Goal:** Standings shifts feel alive.
**Files:** `src/scenes/RaceResultScene.ts`, possibly `src/ui/StandingsTable.ts`.
**Context:** `renderStandingsWithArrows` already computes ▲/▼ vs last race as monospace text.
**Steps:** Replace (or augment) the static text with rows that slide/fade into place on enter,
and tint ▲ green / ▼ red. Keep the data identical — only the presentation animates.
**Validate:** SCREENSHOT `/tmp/standings-anim.png`; BUILD passes.
**Done when:** standings rows animate in with colored deltas.

### P4.7 — Scene transitions
**Goal:** Smooth, pro feel.
**Files:** all `src/scenes/*.ts` (centralize in a tiny helper).
**Context:** Scenes switch via `this.scene.start(...)` with no transition.
**Steps:** Add `src/ui/transition.ts` with `fadeTo(scene, key, data)` that does a camera fade-out
then `scene.start`, and a fade-in on `create`. Apply to the main scene switches.
**Validate:** SCREENSHOT `/tmp/transition.png` (mid-fade) + probe error-free; BUILD passes.
**Done when:** scene changes fade instead of cut.

### P4.8 — Podium ceremony animation + confetti
**Goal:** A satisfying season climax.
**Files:** `src/scenes/RaceResultScene.ts` (`renderSeasonEnd`/`drawPodium`), uses
`SoundEngine.playPodium()`.
**Context:** `drawPodium` already draws static medal blocks. `playPodium()` exists but check it's
called.
**Steps:** Animate the three blocks rising into place in order (3rd, 2nd, 1st), drop confetti
(many small tinted rects falling + rotating) when P1 lands, and call `playPodium()`.
**Validate:** SCREENSHOT `/tmp/podium.png`; BUILD passes.
**Done when:** the podium animates with confetti and sound.

### P4.9 — End-of-season stat montage
**Goal:** Recap the year before the off-season.
**Files:** `src/scenes/OffSeasonScene.ts` (P1.8).
**Context:** `season.raceResults` + player `positionCounts` hold the data.
**Steps:** Before showing churn, sequence a few animated stat cards (Wins, Podiums, DNFs, Best
finish, Points) that count up / fade in one by one.
**Validate:** SCREENSHOT `/tmp/montage.png`; BUILD passes.
**Done when:** the off-season opens with an animated recap.

---

# PHASE 5 — UX, clarity & meta glue

### P5.1 — Stat bars
**Goal:** Stats readable at a glance.
**Files:** `src/ui/StatBar.ts` (new), `src/ui/Card.ts`, `src/scenes/SeasonScene.ts`.
**Context:** `Card` currently prints stat values as gold numbers (1–10). Hub prints
`Pilot Pace X Cornering Y …` as text.
**Steps:** Build a `StatBar` (a 1–10 filled bar). Use it in the pilot/brand `Card`s and the hub
pilot/bike readouts (keep the number too, small). Color-fill via `THEME`.
**Validate:** SCREENSHOT `/tmp/statbars.png`; BUILD passes.
**Done when:** stats show as bars in menu + hub.

### P5.2 — Hover tooltips
**Goal:** Explain mechanics in place.
**Files:** `src/ui/Tooltip.ts` (new), used in `SeasonScene.ts` (setup, tyres, risk).
**Context:** Phaser objects support `pointerover`/`pointerout` (see `Card.ts`).
**Steps:** A reusable tooltip that shows on hover near the cursor. Add tips to: each Setup
("Top Speed: best on power tracks"), each Tyre, and the R&D buttons.
**Validate:** SCREENSHOT `/tmp/tooltip.png` (hover via probe `page.mouse.move`); BUILD passes.
**Done when:** hovering shows helpful tooltips.

### P5.3 — Pre-race "vs rival" compare
**Goal:** Make the rivalry legible before the race.
**Files:** `src/scenes/SeasonScene.ts`, uses `Rivalry.ts` (P3.8) + `StatBar` (P5.1).
**Context:** `player.rivalId` points into `career.field`.
**Steps:** On the hub, add a small panel comparing your skills/bike vs your rival's, side by side
with stat bars.
**Validate:** SCREENSHOT `/tmp/compare.png`; BUILD passes.
**Done when:** the hub shows a you-vs-rival comparison.

### P5.4 — Post-race highlights
**Goal:** Summarize what mattered.
**Files:** `src/scenes/RaceResultScene.ts`.
**Context:** Use only data that actually reaches the result screen: player finishing position and
DNF (`result.finishingOrder`), pilot level-ups (`playerSummary.pilotLevels`), prize money (P2.6),
and rival outcome (`Rivalry.beatRival`, P3.8). **Do NOT reference fastest lap here** — `RaceResult`
does not store fastest-lap data (it's only tracked transiently inside `RaceScene` as `this.fastest`
and discarded at `finalizeRace`). If you want fastest lap as a highlight later, that's a separate
task: add a `fastestLap?: { riderId: string; time: number }` field to `RaceResult`, populate it in
`RaceScene.finish()` before `applyRaceResult`, and only then surface it. That is out of scope for
P5.4.
**Steps:** Add a "Highlights" box listing 2–4 bullet lines computed from the in-scope data (e.g.
"+1 Cornering", "Beat your rival", "Earned $2,500", "Nemesis DNF'd").
**Validate:** SCREENSHOT `/tmp/highlights.png`; BUILD passes.
**Done when:** the result screen shows contextual highlights.

### P5.5 — Settings panel
**Goal:** Player options, persisted.
**Files:** `src/scenes/SettingsScene.ts` (new) or an overlay; `src/core/persist.ts`;
register in `config.ts`.
**Context:** `SoundEngine` already persists mute. Use `persist.ts` for the rest.
**Steps:** A settings overlay reachable from the main menu: master volume (wire to
`SoundEngine`), a **reduce motion** toggle (later phases can read it to skip heavy animation),
and a **delete career** button (`clearCareer`). Persist all settings.
**Validate:** SCREENSHOT `/tmp/settings.png`; BUILD passes.
**Done when:** settings open, change, and persist across reload.

### P5.6 — Season objectives
**Goal:** A target each season.
**Files:** `src/core/types.ts` (`SeasonObjective`), `src/core/Objectives.ts` (new),
`tests/objectives.test.ts` (new), `src/scenes/SeasonScene.ts`.
**Context:** Tier (P1.9) can set difficulty of the objective (e.g. Rookie: finish top 6).
**Steps:** `makeObjective(tier)` returns `{ description, targetFinish }`; `evaluateObjective(obj,
finalFinish)` → met/failed. Show the objective on the hub and its result at season end. Test both
outcomes.
**Validate:** TEST green; SCREENSHOT `/tmp/objective.png`; BUILD passes.
**Done when:** each season has a shown, evaluated objective.

### P5.7 — Records / hall of fame
**Goal:** Persistence that spans careers.
**Files:** `src/core/Records.ts` (new), `tests/records.test.ts` (new), surfaced on MainMenu.
**Context:** Separate `localStorage` key from the career (records outlive a deleted career).
**Steps:** Track best season points, most wins in a season, fastest lap ever, titles won. Update
at season end; show a "Records" panel on the main menu. Test that a better result overwrites and a
worse one doesn't.
**Validate:** TEST green; SCREENSHOT `/tmp/records.png`; BUILD passes.
**Done when:** records persist and display.

### P5.8 — Help / legend overlay + keyboard shortcuts
**Goal:** Onboarding + speed.
**Files:** `src/scenes/RaceScene.ts`, a small `src/ui/HelpOverlay.ts` (new).
**Context:** The race-day legend text already explains rings/orders. Phaser keyboard input is set
up in `MainMenuScene` (`this.input.keyboard`).
**Steps:** Add a `?` button that toggles a help overlay (explains setup/risk/tyres/weather). Add
keyboard shortcuts on race day: `1/2/3` = Settle/Defend/Attack, `Space` = cycle speed, `S` = skip.
**Validate:** SCREENSHOT `/tmp/help.png`; probe presses keys and confirms no errors; BUILD passes.
**Done when:** help overlay toggles and shortcuts work.

---

## Appendix — quick reference for the agent

- **Run dev server:** `npm run dev` (port 5173). **Build:** `npm run build`. **Test:** `npm test`.
- **Single test file:** `npx vitest run <name>`. **Balance sweep:** `npx vitest run sweep`.
- **Screenshot probe template:** `tools/uiprobe.mjs` — copy, adapt the clicks, change the
  screenshot path, assert `PAGE ERRORS: none`.
- **Determinism:** always pass `new RNG(seed)`; never `Math.random()` in deterministic
  simulation/gameplay core modules (see hard rule #3). `SoundEngine` audio noise is exempt.
- **Don't touch** `tests/balance.test.ts` thresholds. If balance breaks, your change is wrong.
- **Each item = one commit.** If an item feels like it needs to touch 5+ files, stop and re-read
  it — you're probably overreaching; do the smallest version that satisfies "Done when".
