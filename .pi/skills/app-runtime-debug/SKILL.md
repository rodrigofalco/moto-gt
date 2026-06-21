---
name: app-runtime-debug
description: Debug the MotoGT app at runtime via Playwright — capture browser console errors and uncaught exceptions, drive the real UI click-by-click through scene transitions, and pinpoint which button/scene crashes. Use when buttons don't work, a scene won't advance, the app freezes, or a runtime crash is suspected. Complements playwright-visual-testing (which is for visual regression, not runtime bugs).
---

# App Runtime Debug for MotoGT

Use this skill to hunt **runtime/behavioral bugs** — the kind visual screenshot
review cannot see: uncaught exceptions, dead buttons, broken scene transitions,
frozen state. The primary signal is the **browser console** (`console.error`
and uncaught `pageerror`), not pixels.

## When to use

- "Buttons don't work" / "can't advance to the next screen"
- A scene freezes or the app goes black after an action
- A runtime crash is suspected (TypeError, undefined access, etc.)
- After wiring a new dependency into scenes, verify nothing throws
- Regression guard after touching `main.ts`, scene `init`/`create`, or any
  cross-scene wiring (sound, save, career, etc.)

**Do NOT use for:** visual layout issues (use `playwright-visual-testing`),
unit-testable logic (use `vitest`), or balance tuning (use `sweep.test.ts`).

## How it works

Run the debug probe from the project root (needs `npm run dev` running):

```bash
node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs
```

The probe:

1. Auto-detects the Vite dev server port (5173, then 5174, 5175…)
2. Opens the game in headless Chromium at the real 1024×1100 viewport
3. **Captures every `console.error` and uncaught `pageerror`** — these reveal
   runtime crashes with file:line stack traces
4. Drives the real UI click-by-click through the full flow:
   MainMenu → pick pilot/bike → type team → START SEASON → Season →
   GO TO GRID → Race → SKIP → Results
5. Maps game coordinates → screen pixels via the Phaser FIT scale, then clicks
   the canvas at the right spots (no DOM selectors needed — Phaser renders to
   a single canvas)
6. Asserts each scene transition by reading the active Phaser scene key off
   `window.__game`
7. Saves a screenshot per step to `/tmp/debug-probe-*.png` for correlation
8. Prints a per-step ✓/✗ report plus the full error text, and exits non-zero
   on any failure or console error

## Options

```bash
# Full flow (default) — all scenes, exit non-zero on any error
node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs

# Stop after reaching a specific scene (don't drive past it)
node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs --stop season

# Explicit port (skip auto-detect)
node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs --port 5174

# Keep browser open briefly on failure for inspection (headed)
node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs --headed
```

## Reading the output

A healthy run looks like:

```
[1/5] Load app — MainMenu           ✓ reached MainMenuScene
[2/5] MainMenu — START SEASON       ✓ reached SeasonScene
[3/5] Season — GO TO GRID           ✓ reached RaceScene
[4/5] Race — SKIP                   ✓ reached RaceResultScene
=== PASS === (0 console errors, 0 page errors)
```

A crashing run pinpoints the bug:

```
[3/5] Season — GO TO GRID           ✗ reached RaceScene (got SeasonScene)
--- browser errors ---
pageerror: Cannot read properties of undefined (reading 'playClick')
    at Button.onClick ... SeasonScene.ts:249:11
```

The stack trace names the exact file:line and the failing expression — go fix
that, then re-run the probe to confirm green.

## CRITICAL: do not mask bugs with fake stubs

The older `scene-shot.mjs` tool injects a fake `__soundEngine` stub onto the
game object so screenshots render cleanly. **That masks real crashes** — it is
exactly why the sound-engine bug (every sound-playing button crashing) went
undetected. This probe deliberately does **NOT** inject any stubs. If a scene
depends on something missing from the real app, the probe lets it crash so you
can see and fix it. Never add stubs here; if you need a scene to be probeable,
fix the app wiring instead.

## Coordinate mapping (how clicks land on the canvas)

Phaser renders to a single `<canvas>` FIT-scaled into `#game-container`. The
probe computes the scale + offset each run:

```
scaleX = canvas.getBoundingClientRect().width  / 1024
scaleY = canvas.getBoundingClientRect().height / 1100
screenX = canvasLeft + gameX * scaleX
screenY = canvasTop  + gameY * scaleY
```

So you click by **game coordinates** (the x/y you see in scene source), not
DOM coordinates. If a button moves, update the coordinate in the probe's
`STEPS` table — or, preferably, expose the button's game coords via a tiny
dev hook so the probe stays in sync.

## Requirements

- `npm run dev` running (the probe auto-finds the port)
- Playwright Chromium installed: `npx playwright install chromium`
- Ollama is **not** required (this skill is about runtime errors, not vision)

## Adding new steps

The probe's `STEPS` array lists each click + expected scene. To cover a new
flow (e.g. OffSeason, SaveLoad), add an entry with the button's game coords
and the expected next scene key. Keep steps small and ordered so a failure
report points at the exact broken transition.
