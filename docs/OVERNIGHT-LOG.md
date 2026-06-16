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
10. [x] **Balance experiment (bold):** consistency steepened — KEPT (see F2).
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

### F2 — Consistency experiment (item 10): KEPT ✅
Changed `CONSISTENCY_DIVISOR` 15→9 and `CONSISTENCY_FLOOR` 0.35→0.15 so high-consistency pilots
crash much less / low-consistency much more.

| Metric | Before | After |
|---|---|---|
| Pilot win-rate spread | 20.3pt (Hotshot 46% / Metronome 26%) | **17.5pt** (Smooth Op 46% / Metronome 29%) |
| Hotshot (c3, fragile) | 46.3% runaway best | 41.2% (now 2nd) |
| Metronome (c9, steady) | 26.0% worst | 28.7% (off the bottom) |
| Formal co-equal builds | 30.6/26.8/29.4 ✓ | 31.7/28.0/30.4 ✓ |
| Player crash rate | 10.7% | 6.4% (still in 3–30% band) |

Verdict: kept — consistency is now a meaningful stat without breaking co-equality. **Note for you:**
crash frequency dropped (6.4%); if you want more race-day drama, nudge `BASE_CRASH` up ~1.4× (would
restore ~9–10% crashes while keeping the steeper consistency curve). Left as a tunable, not applied.
