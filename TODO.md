# MotoGT — Pending / TODO (session handoff)

_Last updated end of session 2026-06-16. Working tree clean; everything committed._

## Branch / merge state (most important)
| Branch | Contains | Merged? |
|---|---|---|
| `main` | V1 + **Phase A** (manager: pilots, brands, setup/risk, R&D, progression) | — |
| `v2-raceday` | **Phase B**: lap-by-lap race engine + interactive race-day view (live Attack/Defend/Settle, brand dots, speed control, ~10s/lap) | **NOT merged** |
| `v2-overnight` | Overnight polish + 2 kept balance experiments (off `v2-raceday`) | **NOT merged** |

**Decision needed:** integrate the chain. Suggested path once reviewed:
`v2-overnight` → `v2-raceday` → `main`. Everything is green at each branch (49 tests, clean build).
Review overnight work: `git checkout v2-overnight && git log v2-raceday..v2-overnight --oneline` + read `docs/OVERNIGHT-LOG.md`.

## Decisions waiting on you (from overnight — details in docs/OVERNIGHT-LOG.md)
- [ ] **Merge** the v2 chain to `main` (or cherry-pick).
- [ ] **Proposal P1 (not applied):** dilute the acceleration axis (`accelerationAxis = (bike.acceleration + pilot.pace)/2`) to fix Vortex/accel being structurally strongest. Changes the agreed "accel = brand-only" design — needs your OK.
- [ ] **Crash drama (not applied):** F2 lowered player crash rate to ~6.4%. Nudge `BASE_CRASH` up ~1.4× if you want ~9–10% crashes on screen.
- [ ] **Play-test feel:** confirm the race-day pacing (~80s at 1×), smoothing, and battle clarity feel right; tell me to tune laps/speed if not.

## Known / deferred items
- [ ] **Anti-overlap dot nudge** (race-day) — partially handled by the start grid + small permanent offset; a full pairwise-separation pass was deferred (jitter risk).
- [ ] **AI variety** — the 9 AI draw skills from only 6 archetypes (names are unique, but ~3 skill profiles repeat). Could give AI their own stat spreads.
- [ ] **Sweep test cost** — `tests/sweep.test.ts` runs in the normal suite (~adds a bit); fine for now, could gate behind a flag if it gets slow.
- [ ] **Phaser bundle ~1.3MB** — true code-split unsupported by the current rolldown-vite; warning lifted. Revisit if load time matters.
- [ ] No save/persistence and no audio (both intentionally out of scope so far).

## Future / roadmap (explicitly out of scope, parked)
- Multiple seasons / career progression, weather + tyre strategy, sponsors/economy, more tracks/pilots/brands.

## How to run
- Dev: `npm run dev` → http://localhost:5173/  ·  Tests: `npm test`  ·  Build: `npm run build`
- Balance sweep: `npx vitest run sweep` → writes `/tmp/sweep-report.txt`
- Specs/plans: `docs/superpowers/specs/` and `docs/superpowers/plans/`
