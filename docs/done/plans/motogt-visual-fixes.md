# MotoGT — In-Place Fixes & Visual Polish

## TL;DR

> **Quick Summary**: Wire up 5 already-built-but-disconnected features (commentary, tires, sound events, save/load menu, dot anti-overlap) and visually polish every existing scene/UI component — without adding new game mechanics or scenes.
>
> **Deliverables**:
> - Visual QA tooling: per-scene Playwright screenshot script + ollama qwen3-vl:8b analysis helper
> - Enhanced design tokens in `theme.ts` (gradients, shadows, font stack, spacing)
> - Upgraded `Button.ts`, `Card.ts`, `StandingsTable.ts` with depth/hover/styling
> - Visually polished all 6 active scenes (MainMenu, Season, Race, RaceResult, OffSeason, Boot)
> - Wired 5 deferred features into their existing scenes
> - Fixed stale README (Phaser 4, updated scope)
>
> **Estimated Effort**: Medium-Large
> **Parallel Execution**: YES - 3 waves + final verification
> **Critical Path**: Task 2 (theme) → Task 4-6 (UI components) → Tasks 12-16 (scene polish) → F1-F4

---

## Context

### Original Request
User asked: "Provide a detailed plan for other agent to implement improvements on this game. Try not to grow scope. Fix everything in place, and improve visually. Uses local ollama qwen3-vl:8b for visual analysis. Create itemized list, exit conditions."

### Interview Summary
**Key Decisions**:
- Scope is strictly **fix-in-place + visual polish** — NO new features, NO new scenes, NO new mechanics
- "Fix everything in place" = wire up the 5 deferred items already listed in `TODO.md` (code exists, just not connected)
- "Improve visually" = enhance existing UI components and scenes with depth, hierarchy, polish
- Visual verification uses **local ollama qwen3-vl:8b** (confirmed available, 6.1GB) to analyze Playwright screenshots

**Research Findings**:
- Phaser 4.1.0 (NOT Phaser 3 as README claims) — README is stale
- vitest: 27 files, 136 passing tests — solid test infra, tests-after approach
- Dev server runs at localhost:5173 (confirmed HTTP 200)
- Existing `screenshot.mjs`/`take-screenshot.mjs` only capture main menu — need per-scene capability
- `theme.ts` has only flat solid colors, no gradients/shadows/depth tokens
- `Button.ts`/`Card.ts` use plain `Phaser.GameObjects.Rectangle` — no rounded corners, no shadows
- Typography uses default browser sans-serif everywhere — no font family, no weight hierarchy
- All scenes render text directly on flat background — no panels, no section groupings
- 5 deferred features have working core modules but are not wired into scenes

### Metis Review
**Identified Gaps** (addressed):
- Phaser version discrepancy (README says 3, actual 4): Added Task 3 to fix README
- Screenshot scripts only capture main menu: Added Task 1 for per-scene screenshot tooling
- No visual/UI tests: QA scenarios use Playwright screenshots + ollama analysis as primary visual verification
- Scope creep risk: Explicit guardrails added — no new scenes, no new mechanics, no new game systems

---

## Work Objectives

### Core Objective
Make the existing game look polished and feel complete by (A) connecting 5 already-built features into their scenes and (B) visually upgrading every existing UI surface — without growing scope.

### Concrete Deliverables
- `tools/scene-shot.mjs` — per-scene Playwright screenshot capture
- `tools/ollama-vision.mjs` — ollama qwen3-vl:8b visual analysis helper
- Enhanced `src/ui/theme.ts` with design tokens (gradients, shadows, fonts, spacing)
- Upgraded `src/ui/Button.ts`, `src/ui/Card.ts`, `src/ui/StandingsTable.ts`
- Polished `src/scenes/*.ts` (all 6 active scenes)
- Wired: Commentary → RaceScene, TireModel → SeasonScene+RaceScene, SoundEngine events, SaveLoadScene buttons, dot anti-overlap
- Fixed `README.md` (Phaser 4, updated scope)

### Definition of Done
- [ ] `npm run build` passes (tsc + vite build)
- [ ] `npm test` passes (136+ tests, 0 failures)
- [ ] All 5 deferred features wired and functional in-game
- [ ] Every scene screenshot passes ollama qwen3-vl:8b visual review (no overlapping text, good contrast, clear hierarchy)
- [ ] No new scenes, no new game mechanics, no new core modules added

### Must Have
- All visual changes use EXISTING Phaser primitives (Graphics, Rectangle, Text, Arc, Tween) — no new dependencies
- Every visual task includes ollama qwen3-vl:8b screenshot verification in QA scenarios
- Feature wiring reuses EXISTING core modules (Commentary.ts, TireModel.ts, SoundEngine.ts, CareerStore.ts) — no rewrites
- All 136 existing tests still pass

### Must NOT Have (Guardrails)
- **NO new scenes** — only polish the 6 existing scenes (Boot, MainMenu, Season, Race, RaceResult, OffSeason)
- **NO new game mechanics** — no new stats, no new race phases, no new economy systems
- **NO new core modules** — the 5 features use already-written core code; just wire them in
- **NO new npm dependencies** — use Phaser 4 built-in APIs only
- **NO scope expansion into V2/V3/V4 roadmap items** (no sponsors, no staff, no multi-rider hiring)
- **NO AI slop**: no excessive comments, no over-abstraction, no generic helper factories, no unused exports
- **NO breaking changes to core module APIs** — scenes call existing functions, don't rewrite them
- **NO touching test files unless a test legitimately breaks** from feature wiring — if so, fix the test to match new wired behavior

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest, 27 files, 136 passing)
- **Automated tests**: Tests-after — run `npm test` after each task; fix any regressions
- **Framework**: vitest (config inline in `vite.config.ts`)
- **No new unit tests required** — visual changes are verified by screenshot + ollama, not unit tests. Feature wiring may need test adjustments if existing tests assert on unwired behavior.

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Visual/UI**: Use Playwright (`tools/scene-shot.mjs`) to capture screenshot → `ollama-vision.mjs` to analyze → assert no overlap, good contrast, clear hierarchy
- **Feature wiring**: Use Playwright to navigate to the scene, interact (click/setup), verify the feature is visible/active in-game
- **Build/Test**: Use Bash — `npm run build` and `npm test` must pass
- **Ollama analysis**: `ollama run qwen3-vl:8b "<prompt>" < screenshot.png` — capture critique, verify improvements

**Ollama QA pattern** (for every visual task):
```
1. Capture: node tools/scene-shot.mjs <scene-name> → /tmp/shot-<scene>.png
2. Analyze: ollama run qwen3-vl:8b "Critique this game UI. List visual problems." < /tmp/shot-<scene>.png
3. Verify: ollama output mentions NO overlapping text, NO misalignment for the areas this task touched
4. Evidence: save ollama output to .sisyphus/evidence/task-{N}-ollama-review.txt
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — 3 parallel, start immediately):
├── Task 1: Visual QA tooling (scene-shot + ollama-vision helpers) [quick]
├── Task 2: Enhance theme.ts design tokens [quick]
└── Task 3: Fix stale README (Phaser 4 + scope) [quick]

Wave 2 (Max parallel — 8 tasks, after Wave 1):
├── Task 4: Upgrade Button.ts visual styling (depends: 2) [visual-engineering]
├── Task 5: Upgrade Card.ts visual styling (depends: 2) [visual-engineering]
├── Task 6: Upgrade StandingsTable.ts visual styling (depends: 2) [visual-engineering]
├── Task 7: Wire Commentary into RaceScene (no dep) [unspecified-high]
├── Task 8: Integrate TireModel into SeasonScene+RaceScene (no dep) [unspecified-high]
├── Task 9: Wire SoundEngine race-day events (no dep) [quick]
├── Task 10: Wire SaveLoadScene menu buttons (no dep) [quick]
└── Task 11: Anti-overlap dot nudge in RaceScene (no dep) [unspecified-high]

Wave 3 (Scene polish — 5 parallel, after Wave 2 UI components):
├── Task 12: Polish MainMenuScene (depends: 4, 5) [visual-engineering]
├── Task 13: Polish SeasonScene (depends: 4, 6) [visual-engineering]
├── Task 14: Polish RaceScene (depends: 4, 6, 7, 8, 11) [visual-engineering]
├── Task 15: Polish RaceResultScene (depends: 4, 6) [visual-engineering]
└── Task 16: Polish OffSeasonScene (depends: 4) [visual-engineering]

Wave FINAL (4 parallel reviews, after ALL tasks):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA with ollama visual analysis (unspecified-high + playwright)
└── F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: Task 2 → Task 4 → Task 12 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 8 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | F3 | 1 |
| 2 | — | 4, 5, 6 | 1 |
| 3 | — | — | 1 |
| 4 | 2 | 12, 13, 14, 15, 16 | 2 |
| 5 | 2 | 12 | 2 |
| 6 | 2 | 13, 14, 15 | 2 |
| 7 | — | 14 | 2 |
| 8 | — | 13, 14 | 2 |
| 9 | — | 14 | 2 |
| 10 | — | — | 2 |
| 11 | — | 14 | 2 |
| 12 | 4, 5 | F1-F4 | 3 |
| 13 | 4, 6 | F1-F4 | 3 |
| 14 | 4, 6, 7, 8, 11 | F1-F4 | 3 |
| 15 | 4, 6 | F1-F4 | 3 |
| 16 | 4 | F1-F4 | 3 |

### Agent Dispatch Summary

- **Wave 1**: 3 agents — T1-T3 → `quick`
- **Wave 2**: 8 agents — T4-T6 → `visual-engineering`, T7-T8, T11 → `unspecified-high`, T9-T10 → `quick`
- **Wave 3**: 5 agents — T12-T16 → `visual-engineering`
- **FINAL**: 4 agents — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high` (+playwright), F4 → `deep`

---

## TODOs

- [ ] 1. Visual QA Tooling — per-scene screenshots + ollama vision helper

  **What to do**:
  - Create `tools/scene-shot.mjs`: Playwright script that accepts a scene name argument and navigates the game to that scene, then captures a screenshot. Support scenes: `mainmenu`, `season`, `race`, `results`, `offseason`. Navigation: launch headless chromium → goto localhost:5173 → wait for game load → for non-menu scenes, automate pilot/bike selection + START SEASON + navigate to target scene via `window.__game` exposed in dev mode (see `src/main.ts:10`). Save to `/tmp/shot-<scene>.png`.
  - Create `tools/ollama-vision.mjs`: Node script that takes a screenshot path + prompt, base64-encodes the image, calls `http://localhost:11434/api/generate` with model `qwen3-vl:8b`, prints the response. Usage: `node tools/ollama-vision.mjs <image-path> "<prompt>"`.
  - Keep both scripts simple (<60 lines each), no new dependencies (use existing `playwright` + Node fetch).
  - Test both scripts work against the running dev server.

  **Must NOT do**:
  - No new npm dependencies (playwright already in devDependencies)
  - No complex test framework for the scripts themselves
  - No modification of existing screenshot.mjs/take-screenshot.mjs (leave them; new scripts supersede)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two small utility scripts, straightforward Playwright + fetch usage
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: Built-in browser automation not needed for writing the script itself

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: F3 (final QA needs these tools)
  - **Blocked By**: None (can start immediately)

  **References**:
  - `screenshot.mjs:1-10` — existing Playwright screenshot pattern to extend (chromium.launch, viewport 1200×1300, #game-container locator)
  - `src/main.ts:9-11` — dev-mode `window.__game` exposure for scene inspection/navigation
  - `src/config.ts:16` — scene key list: BootScene, MainMenuScene, SeasonScene, RaceScene, RaceResultScene, OffSeasonScene
  - `src/scenes/MainMenuScene.ts:128-135` — start() flow: needs pilot + brand + team, calls scene.start('SeasonScene')
  - Ollama API: `POST http://localhost:11434/api/generate` with JSON `{model, prompt, images:[base64], stream:false}`

  **WHY Each Reference Matters**:
  - `screenshot.mjs`: Copy the working chromium launch + viewport + #game-container pattern, extend with scene navigation
  - `src/main.ts:9-11`: The `__game` global lets the script access `game.scene.keys` to start scenes directly for screenshotting
  - `src/config.ts:16`: Scene keys are needed to navigate via `game.scene.start(key)`
  - Ollama API: Correct endpoint + JSON shape for the vision model

  **Acceptance Criteria**:
  - [ ] `tools/scene-shot.mjs` exists and runs: `node tools/scene-shot.mjs mainmenu` saves `/tmp/shot-mainmenu.png`
  - [ ] `tools/scene-shot.mjs` can capture at least 3 scenes (mainmenu, season, race)
  - [ ] `tools/ollama-vision.mjs` exists and runs: `node tools/ollama-vision.mjs /tmp/shot-mainmenu.png "List problems"` prints analysis
  - [ ] No new entries in `package.json` dependencies

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Scene screenshot capture works
    Tool: Bash
    Preconditions: Dev server running at localhost:5173
    Steps:
      1. Run: node tools/scene-shot.mjs mainmenu
      2. Check file exists: ls -la /tmp/shot-mainmenu.png
      3. Run: node tools/scene-shot.mjs season (navigates through menu first)
      4. Check file exists: ls -la /tmp/shot-season.png
    Expected Result: Both PNG files exist, each >10KB (not blank)
    Failure Indicators: File missing, file <1KB (blank screenshot), script errors
    Evidence: .sisyphus/evidence/task-1-screenshot-capture.txt (command output)

  Scenario: Ollama vision helper returns analysis
    Tool: Bash
    Preconditions: ollama running, qwen3-vl:8b model available, screenshot from previous scenario
    Steps:
      1. Run: node tools/ollama-vision.mjs /tmp/shot-mainmenu.png "List 3 visual problems in this UI"
      2. Wait for response (may take 60-120s)
      3. Check output contains readable text analysis (not empty, not error)
    Expected Result: Script prints a text analysis of the screenshot
    Failure Indicators: Empty output, HTTP error, timeout without fallback message
    Evidence: .sisyphus/evidence/task-1-ollama-helper.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `chore(tools): add per-scene screenshot + ollama vision helpers`
  - Files: `tools/scene-shot.mjs`, `tools/ollama-vision.mjs`
  - Pre-commit: `node tools/scene-shot.mjs mainmenu`

- [ ] 2. Enhance theme.ts Design Tokens

  **What to do**:
  - Extend `src/ui/theme.ts` with design tokens for visual depth WITHOUT breaking existing API (THEME.gold, THEME.bgNum, etc. must still work):
    - Add gradient color stops for backgrounds (e.g., `bgGradient: ['#1a1a2e', '#16213e']`)
    - Add shadow config (e.g., `shadow: { color: 0x000000, alpha: 0.4, blur: 8, offsetY: 3 }`)
    - Add a web-safe font stack string (e.g., `fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif'` — note: no new deps, just CSS font-family string for Phaser text)
    - Add spacing tokens (e.g., `space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }`)
    - Add panel style config (bg color, border color, border thickness, corner radius for graphics)
    - Add button gradient/hover colors as number hex
  - Export new tokens as named constants so scenes/components can import them.
  - Keep the file <80 lines — tokens only, no logic.

  **Must NOT do**:
  - No new npm dependencies (no font files, no icon libraries)
  - No removal of existing THEME/FONTS/hex exports (backward compatible)
  - No Phaser GameObject creation in theme.ts (it's a config file, not a scene)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single config file, adding constants, no complex logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5, 6 (UI components need new tokens)
  - **Blocked By**: None

  **References**:
  - `src/ui/theme.ts:1-37` — existing theme structure to extend (THEME object, FONTS, hex helper)
  - `src/ui/Button.ts:8-13` — current COLOR constants that should migrate to use theme tokens
  - `src/ui/Card.ts:17` — current hardcoded colors (0x16213e, 0x0f3460) that tokens should replace

  **WHY Each Reference Matters**:
  - `theme.ts`: This is the file being extended — preserve existing exports, add new ones
  - `Button.ts:8-13`: Shows what color tokens UI components currently need (normal/hover/press/disabled)
  - `Card.ts:17`: Shows panel/card colors that need token equivalents

  **Acceptance Criteria**:
  - [ ] `theme.ts` exports new tokens: gradient stops, shadow config, fontFamily string, spacing scale, panel style
  - [ ] Existing `THEME.gold`, `THEME.bgNum`, `FONTS`, `hex()` still work (no import breakage)
  - [ ] `npm run build` passes (tsc finds no type errors)
  - [ ] File is <80 lines

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Theme tokens are valid and backward compatible
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: npx tsc --noEmit (type check passes)
      2. Grep: src/ for THEME.gold and THEME.bgNum usage — confirm still importable
      3. Read theme.ts — confirm new exports: gradient, shadow, fontFamily, spacing, panel
    Expected Result: tsc passes; existing imports unbroken; new tokens present
    Failure Indicators: tsc errors, missing exports, removed existing exports
    Evidence: .sisyphus/evidence/task-2-theme-tokens.txt

  Scenario: Build still succeeds with new theme
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: npm run build
      2. Check: no TypeScript errors, vite build completes
    Expected Result: Build succeeds, dist/ updated
    Failure Indicators: tsc errors, build fails
    Evidence: .sisyphus/evidence/task-2-build.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `style(theme): add design tokens for gradients, shadows, fonts, spacing`
  - Files: `src/ui/theme.ts`
  - Pre-commit: `npm run build`

- [ ] 3. Fix Stale README (Phaser 4 + Updated Scope)

  **What to do**:
  - Update `README.md` to reflect the actual current state of the game:
    - Change "Phaser 3" → "Phaser 4" in the Tech Stack section (line 78)
    - Update the "Scenes" section (lines 82-89): it says 3 scenes, actual is 7 (Boot, MainMenu, Season, Race, RaceResult, OffSeason, SaveLoad)
    - Update "In V1" scope (lines 60-66): game now HAS save/load, weather, tire model, multi-season career, prize money, R&D — these are no longer "out of V1"
    - Update "Out of V1" (lines 68-69): remove items that are now implemented (weather, tires, multi-season, money, lap-by-lap view); keep actually-deferred items (sponsors, staff, multi-rider hiring)
    - Update "The game in one minute" (lines 12-15): it says "one decision per race" but game now has setup selection, tire compounds, R&D purchases, risk orders during race
  - Do NOT rewrite the whole README — just fix the inaccurate parts. Preserve the document's voice and structure.

  **Must NOT do**:
  - No new documentation files — only edit existing README.md
  - No adding roadmap items beyond what exists
  - No removing the "Background" section or "Getting started" commands

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single markdown file, text corrections based on known facts
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `README.md:78` — says "Phaser 3", actual is `phaser@^4.1.0` (see package.json:20)
  - `README.md:82-89` — says 3 scenes, actual 7 (see `src/config.ts:16`)
  - `README.md:60-69` — V1 scope is stale; compare against `TODO.md:10-50` (Implemented Features list)
  - `package.json:20` — `"phaser": "^4.1.0"` proof of version

  **WHY Each Reference Matters**:
  - `README.md:78`: The specific line with the wrong Phaser version
  - `TODO.md:10-50`: Authoritative list of what's actually implemented — use to fix the scope section
  - `package.json`: Source of truth for dependencies

  **Acceptance Criteria**:
  - [ ] README.md says "Phaser 4" (not "Phaser 3")
  - [ ] Scenes section lists 7 scenes (Boot, MainMenu, Season, Race, RaceResult, OffSeason, SaveLoad)
  - [ ] "In V1" scope reflects implemented features (save, weather, tires, money, multi-season, lap view)
  - [ ] "Out of V1" only lists actually-deferred items (sponsors, staff, multi-rider hiring)
  - [ ] No new markdown files created

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: README accuracy check
    Tool: Bash
    Preconditions: None
    Steps:
      1. Grep README.md for "Phaser 3" — expect ZERO matches
      2. Grep README.md for "Phaser 4" — expect at least 1 match
      3. Read README.md scope section — confirm save/weather/tires/money listed as implemented
      4. Confirm no new .md files in docs/ or root (git status)
    Expected Result: Phaser 4 stated, scope matches TODO.md implemented features, no new files
    Failure Indicators: "Phaser 3" still present, stale scope, new docs files created
    Evidence: .sisyphus/evidence/task-3-readme-check.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `docs: fix stale README (Phaser 4, updated scope to match implemented features)`
  - Files: `README.md`
  - Pre-commit: none

- [ ] 4. Upgrade Button.ts Visual Styling

  **What to do**:
  - Enhance `src/ui/Button.ts` to look polished using Phaser 4 Graphics + existing primitives:
    - Replace the plain `Rectangle` background with a `Graphics`-drawn rounded rectangle (use `Phaser.GameObjects.Graphics` with `fillRoundedRect`) OR keep Rectangle but add a subtle drop shadow rectangle offset behind it
    - Apply gradient or two-tone fill: use a Graphics fill with slightly lighter top color and darker bottom (simulate depth with 2 stacked rounded rects)
    - Improve hover: add a subtle scale tween on hover (`scene.tweens.add({ targets: this, scaleX: 1.04, scaleY: 1.04, duration: 100 })`) and reverse on pointerout
    - Use the font family from theme tokens (Task 2) for button text
    - Add subtle inner highlight: a 1px lighter stroke on top edge
  - Keep the exact same public API: `Button(scene, {x, y, width, height, label, onClick})` and `setEnabled(bool)` — scenes must not need changes.
  - The Button constructor signature and `setEnabled` MUST remain unchanged.

  **Must NOT do**:
  - No new npm dependencies
  - No changing the ButtonOptions interface (breaks all scenes)
  - No removing the disabled state behavior
  - No adding parameters to constructor

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Visual styling, tween animation, Phaser Graphics rendering
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI polish and visual design guidance

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5-11)
  - **Blocks**: Tasks 12-16 (all scene polish uses Button)
  - **Blocked By**: Task 2 (theme tokens)

  **References**:
  - `src/ui/Button.ts:1-54` — the file being enhanced; preserve API, change rendering
  - `src/ui/theme.ts` (after Task 2) — new tokens: fontFamily, shadow config, button colors
  - `src/scenes/MainMenuScene.ts:30-31` — Button usage example (width 300, height 48, label)
  - Phaser 4 Graphics API: `scene.add.graphics()` → `g.fillRoundedRect(x, y, w, h, radius)` + `g.fillStyle(color, alpha)`

  **WHY Each Reference Matters**:
  - `Button.ts`: The file being modified — must preserve constructor + setEnabled API
  - `theme.ts`: New design tokens to consume (font, colors, shadow)
  - `MainMenuScene.ts:30`: Shows how Button is instantiated — API must stay compatible

  **Acceptance Criteria**:
  - [ ] Button renders with rounded corners (not plain rectangle)
  - [ ] Hover triggers a subtle scale tween (1.0 → 1.04)
  - [ ] Button text uses theme fontFamily
  - [ ] `setEnabled(false)` still shows disabled state (greyed)
  - [ ] No scene file changes required (API unchanged)
  - [ ] `npm run build` passes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Button visual upgrade visible in screenshot
    Tool: Bash + ollama
    Preconditions: Dev server running, Task 1 tools available
    Steps:
      1. node tools/scene-shot.mjs mainmenu → /tmp/shot-mainmenu.png
      2. node tools/ollama-vision.mjs /tmp/shot-mainmenu.png "Describe the buttons in this UI. Are they rounded rectangles with depth? Do they look polished or flat?"
      3. Read ollama output — confirm buttons described as rounded/has depth (not "flat rectangle")
    Expected Result: Ollama describes buttons as having rounded corners or depth, not flat
    Failure Indicators: Ollama says "flat rectangle" or "plain" buttons
    Evidence: .sisyphus/evidence/task-4-button-ollama.txt

  Scenario: Button API unchanged — no scene breakage
    Tool: Bash
    Preconditions: None
    Steps:
      1. npm run build (tsc checks all Button usages compile)
      2. npm test (existing tests pass)
      3. Grep src/scenes for "new Button(" — confirm same call pattern works
    Expected Result: Build passes, tests pass, all Button instantiations unchanged
    Failure Indicators: tsc errors on scene files, test failures
    Evidence: .sisyphus/evidence/task-4-api-check.txt
  ```

  **Commit**: YES (groups with Wave 2 UI)
  - Message: `style(ui): upgrade Button with rounded corners, depth, hover tween`
  - Files: `src/ui/Button.ts`
  - Pre-commit: `npm run build`

- [ ] 5. Upgrade Card.ts Visual Styling

  **What to do**:
  - Enhance `src/ui/Card.ts` with visual depth:
    - Add a drop shadow: a semi-transparent dark rounded rectangle offset (2-3px down-right) behind the card
    - Replace plain `Rectangle` with `Graphics` rounded rectangle (`fillRoundedRect`)
    - On hover: subtle lift tween (y -= 2px) + brighter border
    - On selected: golden glow — thicker gold stroke + slightly brighter fill (already partially exists at line 40, enhance it)
    - Use theme fontFamily for title/subtitle/stats text
    - Add a subtle top-edge highlight line (1px lighter color)
  - Preserve the exact public API: `Card(scene, opts)` and `setSelected(bool)`.

  **Must NOT do**:
  - No new npm dependencies
  - No changing CardOptions interface
  - No removing subtitle or stats rendering

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Visual polish with Phaser Graphics, tweens, layering
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12 (MainMenu uses Card)
  - **Blocked By**: Task 2 (theme tokens)

  **References**:
  - `src/ui/Card.ts:1-44` — file being enhanced; preserve CardOptions + setSelected API
  - `src/ui/theme.ts` (post-Task 2) — fontFamily, shadow config, panel colors
  - `src/scenes/MainMenuScene.ts:50-63` — Card usage: 18 pilot cards with title, subtitle, stats, onClick

  **Acceptance Criteria**:
  - [ ] Card renders with rounded corners + drop shadow
  - [ ] Hover triggers subtle lift (y tween)
  - [ ] Selected state shows gold glow (thick gold stroke)
  - [ ] Text uses theme fontFamily
  - [ ] API unchanged (CardOptions, setSelected)
  - [ ] `npm run build` passes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Card visual upgrade in main menu
    Tool: Bash + ollama
    Preconditions: Dev server running, Task 1 tools available
    Steps:
      1. node tools/scene-shot.mjs mainmenu → /tmp/shot-mainmenu.png
      2. node tools/ollama-vision.mjs /tmp/shot-mainmenu.png "Describe the pilot/bike cards. Do they have shadows, rounded corners, depth? Is the selected card clearly highlighted?"
      3. Check ollama mentions depth/shadow/rounded cards
    Expected Result: Ollama describes cards with shadow/depth/rounded, selected card highlighted
    Failure Indicators: Ollama says "flat cards" or "no shadow"
    Evidence: .sisyphus/evidence/task-5-card-ollama.txt

  Scenario: Card API unchanged
    Tool: Bash
    Preconditions: None
    Steps:
      1. npm run build
      2. npm test
      3. Grep src/scenes for "new Card(" — confirm unchanged call sites
    Expected Result: Build + tests pass, Card instantiations unchanged
    Failure Indicators: tsc errors, test failures
    Evidence: .sisyphus/evidence/task-5-api-check.txt
  ```

  **Commit**: YES (groups with Wave 2 UI)
  - Message: `style(ui): upgrade Card with drop shadow, rounded corners, hover lift, selected glow`
  - Files: `src/ui/Card.ts`
  - Pre-commit: `npm run build`

- [ ] 6. Upgrade StandingsTable.ts Visual Styling

  **What to do**:
  - Transform `src/ui/StandingsTable.ts` from plain monospace text into a real visual table:
    - Draw alternating row background stripes (zebra striping): even rows slightly lighter panel color, odd rows darker
    - Highlight the player's row with a distinct background (subtle gold tint) + bold text + ">" marker (already exists, enhance visually)
    - Draw a header row with "Pos | Rider | Pts | Gap" labels in gold
    - Draw thin separator lines between columns (vertical) using Graphics
    - Use theme fontFamily for non-monospace parts; keep monospace for numbers alignment
  - Preserve the `renderStandings(scene, x, y, riders, opts)` signature. It currently returns a Text object — it may now return a Container with Graphics + Texts, but the function signature stays the same (return type can be `Phaser.GameObjects.Container | Phaser.GameObjects.Text`).

  **Must NOT do**:
  - No new npm dependencies
  - No changing the function name or parameter order
  - No removing the `showGap` option

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Table rendering with Graphics, zebra stripes, column lines
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 13, 14, 15 (Season, Race, Results scenes use standings)
  - **Blocked By**: Task 2 (theme tokens)

  **References**:
  - `src/ui/StandingsTable.ts:1-19` — current pure-text implementation to replace
  - `src/scenes/SeasonScene.ts:91` — usage: `renderStandings(this, 720, 120, getStandings(season), { showGap: true })`
  - `src/scenes/RaceResultScene.ts:92` — usage in season-end: `renderStandings(this, 400, 398, standings, { showGap: true })`
  - `src/ui/theme.ts` (post-Task 2) — panel colors, fontFamily, gold color

  **Acceptance Criteria**:
  - [ ] Standings render as a table with zebra-striped rows (not plain text block)
  - [ ] Player's row has distinct gold-tinted background + bold text
  - [ ] Header row with column labels in gold
  - [ ] Column separator lines visible
  - [ ] `renderStandings` function signature unchanged
  - [ ] `npm run build` passes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Standings table visual upgrade
    Tool: Bash + ollama
    Preconditions: Dev server running, need to navigate to season scene
    Steps:
      1. node tools/scene-shot.mjs season → /tmp/shot-season.png
      2. node tools/ollama-vision.mjs /tmp/shot-season.png "Describe the standings table on the right side. Does it have zebra-striped rows? Is the player's row highlighted? Are there column headers?"
      3. Check ollama confirms table structure (not plain text)
    Expected Result: Ollama describes a table with row stripes, player highlight, headers
    Failure Indicators: Ollama says "plain text" or "no table structure"
    Evidence: .sisyphus/evidence/task-6-standings-ollama.txt

  Scenario: Standings API unchanged
    Tool: Bash
    Steps:
      1. npm run build
      2. npm test
      3. Grep for renderStandings usage — confirm call sites unchanged
    Expected Result: Build + tests pass
    Evidence: .sisyphus/evidence/task-6-api-check.txt
  ```

  **Commit**: YES (groups with Wave 2 UI)
  - Message: `style(ui): upgrade StandingsTable with zebra stripes, player highlight, headers`
  - Files: `src/ui/StandingsTable.ts`
  - Pre-commit: `npm run build`

- [ ] 7. Wire Commentary System into RaceScene

  **What to do**:
  - The `Commentary` module (`src/core/Commentary.ts`) exists but is NOT used in `RaceScene.ts`. Wire it in:
    - Read `src/core/Commentary.ts` to understand its API (events, phrases, triggers)
    - In `RaceScene.ts`, instantiate or import the Commentary system
    - During `advanceOneLap()` or `renderFrame()`, feed race events (overtakes, crashes, fastest lap, leader change) to the Commentary system
    - Display commentary text in a dedicated area of the race scene (use the existing `calloutText` at line 104, or add a new commentary text line below it)
    - Commentary should cycle/update as race events happen (not static)
  - Use the EXISTING Commentary API — do not rewrite Commentary.ts.

  **Must NOT do**:
  - No rewriting `src/core/Commentary.ts` — only consume it
  - No new core modules
  - No changing the race simulation logic — only add display layer

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding two modules and wiring them without breaking race logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 14 (RaceScene polish)
  - **Blocked By**: None

  **References**:
  - `src/core/Commentary.ts` — the commentary system to wire in (READ THIS FIRST to understand API)
  - `src/scenes/RaceScene.ts:104` — `calloutText` where commentary can display
  - `src/scenes/RaceScene.ts:190-207` — `advanceOneLap()` where race events happen (crashes, lap times)
  - `src/scenes/RaceScene.ts:252-278` — `renderFrame()` where overtakes/position changes are detected
  - `src/scenes/RaceScene.ts:308-316` — overtake flash detection (player position change)

  **WHY Each Reference Matters**:
  - `Commentary.ts`: MUST read to know the API — what events it accepts, what it returns, how to trigger phrases
  - `RaceScene.ts:104`: Existing text object to reuse or model the commentary display on
  - `RaceScene.ts:190-207`: Lap events (crashes, fastest lap) are commentary triggers
  - `RaceScene.ts:308-316`: Overtake detection — feed to commentary

  **Acceptance Criteria**:
  - [ ] Commentary text appears during the race (visible in screenshot or via scene inspection)
  - [ ] Commentary updates on race events (at least: overtake, crash, fastest lap)
  - [ ] `src/core/Commentary.ts` is NOT modified (only imported/consumed)
  - [ ] `npm run build` passes
  - [ ] `npm test` passes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Commentary appears during race
    Tool: Bash + Playwright
    Preconditions: Dev server running
    Steps:
      1. node tools/scene-shot.mjs race → /tmp/shot-race.png (navigates into a race)
      2. node tools/ollama-vision.mjs /tmp/shot-race.png "Is there commentary or event text visible during the race? Describe any dynamic text about race events."
      3. Check ollama mentions commentary/event text
    Expected Result: Ollama confirms dynamic event text/commentary visible during race
    Failure Indicators: No commentary text visible, only static labels
    Evidence: .sisyphus/evidence/task-7-commentary-ollama.txt

  Scenario: Commentary module not modified
    Tool: Bash
    Steps:
      1. git diff src/core/Commentary.ts — expect empty (no changes)
      2. npm run build && npm test
    Expected Result: Commentary.ts unchanged, build + tests pass
    Failure Indicators: Commentary.ts modified, or build/test failures
    Evidence: .sisyphus/evidence/task-7-no-modify.txt
  ```

  **Commit**: YES
  - Message: `feat(race): wire commentary system into RaceScene for live event text`
  - Files: `src/scenes/RaceScene.ts`
  - Pre-commit: `npm run build && npm test`

- [ ] 8. Integrate TireModel — Compound Selection + Wear Tracking

  **What to do**:
  - The `TireModel` module (`src/core/TireModel.ts`) exists with compound degradation + crash risk logic but is NOT integrated. Wire it in:
    - READ `src/core/TireModel.ts` first to understand: compounds (soft/medium/hard), wear model, traction degradation, crash risk interface
    - In `SeasonScene.ts`: add a tire compound selector (3 boxes: Soft/Medium/Hard) near the setup selection area (around y=372). Store selected compound on the season/run state.
    - In `RaceScene.ts`: track tire wear per lap during `advanceOneLap()`. Feed wear into the `TireModel` to get traction degradation. Apply degradation to rider pace (via existing `stepLap` or as a multiplier).
    - Display tire wear visually in the race scene (a small wear indicator per compound — e.g., a colored bar or percentage near the leaderboard)
  - Use the EXISTING TireModel API — do not rewrite it.

  **Must NOT do**:
  - No rewriting `src/core/TireModel.ts` — only consume it
  - No new core modules
  - No changing the race simulation architecture — add tire as a modifier, not a new system

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-scene integration (Season → Race), requires understanding TireModel + RaceEngine
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 13, 14 (Season + Race polish)
  - **Blocked By**: None

  **References**:
  - `src/core/TireModel.ts` — the tire model to integrate (READ THIS FIRST)
  - `src/scenes/SeasonScene.ts:78-87` — setup selection area where tire selector should go
  - `src/scenes/RaceScene.ts:190-207` — `advanceOneLap()` where wear should increment
  - `src/core/RaceEngine.ts` — `stepLap` function where tire degradation could apply
  - `src/core/constants.ts` — may have tire-related constants

  **Acceptance Criteria**:
  - [ ] Tire compound selector visible in SeasonScene (Soft/Medium/Hard)
  - [ ] Tire wear tracked during race (visible indicator in RaceScene)
  - [ ] `src/core/TireModel.ts` is NOT modified
  - [ ] `npm run build` passes
  - [ ] `npm test` passes (fix any tests that assert on unwired tire behavior)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Tire selector visible in season hub
    Tool: Bash + ollama
    Preconditions: Dev server running
    Steps:
      1. node tools/scene-shot.mjs season → /tmp/shot-season.png
      2. node tools/ollama-vision.mjs /tmp/shot-season.png "Is there a tire compound selector (Soft/Medium/Hard) visible? Describe tire-related UI."
      3. Check ollama confirms tire selector present
    Expected Result: Ollama describes tire compound selection UI
    Failure Indicators: No tire selector visible
    Evidence: .sisyphus/evidence/task-8-tire-selector-ollama.txt

  Scenario: Tire wear shown during race
    Tool: Bash + ollama
    Steps:
      1. node tools/scene-shot.mjs race → /tmp/shot-race.png
      2. node tools/ollama-vision.mjs /tmp/shot-race.png "Is there a tire wear indicator visible during the race? Describe any tire/wear display."
      3. Check ollama confirms tire wear display
    Expected Result: Ollama describes tire wear indicator
    Failure Indicators: No tire wear visible
    Evidence: .sisyphus/evidence/task-8-tire-wear-ollama.txt

  Scenario: TireModel not modified
    Tool: Bash
    Steps:
      1. git diff src/core/TireModel.ts — expect empty
      2. npm run build && npm test
    Expected Result: TireModel.ts unchanged, build + tests pass
    Evidence: .sisyphus/evidence/task-8-no-modify.txt
  ```

  **Commit**: YES
  - Message: `feat(race): integrate tire compound selection and wear tracking`
  - Files: `src/scenes/SeasonScene.ts`, `src/scenes/RaceScene.ts`
  - Pre-commit: `npm run build && npm test`

- [ ] 9. Wire SoundEngine Race-Day Events

  **What to do**:
  - `SoundEngine` (`src/core/SoundEngine.ts`) exists with methods (playCrash, playOvertake, playCheckered, playClick, playEngine, stopEngine) but race-day events are incomplete. Wire remaining events:
  - In `RaceScene.ts`:
    - Crash sound: `soundEngine.playCrash()` — trigger when any rider crashes (detect in `advanceOneLap` or `renderFrame` when `s.crashed` becomes true). Currently only called when the PLAYER crashes (line 291) — extend to AI crashes too (subtler volume if possible).
    - Overtake sound: `soundEngine.playOvertake()` — already called on player overtake (line 315). Verify it fires; add for significant position changes.
    - Podium sound: `soundEngine.playPodium()` — trigger in `RaceResultScene.ts` season-end view (`renderSeasonEnd`) when player is champion or on podium.
    - Checkered flag: already called (line 338) — verify.
  - Use EXISTING SoundEngine API — do not rewrite it.

  **Must NOT do**:
  - No rewriting `src/core/SoundEngine.ts`
  - No new audio files or dependencies
  - No changing Web Audio architecture

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding method calls at existing event points, small changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 14 (RaceScene polish), Task 15 (ResultScene polish)
  - **Blocked By**: None

  **References**:
  - `src/core/SoundEngine.ts` — READ to confirm available methods (playCrash, playOvertake, playPodium, playCheckered, playClick, playEngine, stopEngine)
  - `src/scenes/RaceScene.ts:291` — existing playCrash call (player only — extend)
  - `src/scenes/RaceScene.ts:315` — existing playOvertake call
  - `src/scenes/RaceScene.ts:338` — existing playCheckeredFlag call
  - `src/scenes/RaceResultScene.ts:79-102` — `renderSeasonEnd` where playPodium should trigger

  **Acceptance Criteria**:
  - [ ] Crash sound fires for any rider crash (not just player)
  - [ ] Overtake sound fires on position changes
  - [ ] Podium sound fires in season-end results
  - [ ] `src/core/SoundEngine.ts` NOT modified
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Sound events wired correctly
    Tool: Bash
    Preconditions: Dev server running
    Steps:
      1. Grep RaceScene.ts for "playCrash" — expect call in crash detection (not just player)
      2. Grep RaceScene.ts for "playOvertake" — expect call on position change
      3. Grep RaceResultScene.ts for "playPodium" — expect call in renderSeasonEnd
      4. git diff src/core/SoundEngine.ts — expect empty
      5. npm run build && npm test
    Expected Result: All sound methods called at event points, SoundEngine.ts unchanged, build+tests pass
    Failure Indicators: Missing calls, SoundEngine.ts modified, build/test fail
    Evidence: .sisyphus/evidence/task-9-sound-wiring.txt
  ```

  **Commit**: YES
  - Message: `feat(audio): wire sound engine race-day events (crash, overtake, podium)`
  - Files: `src/scenes/RaceScene.ts`, `src/scenes/RaceResultScene.ts`
  - Pre-commit: `npm run build && npm test`

- [ ] 10. Wire SaveLoadScene Menu Buttons

  **What to do**:
  - `SaveLoadScene` (`src/scenes/SaveLoadScene.ts`) exists but NO menu buttons navigate to it. Wire it in:
  - In `MainMenuScene.ts`: add a "SAVE / LOAD" button (below the CONTINUE/NEW CAREER buttons, or in a corner). Clicking it starts `SaveLoadScene`.
  - In `SaveLoadScene.ts`: add a "BACK" button to return to `MainMenuScene`.
  - Verify `SaveLoadScene` is registered in `config.ts` scene list (it may NOT be — check `src/config.ts:16`; if missing, add it).

  **Must NOT do**:
  - No rewriting `src/scenes/SaveLoadScene.ts` core logic — only add navigation button
  - No new scenes — this scene already exists
  - No changing save/load data format

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding a button + verifying scene registration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None (Task 12 MainMenu polish will incorporate the button visually)
  - **Blocked By**: None

  **References**:
  - `src/scenes/SaveLoadScene.ts` — READ to understand its current state (may be incomplete)
  - `src/scenes/MainMenuScene.ts:29-35` — where CONTINUE/NEW CAREER buttons are; add SAVE/LOAD nearby
  - `src/config.ts:16` — scene list: confirm SaveLoadScene is registered (ADD if missing)
  - `src/core/CareerStore.ts` — hasCareer/loadCareer/saveCareer (save/load functions)

  **Acceptance Criteria**:
  - [ ] "SAVE / LOAD" button visible in MainMenuScene
  - [ ] Clicking it navigates to SaveLoadScene
  - [ ] SaveLoadScene has a "BACK" button returning to MainMenuScene
  - [ ] SaveLoadScene registered in config.ts scene list
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Save/Load navigation works
    Tool: Bash + ollama
    Preconditions: Dev server running
    Steps:
      1. node tools/scene-shot.mjs mainmenu → /tmp/shot-mainmenu.png
      2. node tools/ollama-vision.mjs /tmp/shot-mainmenu.png "Is there a Save/Load button visible in the main menu? Describe all buttons."
      3. Check ollama confirms a save/load button
    Expected Result: Ollama describes a save/load button in the menu
    Failure Indicators: No save/load button visible
    Evidence: .sisyphus/evidence/task-10-saveload-ollama.txt

  Scenario: Scene registered and navigable
    Tool: Bash
    Steps:
      1. Grep config.ts for "SaveLoadScene" — expect it in scene array
      2. Grep MainMenuScene for "SaveLoadScene" — expect scene.start call
      3. npm run build && npm test
    Expected Result: SaveLoadScene registered, navigation wired, build+tests pass
    Evidence: .sisyphus/evidence/task-10-scene-registration.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): add save/load button to main menu, wire SaveLoadScene navigation`
  - Files: `src/scenes/MainMenuScene.ts`, `src/scenes/SaveLoadScene.ts`, `src/config.ts` (if needed)
  - Pre-commit: `npm run build && npm test`

- [ ] 11. Anti-Overlap Dot Nudge for Race Day

  **What to do**:
  - In `RaceScene.ts`, rider dots can stack/overlap when they're at the same track position (known issue from TODO.md line 110). Add an anti-overlap nudge:
  - In `renderFrame()` (line 209+), after computing each dot's screen position, detect dots that are within a minimum pixel distance of each other and apply a small perpendicular offset to separate them visually.
  - Algorithm: for each pair of nearby dots (within ~12px), push them apart along the perpendicular to the track direction at that point. Use a small offset (3-6px) so they're visually distinct but don't break the racing line illusion.
  - This is a DISPLAY-ONLY fix — do not change the underlying progress/position data, only the rendered dot positions.

  **Must NOT do**:
  - No changing race simulation logic (stepLap, progress values)
  - No new core modules
  - No changing the track path data

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Geometric algorithm, needs care to not break race visualization
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 14 (RaceScene polish)
  - **Blocked By**: None

  **References**:
  - `src/scenes/RaceScene.ts:209-249` — `renderFrame()` where dot positions are computed (line 244-246: `g.dot.setPosition(sx, sy)`)
  - `src/scenes/RaceScene.ts:15` — `OX, OY, W, H` track viewport constants
  - `src/core/raceView.ts` — `trainLayout` function that computes slot spacing (may already have minSep — check if it's enough)
  - `src/core/constants.ts:60+` — `MIN_SEP`, `MAX_STEP`, `MAX_SPREAD` constants for train layout

  **Acceptance Criteria**:
  - [ ] Rider dots no longer perfectly overlap when at same position
  - [ ] Nudge is display-only (progress data unchanged)
  - [ ] Dots stay on/near the track line (no flying off)
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Dots don't overlap in race view
    Tool: Bash + ollama
    Preconditions: Dev server running
    Steps:
      1. node tools/scene-shot.mjs race → /tmp/shot-race.png
      2. node tools/ollama-vision.mjs /tmp/shot-race.png "Look at the rider dots on the track. Are any dots overlapping/stacked on top of each other? Can you distinguish individual riders?"
      3. Check ollama confirms dots are distinguishable (not stacked)
    Expected Result: Ollama describes individually visible dots, no stacking
    Failure Indicators: Ollama reports overlapping/stacked dots
    Evidence: .sisyphus/evidence/task-11-dots-ollama.txt

  Scenario: Race simulation unchanged
    Tool: Bash
    Steps:
      1. npm test (race engine tests pass — simulation logic untouched)
      2. git diff src/core/ — expect no changes to race simulation files
    Expected Result: Core race files unchanged, tests pass
    Evidence: .sisyphus/evidence/task-11-sim-unchanged.txt
  ```

  **Commit**: YES
  - Message: `fix(race): anti-overlap dot nudge for stacked riders in race view`
  - Files: `src/scenes/RaceScene.ts`
  - Pre-commit: `npm run build && npm test`

- [ ] 12. Polish MainMenuScene Visuals

  **What to do**:
  - Apply visual hierarchy and panels to `src/scenes/MainMenuScene.ts`:
    - Add a title panel/banner behind the "MotoGT" title (a rounded gradient rectangle using Graphics)
    - Group the team name input into a labeled panel (background rectangle + "TEAM" label)
    - Add section header panels: "SELECT PILOT" and "SELECT BIKE" with background bars
    - Improve the team name input box styling (rounded, clearer focus state)
    - Ensure the 18 pilot cards (4×5 grid) have even spacing and don't crowd — verify with screenshot
    - Add a subtle background texture or gradient to the whole scene (a large Graphics gradient rect or repeated subtle pattern)
  - Reuse enhanced Button (Task 4), Card (Task 5), theme tokens (Task 2).
  - If Task 10 added a Save/Load button, style it consistently.

  **Must NOT do**:
  - No new scenes
  - No changing the pilot/bike selection logic
  - No new npm dependencies

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Scene-level visual layout, panels, hierarchy
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 13-16)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 5 (Button + Card upgrades)

  **References**:
  - `src/scenes/MainMenuScene.ts:1-136` — the scene being polished
  - `src/ui/Button.ts` (post-Task 4) — enhanced button to use
  - `src/ui/Card.ts` (post-Task 5) — enhanced card to use
  - `src/ui/theme.ts` (post-Task 2) — design tokens
  - `src/config.ts:11-12` — viewport 1024×1100 (layout boundaries)

  **Acceptance Criteria**:
  - [ ] Title has a styled banner/panel behind it
  - [ ] "SELECT PILOT" and "SELECT BIKE" sections have visible header bars
  - [ ] Team input is in a labeled panel with rounded styling
  - [ ] No text overlap (verify with ollama screenshot)
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Main menu visual polish verified by ollama
    Tool: Bash + ollama
    Preconditions: Dev server running, Tasks 1-5 complete
    Steps:
      1. node tools/scene-shot.mjs mainmenu → /tmp/shot-mainmenu.png
      2. node tools/ollama-vision.mjs /tmp/shot-mainmenu.png "Analyze this game main menu. Rate the visual hierarchy 1-10. Are there clear sections with headers? Is the title prominent? Any overlapping text? List specific visual problems."
      3. Check ollama reports clear sections, prominent title, no overlap
    Expected Result: Ollama describes clear sections, styled title, no overlapping text
    Failure Indicators: Ollama reports overlap, flat layout, no section structure
    Evidence: .sisyphus/evidence/task-12-menu-ollama.txt

  Scenario: Build and tests pass
    Tool: Bash
    Steps: npm run build && npm test
    Expected Result: Both pass
    Evidence: .sisyphus/evidence/task-12-build.txt
  ```

  **Commit**: YES
  - Message: `style(scene): polish MainMenu with title banner, section headers, team panel`
  - Files: `src/scenes/MainMenuScene.ts`
  - Pre-commit: `npm run build`

- [ ] 13. Polish SeasonScene Visuals

  **What to do**:
  - Apply visual structure to `src/scenes/SeasonScene.ts`:
    - Group the race info (race number, track, weather, track focus, hint) into a "RACE INFO" panel at the top
    - Group pilot/bike/R&D/economy into a "YOUR TEAM" panel
    - Group setup selection into a "SETUP" panel with the tire selector (from Task 8)
    - Style the setup boxes and tire boxes consistently with enhanced Button styling
    - Group standings + starting grid into a "CHAMPIONSHIP" panel on the right
    - Add visual separation between panels (spacing, borders, or background tints)
  - Reuse enhanced Button (Task 4), StandingsTable (Task 6), theme tokens (Task 2), tire selector (Task 8).

  **Must NOT do**:
  - No changing economy/R&D/setup logic
  - No new scenes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 6 (Button + StandingsTable), Task 8 (tire selector)

  **References**:
  - `src/scenes/SeasonScene.ts:1-130` — the scene being polished
  - `src/ui/StandingsTable.ts` (post-Task 6) — enhanced standings
  - `src/ui/theme.ts` (post-Task 2) — tokens
  - `src/scenes/SeasonScene.ts:42-94` — current layout (race info lines, setup boxes, standings, grid)

  **Acceptance Criteria**:
  - [ ] Race info grouped in a visible panel
  - [ ] Team/economy info grouped in a panel
  - [ ] Setup + tire selection in a panel
  - [ ] Standings + grid in a right-side panel
  - [ ] No text overlap (ollama verified)
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Season hub visual polish
    Tool: Bash + ollama
    Steps:
      1. node tools/scene-shot.mjs season → /tmp/shot-season.png
      2. node tools/ollama-vision.mjs /tmp/shot-season.png "Analyze this season hub. Are race info, team stats, setup, and standings grouped into clear panels? Is there visual hierarchy? Any overlapping text?"
      3. Check ollama confirms panel grouping + no overlap
    Expected Result: Ollama describes grouped panels, clear hierarchy, no overlap
    Evidence: .sisyphus/evidence/task-13-season-ollama.txt

  Scenario: Build + tests
    Tool: Bash
    Steps: npm run build && npm test
    Expected Result: Pass
    Evidence: .sisyphus/evidence/task-13-build.txt
  ```

  **Commit**: YES
  - Message: `style(scene): polish SeasonScene with info/team/setup/championship panels`
  - Files: `src/scenes/SeasonScene.ts`
  - Pre-commit: `npm run build`

- [ ] 14. Polish RaceScene Visuals

  **What to do**:
  - Apply visual polish to `src/scenes/RaceScene.ts`:
    - Style the track: add a grass/curb border effect (alternating colored segments on curves), make the track surface look more like asphalt (subtle texture or darker fill with edge lines)
    - Group the leaderboard (orderText, lapText, fastest lap) into a "LIVE TIMING" panel on the right
    - Group Orders + Speed controls into control panels at the bottom
    - Group the legend into a small panel
    - Style the commentary text area (from Task 7) with a subtle background
    - Style the tire wear indicator (from Task 8) clearly
    - Ensure the anti-overlap dots (Task 11) look clean
  - Reuse enhanced Button (Task 4), StandingsTable patterns (Task 6), theme tokens (Task 2), commentary (Task 7), tire (Task 8), dots (Task 11), sound (Task 9).

  **Must NOT do**:
  - No changing race simulation logic
  - No new scenes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 6, 7, 8, 11 (all RaceScene dependencies)

  **References**:
  - `src/scenes/RaceScene.ts:1-352` — the scene being polished
  - `src/scenes/RaceScene.ts:161-166` — `drawTrack()` — enhance track visuals
  - `src/scenes/RaceScene.ts:168-184` — `drawFinishLine()` — already checkered
  - `src/scenes/RaceScene.ts:100-105` — leaderboard text objects to panel
  - `src/scenes/RaceScene.ts:108-125` — Orders + Speed controls to panel
  - `src/data/trackLayouts.ts` — track point data for visual enhancement

  **Acceptance Criteria**:
  - [ ] Track has visual depth (curbs/border/asphalt effect)
  - [ ] Live timing in a panel
  - [ ] Controls in panels
  - [ ] Commentary area styled
  - [ ] Tire wear visible
  - [ ] No overlapping dots or text (ollama verified)
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Race scene visual polish
    Tool: Bash + ollama
    Steps:
      1. node tools/scene-shot.mjs race → /tmp/shot-race.png
      2. node tools/ollama-vision.mjs /tmp/shot-race.png "Analyze this race scene. Does the track look like a race track (curbs/asphalt)? Is the live timing in a panel? Are controls grouped? Any overlapping elements? Rate visual quality 1-10."
      3. Check ollama confirms track styling, panels, no overlap
    Expected Result: Ollama describes track visual treatment, panelled controls, clean layout
    Evidence: .sisyphus/evidence/task-14-race-ollama.txt

  Scenario: Build + tests
    Tool: Bash
    Steps: npm run build && npm test
    Expected Result: Pass
    Evidence: .sisyphus/evidence/task-14-build.txt
  ```

  **Commit**: YES
  - Message: `style(scene): polish RaceScene with track curbs, timing panel, control panels`
  - Files: `src/scenes/RaceScene.ts`
  - Pre-commit: `npm run build`

- [ ] 15. Polish RaceResultScene Visuals

  **What to do**:
  - Apply visual polish to `src/scenes/RaceResultScene.ts`:
    - Style the results table: zebra-striped rows, position medals (1st gold, 2nd silver, 3rd bronze icons), DNF rows in red tint
    - Enhance the podium: add a subtle celebration animation (confetti particles or a tween bounce on the podium blocks), glow on the champion
    - Group standings into a panel (reuse StandingsTable Task 6)
    - Style the "Pilot improved" / "development points" feedback with an icon or colored badge
    - For season-end view: make "SEASON COMPLETE" title more dramatic (larger, glowing, centered banner)
  - Reuse enhanced Button (Task 4), StandingsTable (Task 6), theme tokens (Task 2), sound (Task 9 podium).

  **Must NOT do**:
  - No changing results/standings logic
  - No new scenes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 6 (Button + StandingsTable)

  **References**:
  - `src/scenes/RaceResultScene.ts:1-124` — the scene being polished
  - `src/scenes/RaceResultScene.ts:106-123` — `drawPodium()` — enhance with animation
  - `src/scenes/RaceResultScene.ts:79-102` — `renderSeasonEnd()` — dramatic title
  - `src/ui/StandingsTable.ts` (post-Task 6) — enhanced standings

  **Acceptance Criteria**:
  - [ ] Results table has zebra stripes + position medals
  - [ ] Podium has celebration animation (tween/particles)
  - [ ] Season-complete title is dramatic
  - [ ] Standings in a panel
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Results scene visual polish
    Tool: Bash + ollama
    Steps:
      1. node tools/scene-shot.mjs results → /tmp/shot-results.png
      2. node tools/ollama-vision.mjs /tmp/shot-results.png "Analyze this race results screen. Is there a podium? Are results in a styled table with row stripes? Is the title prominent? Describe visual quality."
      3. Check ollama confirms styled results, podium, prominent title
    Expected Result: Ollama describes styled table, podium, good hierarchy
    Evidence: .sisyphus/evidence/task-15-results-ollama.txt

  Scenario: Build + tests
    Tool: Bash
    Steps: npm run build && npm test
    Expected Result: Pass
    Evidence: .sisyphus/evidence/task-15-build.txt
  ```

  **Commit**: YES
  - Message: `style(scene): polish RaceResult with styled table, animated podium, dramatic season-end`
  - Files: `src/scenes/RaceResultScene.ts`
  - Pre-commit: `npm run build`

- [ ] 16. Polish OffSeasonScene Visuals

  **What to do**:
  - Apply visual structure to `src/scenes/OffSeasonScene.ts`:
    - Currently all centered text with no panels — add section panels:
      - "SEASON SUMMARY" panel (champion, player finish position)
      - "PROMOTION" panel (if promoted — highlighted green)
      - "ROSTER CHANGES" panel (retired in red, rookies in blue)
      - "STAT CHANGES" panel (rider development notes)
    - Add visual flair for promotion (confetti or a badge)
    - Style the "START NEXT SEASON" button prominently
  - Reuse enhanced Button (Task 4), theme tokens (Task 2).

  **Must NOT do**:
  - No changing off-season logic
  - No new scenes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Task 4 (Button)

  **References**:
  - `src/scenes/OffSeasonScene.ts:1-54` — the scene being polished
  - `src/scenes/OffSeasonScene.ts:22-44` — current all-centered-text layout to panel
  - `src/ui/theme.ts` (post-Task 2) — tokens for panel colors

  **Acceptance Criteria**:
  - [ ] Off-season report has section panels (summary, promotion, roster, stats)
  - [ ] Promotion has visual flair (badge/confetti)
  - [ ] Button styled prominently
  - [ ] `npm run build` + `npm test` pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Off-season visual polish
    Tool: Bash + ollama
    Steps:
      1. node tools/scene-shot.mjs offseason → /tmp/shot-offseason.png
      2. node tools/ollama-vision.mjs /tmp/shot-offseason.png "Analyze this off-season report. Is the information grouped into clear panels? Is there visual hierarchy? Is promotion visually highlighted?"
      3. Check ollama confirms panels + hierarchy
    Expected Result: Ollama describes grouped panels, visual hierarchy
    Evidence: .sisyphus/evidence/task-16-offseason-ollama.txt

  Scenario: Build + tests
    Tool: Bash
    Steps: npm run build && npm test
    Expected Result: Pass
    Evidence: .sisyphus/evidence/task-16-build.txt
  ```

  **Commit**: YES
  - Message: `style(scene): polish OffSeason with summary/promotion/roster/stat panels`
  - Files: `src/scenes/OffSeasonScene.ts`
  - Pre-commit: `npm run build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run scene, check screenshot). For each "Must NOT Have": search codebase for forbidden patterns (new scenes, new core modules, new dependencies in package.json) — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build` (tsc + vite) + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify no new dependencies added to package.json.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA with Ollama Visual Analysis** — `unspecified-high` (+ `playwright` skill)
  Start dev server. Capture screenshots of EVERY scene via `tools/scene-shot.mjs`. Run `ollama run qwen3-vl:8b` analysis on each screenshot. Test full game flow: menu → select pilot/bike → season hub → setup → race → results → off-season. Verify each wired feature is visible and functional. Save ollama critiques + screenshots to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Ollama Reviews [N/N] | Integration [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec. Check "Must NOT do" compliance: no new scenes, no new core modules, no new dependencies, no new game mechanics. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `chore(tools): add per-scene screenshot + ollama vision helpers` — tools/scene-shot.mjs, tools/ollama-vision.mjs
- **Wave 1**: `style(theme): add design tokens for gradients, shadows, fonts` — src/ui/theme.ts
- **Wave 1**: `docs: fix stale README (Phaser 4, updated scope)` — README.md
- **Wave 2**: `style(ui): upgrade Button/Card/StandingsTable with depth and polish` — src/ui/*.ts
- **Wave 2**: `feat(race): wire commentary into RaceScene` — src/scenes/RaceScene.ts
- **Wave 2**: `feat(race): integrate tire compound selection and wear tracking` — src/scenes/SeasonScene.ts, src/scenes/RaceScene.ts
- **Wave 2**: `feat(audio): wire sound engine race-day events` — src/scenes/RaceScene.ts
- **Wave 2**: `feat(ui): add save/load buttons to main menu` — src/scenes/MainMenuScene.ts
- **Wave 2**: `fix(race): anti-overlap dot nudge for stacked riders` — src/scenes/RaceScene.ts
- **Wave 3**: `style(scene): polish <SceneName> with panels and visual hierarchy` — src/scenes/*.ts (one per scene)
- **Final**: `test: verify all features wired and visual polish complete`

---

## Success Criteria

### Verification Commands
```bash
npm run build          # Expected: tsc + vite build succeeds, no errors
npm test               # Expected: 136+ passing, 0 failures
node tools/scene-shot.mjs mainmenu   # Expected: screenshot saved
ollama run qwen3-vl:8b "Critique this UI" < /tmp/shot.png  # Expected: visual analysis output
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent (no new scenes, modules, deps, mechanics)
- [ ] `npm run build` passes
- [ ] `npm test` passes (136+ tests)
- [ ] All 5 deferred features wired and visible in-game
- [ ] Every scene passes ollama qwen3-vl:8b visual review
- [ ] No overlapping text or misalignment in any scene
- [ ] Evidence files saved to `.sisyphus/evidence/`
