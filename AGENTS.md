# MotoGT Project Context

MotoGT is a minimalist browser-based motorcycle racing manager game.

## Tech stack

- **Language:** TypeScript (strict, ES modules, `type: "module"`)
- **Game engine:** Phaser 4
- **Build tool:** Vite
- **Test runner:** Vitest (globals enabled, Node environment)
- **Visual testing:** Playwright (screenshot helpers already in repo)

## Project structure

```
src/           # Game source code
  scenes/      # Phaser scenes (MainMenu, Season, RaceResult, etc.)
  engine/      # Simulation logic (race result computation, standings)
  models/      # Data types and state (rider, season, calendar)
  ui/          # UI helpers and components
tests/         # Vitest test suites
index.html     # Entry point
vite.config.ts # Vite config; sets chunkSizeWarningLimit: 1600 for Phaser
```

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server
npm run build      # tsc && vite build
npm run test       # vitest run
npm run test:watch # vitest
```

## Coding conventions

- Prefer **pure functions** for simulation and scoring logic. Keep randomness and side effects explicit.
- Use **immutable updates** for game state when practical.
- Scene classes extend `Phaser.Scene` and live in `src/scenes/`.
- Types live in `src/models/` or next to the code they describe. Avoid `any`.
- Strict TypeScript is enforced (`noUnusedLocals`, `noUnusedParameters`).
- Use ES module imports; no CommonJS `require`.

## Good practices

- Run `npm run test` after logic changes. Do not break existing tests without discussing.
- When adding a feature, add or update a test in `tests/` first or alongside the change.
- Keep the V1 scope tight: one player rider, one season, one decision per race. Defer budget/R&D/career to later versions.
- Avoid adding new runtime dependencies unless necessary. Phaser is the only runtime dependency.
- Write small, focused functions. Prefer composing functions over large classes for game logic.

## Debugging

- Use browser DevTools when running `npm run dev`.
- For simulation bugs, run the relevant test with `npx vitest run tests/raceEngine.test.ts --reporter=verbose`.
- Check `docs/OVERNIGHT-LOG.md` for recent design decisions and known issues.
- Use `take-screenshot.mjs` or `screenshot.mjs` for visual regression checks via Playwright.

## Testing

- Tests use Vitest globals (`describe`, `it`, `expect`).
- Favor deterministic tests; seed randomness or mock `Math.random` when needed.
- Integration tests live in `tests/integration.test.ts`.
- Scene/rendering tests use Playwright helpers in the project root.

## Documentation workflow

Use the structured docs in `docs/` for non-trivial features and decisions:

- `docs/spec/` — feature specifications. Use `docs/spec/TEMPLATE.md`.
- `docs/plans/` — implementation plans that reference a spec. Use `docs/plans/TEMPLATE.md`.
- `docs/adr/` — architecture decision records. Use `docs/adr/TEMPLATE.md`.
- `docs/done/specs/` and `docs/done/plans/` — archive completed artifacts here.

When asked to plan or implement a feature:
1. Check existing specs/plans in `docs/` to avoid duplication.
2. Write or update a spec before creating a plan.
3. Record architectural decisions as ADRs.
4. After implementation, move completed specs/plans to `docs/done/`.

See `docs/README.md` for the full workflow.

## When writing code

1. Read the relevant source files and tests first.
2. Check `docs/spec/` and `docs/plans/` for related work.
3. Match existing code style and naming.
4. Keep changes minimal and focused.
5. Run `npm run test` and `npm run build` before declaring done.
