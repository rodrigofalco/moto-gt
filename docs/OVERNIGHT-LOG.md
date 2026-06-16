# Overnight Work Log — v2-overnight

> Autonomous self-paced session while the user sleeps. Branch: `v2-overnight` (off `v2-raceday`).
> Mandate: **bold but documented**. Focus: **balance experiments · race-day feel · polish/UX**.
> Guardrails: never touch `main`/`v2-raceday`; every commit keeps `npm test` green + `npm run build` clean;
> UI changes browser-verified via `tools/uiprobe.mjs`; bold balance/feel changes are tried on this branch and
> documented here with before/after numbers so they can be reverted/approved. Stop after ~7h or backlog done.

## How to review in the morning
- `git log v2-raceday..v2-overnight --oneline` — everything I did, each commit self-contained.
- This file = narrative: what changed, why, experiments, findings, and **decisions I want your input on**.
- Nothing is merged. Cherry-pick / merge what you like; tell me what to drop.

---

## Backlog (priority order)
1. [x] **Balance sweep & report** — done; see F1 findings.
2. [x] **Unique AI names** — done (`9f5aea6`).
3. [x] **Dead code** — done (`crashPenalty` removed).
4. [x] **Race-day: finish line** — checkered start/finish bar.
5. [x] **Race-day: overtake flash** — ▲/▼ Pn→Pm when the player changes place.
6. [ ] **Race-day: anti-overlap nudge** — deferred (grid-offset + EMA already keep packs legible; risk of jitter, low priority).
7. [x] **Result screen: standings movement arrows** (▲▼—) vs previous race.
8. [x] **Season-end: podium visual** (top 3) — done, medal blocks + brand dots.
9. [x] **Race-day: legend/help** — done (orders, bike colors, ring meanings).
10. [ ] **Balance experiment (bold):** try a variant if the sweep shows a dominant/weak build; measure; keep only if it improves spread, else document and revert.
11. [ ] **Bundle code-split** (Phaser chunk-size warning) if time permits.

## Findings & decisions for review

### F1 — Balance sweep (N=150, player vs 9 AI, "reasonable" policy)
Champion rate by **pilot** (avg across brands) and **brand** (avg across pilots):

```
PILOTS:  Hotshot 46% · Smooth Op 41% · Rocket 39% · Surgeon 32% · All-Rounder 28% · Metronome 26%
BRANDS:  Vortex 42% · Titan 35% · Velocita 33% · Apex 32%
Best combo:  Hotshot + Vortex 51%   |   Worst:  Metronome + Apex 21%
```

**Two real imbalances (the formal harness misses them because its 3 reference builds all have consistency≈6):**
- **Consistency is a trap stat.** Metronome (6/5/9, high consistency) is the *worst* pilot; Hotshot (9/8/3, low consistency, high offense) is the *best*. Offensive stats (pace+cornering) add to performance every lap; consistency only avoids the occasional ~10% crash — a bad trade. → high-consistency pilots underperform.
- **Acceleration / Vortex is the strongest axis (~42%).** Accel is *bike-only* (not blended with a pilot stat), so a Vortex bike delivers its full value undiluted, while speed/cornering axes are `(pilot+bike)/2` averages. The calendar also has 3 accel-leaning tracks.

**Decision for you:** these are pilot/brand-level imbalances, not the build-level co-equality the harness guards. I'll try ONE bold experiment (steepen consistency so it protects more) and measure; documented below. The accel-dilution fix touches the agreed axis model (accel = brand-only by design), so I'll **leave that as a proposal, not apply it** — your call.

### Proposals (NOT applied — need your decision)
- **P1 — Dilute acceleration** so Vortex isn't dominant: make `accelerationAxis = (bike.acceleration + pilot.pace)/2` (or scale accel weight down). Changes the "accel = pure brand stat" design intent, so I left it for you.

## Change log
- `9f5aea6` **Unique AI names** — added `AI_EXTRA_NAMES`; AI no longer show "X 2". Test asserts 9 unique. ✓ tests+build.
- `8c02b8b` **Balance sweep tool** — `tests/sweep.test.ts` writes `/tmp/sweep-report.txt`; added `node` to tsconfig types. ✓ tests+build.
- `_dead-code_` **Removed `crashPenalty`** + `CRASH_PENALTY_*` constants; updated crash test. ✓ tests(49)+build.
- **Finish line** — checkered start/finish bar on the track. ✓ browser-verified.
- **Overtake flash** — ▲/▼ Pn→Pm on place change (fades out). ✓ browser-verified (saw ▼P6→P7).
- **Movement arrows** — ▲▼— on result-screen standings vs the order before the race. ✓ browser-verified.
- **Season-end podium** — gold/silver/bronze blocks (1st centre tallest) with brand dots, names, points + full final standings. ✓ browser-verified (full 6-race season).
- **Race legend** — on-screen help: order meanings, bike color key, ring meanings. ✓ browser-verified.

### Next: item 10 (bold balance experiment — steepen consistency)
Plan: lower `CONSISTENCY_DIVISOR` (15→~9) and `CONSISTENCY_FLOOR` (0.35→~0.15) so high-consistency
pilots crash much less and low-consistency much more → consistency stops being a trap stat (F1).
Measure: `npx vitest run sweep` (pilot spread should tighten, Metronome up / Hotshot down) AND keep
`npx vitest run balance` green (re-tune LAP_NOISE_STD if it drifts). Revert if co-equality/feel regresses.
