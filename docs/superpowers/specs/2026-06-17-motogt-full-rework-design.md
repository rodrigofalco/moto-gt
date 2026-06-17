# MotoGT — Full Rework Design (Career + Depth + Juice)

_Date: 2026-06-17 · Status: approved design, ready for plan_

## 1. Goal

Turn MotoGT from "one 5-minute season, then it's over" into **a career you return to** —
seasons that persist, a rival field that evolves around you, meaningful long-term growth, and a
race day that *feels* like a race. Keep the thing that already works: a fast, legible,
one-decision-per-race manager loop.

This design is the source of truth for the overnight task plan in
`docs/superpowers/plans/2026-06-17-motogt-full-rework-tasks.md`. The plan breaks this into ~50
tiny, self-contained items sized for a less-capable local coding agent.

## 2. Design principles (read before any item)

1. **Additive, not destructive.** The current season loop (MainMenu → Season hub → Race day →
   Result) must keep working at every step. New systems wrap or extend; they don't replace.
2. **Pure logic in `src/core/`, no Phaser.** Anything testable with vitest lives in `core/`.
   Scenes (`src/scenes/`) only render and wire input. This split already exists — preserve it.
3. **Isolated modules.** Each new system is its own file with a small interface (e.g.
   `CareerStore`, `Economy`, `OffSeason`). A reader should understand one without the others.
4. **Numbers stay 1–10.** Pilot skills and bike params remain integers 1–10 so the balance
   harness (`tests/balance.test.ts`, `tests/sweep.test.ts`) stays valid. We fix "stats max out
   too fast" with *economy/curve* changes, NOT by rescaling stats. (See §5.)
5. **Determinism via `RNG`.** No `Math.random()` in deterministic simulation/gameplay core
   modules (race outcomes, progression, economy, off-season churn): thread the seeded `RNG`
   (`src/core/RNG.ts`) through everything so tests are reproducible. **Exception:**
   `src/core/SoundEngine.ts` uses `Math.random()` for audio noise — that is not simulation and is
   left as-is. (SoundEngine lives in `core/` for convenience but is presentation, not sim.)
6. **Every change is validated** — see §7. No item is "done" without evidence.

## 3. Current architecture (what exists today)

- **Scenes:** `BootScene → MainMenuScene` (pick pilot + brand + team name) → `SeasonScene`
  (per-race hub: setup selector + bike R&D spend) → `RaceScene` (interactive lap-by-lap 2D
  race-day with live Attack/Defend/Settle, speed control, leaderboard, sound) → `RaceResultScene`
  (results + standings; on last race shows season-end podium).
- **Core logic:** `RaceEngine` (createRace/stepLap/finalizeRace), `PerformanceModel`
  (skills+bike → 3 axes), `CrashModel`, `AIDecision`, `Progression` (pilot XP + bike R&D),
  `Championship` (points/standings), `RNG`, `Path`/`raceView` (race-day geometry), `Advice`,
  `SoundEngine` (WebAudio, new in working tree).
- **Data:** `data/pilots.ts` (6 archetypes), `data/brands.ts` (4 brands), `data/tracks.ts`
  (6 tracks), `data/trackLayouts.ts` (race-day path points), `data/names.ts`.
- **Factories:** `SeasonFactory.createSeason`, `RiderFactory.createPlayerRider` /
  `generateAIRiders`.
- **Types:** `src/core/types.ts`. **Constants:** `src/core/constants.ts`.
- **No persistence today** except a mute flag in `SoundEngine`. Only `SoundEngine` uses
  `localStorage`.

## 4. The six pillars

### Pillar A — Career meta-layer (the new spine)
- **`CareerStore`** (`src/core/CareerStore.ts`): serialize/deserialize a `CareerState` to
  `localStorage` under one key. Pure functions + a thin wrapper. `CareerState` holds: the player
  identity (pilot archetype id, brand id, team name), the *persistent* player `Rider`, the
  persistent AI field, money, reputation, current tier, season number, and the in-progress
  `SeasonState` (or null between seasons).
- **Continue/New/Abandon** on the main menu. A career survives page reload.
- **Multiple seasons:** when a `SeasonState` completes, instead of "PLAY AGAIN → MainMenu", go to
  an **Off-Season screen** then start the next season carrying everything forward.
- **Per-season reset (critical):** persistent riders are reused across seasons, so building a new
  season MUST reset their per-season championship fields — `points = 0`,
  `positionCounts = new Array(10).fill(0)`, and the season's `raceResults`/`currentRaceIndex`/
  `isSeasonComplete`. Long-term fields (`skills`, `bike`, `pilotXp`, `rndPoints`, `age`, `form`,
  `rivalId`) and career-level `money`/`reputation`/`tierId` are preserved. This lives in
  `createSeasonForCareer` and is covered by a dedicated test (plan P1.10).
- **Off-season churn (`OffSeason.ts`):** AI riders age, improve or decline, the weakest retire,
  new rookies are generated, so the grid is never identical and never trivially beaten.
- **Tiers / promotion:** 3 classes (e.g. Rookie → Pro → Factory). Win or finish top-N in the
  title → promoted; the new class has stronger AI + better starting machinery. Gives the career
  an arc and is the *relative-difficulty* answer to "I maxed my stats."

### Pillar B — Progression & economy rebalance (the stat-cap fix) — see §5.

### Pillar C — Race-weekend depth (optional layered decisions)
Each is a small, self-contained system that defaults to "neutral" so the quick loop still works:
**qualifying** (sets the grid instead of grid = roster order), **tyre choice + wear**, **simple
weather** (dry/wet flips which setup wins, raises crash risk), a named **rivalry/nemesis**,
**pilot form/morale**, and **mid-race flags/events**. Note: each depth system needs both a *logic*
task and a *wiring* task — e.g. qualifying isn't done until it actually runs before the race, shows
the grid, and feeds it into `createRace` (plan P3.1 logic → P3.2 grid support → P3.2b wiring).

### Pillar D — Visual juice & game-feel
Race day: motion trails, overtake pop, crash particle burst, leader glow, a real track-map path
flavor per track, an animated position tower, sector flashes. Meta: podium ceremony with
animation, end-of-season montage, animated standings rows, scene transitions, a cohesive
type/color theme, confetti on a title.

### Pillar E — UX & clarity
Stat **bars** instead of bare numbers, hover tooltips, pre-race "vs rival" compare, post-race
highlights, a track-info card, a help/legend overlay, keyboard shortcuts.

### Pillar F — Polish & meta-loop glue
Settings panel, persistent options, season-objective tracking, records/hall-of-fame, an
achievements-lite list — the connective tissue that makes the career feel like a product.

## 5. The stat-cap fix (decided: diminishing returns + churn, keep 1–10)

**Root cause (measured from current constants):**
- Pilot: `+10` XP/race base (`PILOT_XP_BASE`) `+5` podium `+5` win; level every `25`
  (`PILOT_XP_PER_LEVEL`) → ~1 level / ~1.5 races → ~3–4 stat points per 6-race season. Across 2
  seasons a pilot pins all three skills at 10.
- Bike: `+2`/race base (`RND_BASE`) `+1` podium `+1` win → 12–24 R&D points/season; a focused
  player maxes a bike axis in one season, the whole bike in ~two.

**Fix (three parts, all on the 1–10 integer scale):**
1. **Diminishing XP / R&D cost per level.** Cost to raise a stat from `n→n+1` scales with `n`.
   Concretely: `pilotLevelCost(n) = PILOT_XP_PER_LEVEL * (1 + PILOT_COST_GROWTH * (n - 1))` and an
   analogous `bikeUpgradeCost(n)` measured in R&D points (a bike axis upgrade is no longer a flat
   1 point). 9→10 becomes very expensive; early gains stay snappy. This makes a *single* stat take
   most of a career to max, so growth never dies mid-season-2.
2. **Relative difficulty via off-season churn + tiers (Pillar A).** Even at high stats, fresh
   rookies and promotion to a stronger class keep the challenge alive, so hitting 10 on one stat
   is an achievement, not "game over."
3. **Aging curve.** Each pilot has a hidden `age`; past a peak age, a small chance per off-season
   to *lose* a stat point. The player ages too, so a long career is about managing decline, not
   just accumulating. AI aging also drives retirements.

**Balance guard:** because numbers stay 1–10 and per-race sim math is unchanged, the existing
balance harness still applies. New progression/economy code gets its *own* tests; it must not
change `RaceEngine`/`PerformanceModel`/`CrashModel` outputs for a given rider state.

## 6. Data-model additions (types)

Extend `src/core/types.ts` additively (every new field optional or defaulted so old code and
saved games degrade gracefully):
- `Rider`: add `age?: number`, `form?: number` (morale, ~-2..+2), `rivalId?: string`.
- New `CareerState`, `Tier`, `OffSeasonReport`, `Economy`/wallet fields, `TyreChoice`,
  `Weather`, `QualifyingResult`, `SeasonObjective` interfaces — each introduced by the item that
  needs it, not all up front.
- `SeasonState`: add `weather?: Weather` per race, `objective?: SeasonObjective`.

Persisted shape is versioned: `CareerState.version: number`. `CareerStore` refuses/migrates
mismatched versions rather than crashing.

## 7. Validation conventions (MANDATORY per item)

Two evidence types; most items need one, visual items need both.

**(a) Unit tests — for anything in `src/core/`.**
- Add/extend a `tests/<name>.test.ts` using vitest. Run `npm test` → must be green.
- Test pure behavior: given inputs, assert outputs. Use a fixed `new RNG(seed)` for determinism.
- Never weaken `tests/balance.test.ts` to make a change pass. If it goes red, the change is wrong.

**(b) Screenshot probe — for anything visual (`src/scenes/`, `src/ui/`).**
- Pattern file: `tools/uiprobe.mjs` (Playwright, clicks through to the race and screenshots
  `/tmp/raceday2.png`). For a new screen, copy it to `tools/probe-<feature>.mjs`, drive the UI to
  the new state, and `await page.screenshot({ path: '/tmp/<feature>.png' })`.
- Run: `npm run dev` in the background, then `node tools/probe-<feature>.mjs`. The probe must
  print `PAGE ERRORS: none` and produce a screenshot showing the intended change.
- The agent should *open the screenshot and confirm the change is visible* before claiming done.

**(c) Always, every item:** `npm run build` (`tsc && vite build`) must pass — no TypeScript
errors. This is the cheap universal gate.

## 8. Phasing

- **P0 — Safety net & foundation.** Commit the working tree; lock current behavior under tests;
  add shared theme tokens and small utilities the later phases reuse.
- **P1 — Career spine & save.** `CareerStore`, Continue/New menu, multi-season chaining,
  off-season screen, tiers scaffold.
- **P2 — Progression & economy rebalance.** The §5 stat-cap fix: diminishing costs, money,
  aging, churn, retirements, rookies.
- **P3 — Race-weekend depth.** Qualifying, tyres, weather, rivalry, form, mid-race events.
- **P4 — Visual juice.** Trails, particles, animated standings/podium, montage, transitions,
  theme application, confetti.
- **P5 — UX, clarity & meta glue.** Stat bars, tooltips, compare, highlights, settings, objectives,
  records, achievements, help overlay.

Phases are ordered by dependency; within a phase, items are mostly independent. Each item names
its prerequisites.

## 9. Non-goals (explicitly out)

Networking/multiplayer, real physics, a backend/server, art assets beyond procedural shapes,
mobile/touch redesign, and full pit-stop micro-management. Keep the procedural, single-file,
browser-only character of the project.

## 10. Risks

- **Save compatibility** as the model grows: mitigate with `CareerState.version` + tolerant
  loads (default missing fields).
- **Balance drift** from economy changes: keep sim math untouched; add focused economy tests.
- **Weak-agent drift:** each task item is tiny, names exact files/functions, and carries
  copy-paste context + a concrete validation command. Items that must stay within one file say so.
