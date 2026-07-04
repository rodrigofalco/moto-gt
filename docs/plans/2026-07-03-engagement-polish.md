# Plan: Engagement Polish v0.1 — more entertaining to watch

- **Status:** done (executed 2026-07-03; scope approved: full tire integration + both optional knobs)
- **Execution notes:** the BASE_CRASH ×1.3 nudge was **not** applied — measurement showed main's
  baseline player crash rate was already 14.4% (the ~6% figure in OVERNIGHT-LOG was from an old
  branch config), and tire crash risk keeps it at 14.5%, past the approved 9-10% target. Two
  latent bugs found and fixed along the way: OffSeasonScene re-ran `runOffSeason` on a report
  the caller had already generated (double aging/churn per off-season), and SeasonScene's
  `bikeButtons` accumulated destroyed text objects across scene revisits (crash on race 2+).
- **Plan ID:** `plan-engagement-v01`
- **Implements Spec:** `docs/goals/motogtv01.md` (goal doc used directly as spec)
- **Date:** 2026-07-03
- **Author:** Claude (Fable 5)

## Goal

Make MotoGT more engaging to watch and play, per `docs/goals/motogtv01.md`:

1. The game runs and a full season is playable.
2. No UI element overflow or overlap.
3. The simulation feels "somehow real, but fun."

Constraints: polish existing features rather than add new ones; stay 2D.

## Current-state findings (explored 2026-07-03)

- All 139 unit tests pass; `tools/app-flow.test.mjs` passes end-to-end (MainMenu → Season → Race → Results).
- **Watchability gaps:** commentary is a single-line ticker that drops events (2.2 s dwell, bursts lost); the `battle` commentary category is never generated (`tire_warning` is even mis-tagged as `battle` in `Commentary.ts:155`); crashes just turn a dot red and freeze; wet races look identical to dry ones (only a 🌧️ emoji); drafting — a real sim mechanic — is invisible; the final lap and finish have no build-up.
- **Overflow/overlap found in screenshots + code:**
  - SeasonScene: unaffordability "X" (`SeasonScene.ts:151`, drawn at fixed x+90) overlaps the `[+] param (cost)` labels.
  - RaceScene: "Orders" label (`RaceScene.ts:137`) collides with its panel border; leaderboard names hard-truncated to 9 chars (`slice(0,9)`); callout line can exceed panel width; gap column breaks alignment on `+LAP`/large gaps.
  - RaceResultScene: `name.padEnd(16)` misaligns columns for 17-char names ("Alessandro Moretti"); standings names cut at 16 chars mid-word.
  - StandingsTable: names drawn unclipped in a 150 px column — long names bleed into the Pts column.
  - OffSeasonScene: retired/rookie name lists have no wordWrap (overflow with long names); stat-change lines print raw `riderId` instead of display names.
  - Season/Results screens leave ~400 px of dead space at the bottom (content stops ~y 700 on a 1100-tall canvas).
- **"Real but fun" gaps (sim depth that exists but is disconnected):**
  - Tire compound choice has **no effect on race results**: `TireModel` is only applied as a post-multiplier inside the interactive `RaceScene`; the headless engine (`simulateRace`, used for skipped races/balance) never sees tires. The soft/medium/hard tradeoff is decorative.
  - `getTireCrashRisk` (`TireModel.ts:25`) is defined but never called — worn tires never raise crash odds.
  - Tier `aiStatBonus` (`tiers.ts`) is never applied — promotion to pro/factory changes a label but not difficulty.
- **Balance guardrails (must stay green):** `tests/balance.test.ts` asserts champion rate per reference build ∈ [0.25, 0.45], build spread ≤ 0.15, setup and risk adaptivity each worth ≥ 0.04 win rate, crash rate ∈ (0.03, 0.30).

## Approach

Three workstreams, executed in one pass, ordered so the sim change lands first (it feeds the presentation), UI fixes land with the scenes they touch, and everything is verified against the balance suite + headless full-season playthrough.

### Workstream A — Tires become real (sim: "real but fun")

Move tire wear/grip out of `RaceScene` into `RaceEngine.stepLap` so compound choice affects every race — watched, skipped, and simulated:

- `RiderState` gains tire state (compound, wear). `stepLap` applies grip to the pace deviation and advances wear via `calcTireWear`; wire `getTireCrashRisk` into the per-lap crash probability so worn tires add late-race jeopardy.
- AI compounds chosen in `AIDecision.ts` (e.g., by consistency and track length/character) so the field varies.
- `RaceScene.applyTireWearAndGrip` is deleted (single source of truth); the scene just reads wear for display.
- Re-run `balance.test.ts` + `sweep.test.ts`; retune `TIRE_COMPOUNDS` / `FIELD_COMPRESSION`-adjacent constants in `constants.ts` if targets drift. Soft-vs-hard should be a genuine tradeoff (soft wins short stints, punishes the last laps).

### Workstream B — Race-day spectacle (entertaining to watch)

All in the presentation layer; no balance impact:

1. **Commentary feed**: replace the single-line ticker with a 3–4 line scrolling feed (newest bright, older fading) fed by a queue with minimum dwell so bursts aren't dropped. Generate the dead `battle` category (riders within a gap threshold for consecutive laps); fix the `tire_warning` mis-tag.
2. **Crash moment**: brief skid/spin flash + fading marker where a rider goes down, tiny camera shake, crash commentary already exists.
3. **Draft/battle visibility**: subtle slipstream glow behind a rider giving a tow; battle indicator when the player is within striking distance.
4. **Wet races look wet**: rain streak particles + darker, blue-tinted track when `weather === 'wet'`.
5. **Finale build-up**: "FINAL LAP" banner, checkered-flag flourish at the line, brief hold on the finishing order before the result scene.
6. **Live timing polish**: ellipsis truncation instead of hard `slice`, stable column widths (handles `+LAP`), live ▲▼ position-change flashes in the board, tire wear shown as a colored state (green→yellow→red) — now driven by real engine wear from Workstream A.

### Workstream C — UI overflow/overlap sweep (DoD #2)

- New tiny helper in `src/ui/` (`fitText`/ellipsis-to-width) used everywhere names render.
- Fix each spot listed in findings (SeasonScene X-overlay → gray-out unaffordable buttons; Orders label; result-table alignment via measured columns; StandingsTable clipping; OffSeason wordWrap + display names).
- Tighten vertical layout on Season/Results so content doesn't float in the top half of the canvas (move CTA buttons up, no canvas-size change).
- Screenshot sweep of every scene with the longest roster names to verify.

### Optional knobs (decided at go-ahead)

- **Crash drama**: nudge `BASE_CRASH` up (~×1.2–1.4) to restore ~9–10% player crash rate (currently ~6%), staying inside the 3–30% test band.
- **Tier difficulty**: apply the dead `aiStatBonus` so promotion to pro/factory actually stiffens the AI field (touches `OffSeason.ts`/`RiderFactory.ts`).

## Files to Change

| Area | Files |
|---|---|
| Sim (A) | `src/core/RaceEngine.ts`, `src/core/TireModel.ts`, `src/core/AIDecision.ts`, `src/core/constants.ts`, `src/core/types.ts` |
| Presentation (B) | `src/scenes/RaceScene.ts`, `src/core/Commentary.ts`, `src/core/raceView.ts` |
| UI fixes (C) | `src/scenes/SeasonScene.ts`, `src/scenes/RaceResultScene.ts`, `src/scenes/OffSeasonScene.ts`, `src/ui/StandingsTable.ts`, `src/ui/text.ts` (new helper) |
| Optional knobs | `src/core/constants.ts`, `src/core/OffSeason.ts`, `src/core/factories/RiderFactory.ts` |
| Tests | `tests/raceEngine.test.ts` (tire integration), `tests/commentary.test.ts` (battle events), balance/sweep re-run; extend `tools/app-flow.test.mjs` to play a full 6-race season headlessly |

## Testing Plan

- `npm run test` (incl. balance + sweep) and `npm run build` green after each workstream.
- Extended `tools/app-flow.test.mjs`: full-season headless playthrough (6 races → season end → off-season) with zero console/page errors — proves DoD #1.
- Screenshot review of every scene (long names, wet race, crash, final lap) — proves DoD #2.
- Sweep report before/after Workstream A to confirm tire integration didn't skew pilot/brand balance — supports DoD #3.

## Risks and Open Questions

- **Balance drift from tire integration** is the main risk: wear depends on consistency, so it shifts pilot balance. Mitigation: medium compound tuned to be near-neutral; re-run the sweep and retune compound constants, not core pace constants.
- Rain particles: keep count low; verify no frame drops at 4× speed.
- Overlap fixes are mechanical/low-risk.

## Related

- Goal: `docs/goals/motogtv01.md`
- Prior art: `docs/OVERNIGHT-LOG.md` (crash-rate note, overtake flash, podium work)
