# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MotoGT is a minimalist browser-based motorcycle racing manager game: TypeScript (strict, ES modules) + Phaser 4, built with Vite, tested with Vitest. Phaser is the only runtime dependency.

## Commands

```bash
npm run dev          # Vite dev server (open the printed localhost URL, usually :5173)
npm run build        # tsc && vite build (typecheck is part of the build)
npm run test         # vitest run (all unit tests, Node environment, globals on)
npm run test:watch   # vitest in watch mode
npm run test:flow    # node tools/app-flow.test.mjs — headless end-to-end app flow via Playwright
npm run preview      # serve the production build

# Run a single test file, verbose:
npx vitest run tests/raceEngine.test.ts --reporter=verbose
```

Always run `npm run test` and `npm run build` before declaring a change done. The build's `tsc` pass enforces `noUnusedLocals` / `noUnusedParameters`, so unused code fails the build.

## Architecture

Two layers with a hard separation: **pure simulation logic** (`src/core/`, `src/data/`) and **Phaser presentation** (`src/scenes/`, `src/ui/`). Keep game logic out of scenes — scenes should call into `src/core/` and render the results.

### Scene flow (Phaser)

`src/config.ts` registers seven scenes; `src/main.ts` boots the game.

```
Boot → MainMenu → Season → Race → RaceResult → OffSeason
          │  ↑________________________________________│
          └→ SaveLoad
```

- **Season data is passed scene-to-scene as `scene.start` payloads**, not via a global store or Phaser registry. Each scene reads its input in `init(data)` / `create`. Example: `this.scene.start('RaceScene', { season, run, career, grid })`. When adding a scene transition, thread `season` (and `career`, if in career mode) through the payload the same way.
- `career` is present in the payload only in career mode; single-season "quick play" omits it. Scenes branch on its presence (see `RaceResultScene` returning to `SeasonScene` with vs. without `career`).
- `SoundEngine` is attached to the Phaser game object (`game.__soundEngine`) in `main.ts`, not just to `window` — sound-playing buttons read it off `this.game`. Attach it unconditionally.
- Phaser is not HMR-friendly; `main.ts` forces a full page reload on any hot update.

### Simulation pipeline (`src/core/`)

The race is resolved **lap-by-lap** in `RaceEngine.ts`. Per-rider performance is built by composing pure functions in `PerformanceModel.ts`:

`baseAxes(skills, bike)` → `applySetup(axes, setup, weather)` → `weightedBase(axes, track)` = a rider's base pace.

`RaceEngine` then drives the race in two modes:
- **Interactive** (used by `RaceScene`): `createRace()` → `stepLap()` per lap (player picks risk each lap) → `finalizeRace()`.
- **Non-interactive** (used by tests/harness): `runRace()` / `simulateRace()` hold one risk for the whole race. `RaceSimulator.ts` just re-exports `simulateRace` for backward-compatible imports.

Each lap adds pace deviation + AR(1) "momentum" noise + push bonus, applies order-preserving field compression to keep the pack tight, resolves per-lap crash probability (`CrashModel.ts`), and applies drafting tows. Finishing order sorts finishers ahead of crashers, later crashes ahead of earlier ones.

Other core modules: `Championship.ts` (standings/points), `Qualifying.ts` (grid order), `TireModel.ts`, `AIDecision.ts` (AI setup/risk choices), `Commentary.ts`, `Economy.ts` / `CostCurve.ts` (prize money, R&D costs), `Progression.ts` (pilot XP auto-level + bike R&D), `OffSeason.ts` (aging, retirement, rookies, promotion).

### Determinism & RNG (important)

All randomness flows through a single seeded PRNG: `RNG` (Mulberry32 + Box–Muller gaussian) in `src/core/RNG.ts`. **An `RNG` instance is threaded explicitly as a parameter** through sim functions — simulation code never calls `Math.random()` directly. This is what makes races reproducible and tests deterministic. When adding simulation logic, take `rng: RNG` as a parameter rather than reaching for global randomness.

### Balance constants

`src/core/constants.ts` is the central tuning file — points table, crash rates, push bonuses, field compression, momentum weight, tire/weather multipliers, lap counts, RNG-driven balance targets, and race-day view geometry. Balance changes belong here, and `tests/balance.test.ts` / `tests/sweep.test.ts` guard the targets. Read the inline comments before changing simulation constants; several reference design specs in `docs/superpowers/specs/`.

### Data & persistence

- `src/data/` holds static rosters: `tracks.ts` (track bank with per-axis weights), `pilots.ts`, `brands.ts` (bike params + dot colors), `tiers.ts`, `names.ts`, `trackLayouts.ts`.
- `src/core/factories/` builds runtime objects: `RiderFactory.ts` (player + AI riders), `SeasonFactory.ts` (`createSeason` for quick play, `createSeasonForCareer` for career continuation — shuffles the track bank, seeds per-race weather).
- Persistence is localStorage-based: `persist.ts` (raw JSON get/set), `CareerStore.ts` (career save/load, versioned via `CAREER_VERSION`), `SaveSystem.ts`. Two state shapes: `SeasonState` (one championship in progress) vs. `CareerState` (persistent player/field/money/reputation across seasons, holds a `SeasonState | null`).

Central types live in `src/core/types.ts`.

## Conventions

- Prefer **pure functions** for simulation and scoring; keep randomness and side effects explicit (pass `RNG`, return new values). Compose small functions over large classes for game logic.
- Types live in `src/core/types.ts` or next to the code they describe. Avoid `any`; strict TS is enforced.
- ES module imports only (`"type": "module"`); no CommonJS `require`.
- Avoid adding runtime dependencies — Phaser is the only one.
- Tests use Vitest globals (`describe`/`it`/`expect`). Favor deterministic tests: construct an `RNG` with a fixed seed rather than mocking `Math.random`.

## Docs workflow

`AGENTS.md` has the full contributor guide (its `src/` layout section is stale — the code uses `src/core/`, `src/data/`, and `src/core/factories/`, not `src/engine/`). For non-trivial features, follow the structured workflow in `docs/README.md`:

- `docs/spec/` — feature specs (`TEMPLATE.md`)
- `docs/plans/` — implementation plans referencing a spec (`TEMPLATE.md`)
- `docs/adr/` — architecture decision records (`TEMPLATE.md`)
- `docs/done/` — archive completed specs/plans here
- `docs/superpowers/` — read-only archive of historical specs/plans (several are referenced from `constants.ts` and `RaceEngine.ts`)
- `docs/OVERNIGHT-LOG.md` — running dev log of recent decisions and known issues

Note: the code has advanced beyond the "V1 scope" described in `README.md` — save/load careers, prize money, bike R&D/progression, tires, weather, qualifying, and multi-season off-seasons are all implemented.

## Debugging visual/runtime issues

The `tools/` directory has Playwright-based probes (`app-flow.test.mjs`, `scene-shot.mjs`, `verify-*.mjs`) and `screenshot.mjs` / `take-screenshot.mjs` at the root for headless screenshots and flow checks against a running dev server. In dev, `window.__game` and `window.__soundEngine` are exposed for a headless probe or DevTools to inspect scenes.

## Model routing (through July 7)
Default: Sonnet 5 for everyday work.

Use Fable 5 only for heavy, high-payoff tasks:
- large migrations (framework, language, dependency)
- codebase-wide refactors across many files
- complex multi-step builds
- hard bugs in tangled code (race conditions, subtle state)

Rule of thumb: weeks-by-hand → Fable 5, minutes-by-hand → Sonnet 5.
Protect the Fable 5 window. Don't spend it on small edits.

Note: some security-adjacent requests get rerouted to Opus 4.8
by the new safeguards. If quality drops on one call, check for a reroute.