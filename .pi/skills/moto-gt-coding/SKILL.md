---
name: moto-gt-coding
description: Deep reference for the MotoGT codebase — architecture, adding scenes, debugging race simulation, and testing patterns. Use when the task involves Phaser scenes, game state, race simulation, or project-specific testing.
---

# MotoGT Coding Reference

## Architecture overview

MotoGT is intentionally small. The V1 loop is:

```
MainMenu → Season → RaceResult → (back to Season)
```

- `src/scenes/` — Phaser scenes (UI screens).
- `src/engine/` — Pure simulation logic (race results, standings, scoring).
- `src/models/` — Data shapes (Rider, Season, Calendar, etc.).
- `tests/` — Vitest suites covering engine and integration behavior.

## Adding a new scene

1. Create `src/scenes/YourScene.ts` extending `Phaser.Scene`.
2. Register it in the game bootstrap (usually `src/main.ts` or the scene that launches it).
3. Pass needed state via `scene.start(key, data)`.
4. Keep scene code focused on presentation; put logic in `src/engine/`.

## Adding a new simulation rule

1. Define inputs/outputs as types in `src/models/`.
2. Implement the rule as a pure function in `src/engine/`.
3. Add a test in `tests/` with deterministic inputs.
4. Wire it into the scene that needs it.

## Common debugging patterns

- **Race result feels wrong:** check `src/engine/race.ts` (or equivalent) and `tests/raceEngine.test.ts`.
- **Scene not rendering:** verify scene key registration and that `preload`/`create` run without errors.
- **Build fails with TS errors:** look for unused locals/parameters or missing imports. Strict mode is on.
- **Test flakiness:** mock `Math.random` or seed the RNG for deterministic results.

## Testing patterns

- Engine tests: import functions from `src/engine/*` and assert outputs.
- Integration tests: exercise a full season or race flow.
- Scene tests: use Playwright screenshot helpers in the project root.

Run one test file verbosely:

```bash
npx vitest run tests/raceEngine.test.ts --reporter=verbose
```

## File naming

- `camelCase.ts` for modules.
- PascalCase for classes (`SeasonScene`, `RaceEngine`).
- Test files: `<module>.test.ts`.

## Documentation workflow

For non-trivial features, follow the structured docs workflow:

- `docs/spec/` — feature specifications
- `docs/plans/` — implementation plans linked to specs
- `docs/adr/` — architecture decision records
- `docs/done/` — archive completed specs/plans

Check these directories before coding. If a spec or plan exists, implement it. If not, suggest creating one before making large changes.

## What to avoid

- Do not introduce stateful singletons for game logic.
- Do not bypass TypeScript with `as any` or `// @ts-ignore`.
- Do not expand scope into V2+ features (career, R&D, sponsors, weather) unless explicitly requested.
