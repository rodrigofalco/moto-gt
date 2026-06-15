# MotoGT v2 — Phase A: Manager Redesign (Spec)

> **Version:** 2.0-A
> **Date:** 2026-06-15
> **Status:** Approved design — pending spec review
> **Builds on:** the V1 canonical core (`docs/superpowers/specs/2026-06-15-motogt-v1-canonical-design.md`). The pure-`core/` layering, seeded RNG, points table (25…1), countback tiebreak, 10-rider/6-race format, and 3-scene Phaser shell are kept. The simulation, data model, season-start flow, and per-race decision are redesigned.
> **Out of scope (Phase B, separate spec):** the 2D race-day animation. Phase A must structure `performance` so Phase B can expand it into per-lap pace.

---

## 1. Goal

Turn the minimal V1 into a real racing manager. The player **chooses a pilot and a bike brand** (fixed identities for the season), and each race makes **two decisions — setup + risk** read against the **track's profile**. Pilot and bike **evolve over the season**. Builds stay **roughly co-equal** (no dominant strategy); depth comes from matching identity + setup + development to a varied calendar.

Keep: 10 riders, 6 races, single session, no save, TypeScript + Phaser + Vite, pure-`core/` logic with a Monte Carlo balance harness.

---

## 2. Attributes & the axis model

### 2.1 Pilot skills & bike params (each 1–10)

- **Pilot:** `pace`, `cornering`, `consistency`
- **Bike:** `speed`, `handling`, `acceleration`

### 2.2 Performance axes (pilot + bike fold into track-weighted axes)

```
speedAxis        = (pilot.pace      + bike.speed)        / 2     // 1..10
corneringAxis    = (pilot.cornering + bike.handling)     / 2     // 1..10
accelerationAxis =  bike.acceleration                            // 1..10 (bike-only)
```

- Speed and cornering blend pilot + bike (both matter). **Acceleration is bike-only** — the one axis only the brand provides, so brand choice is decisive on stop-go tracks.
- `consistency` is not a performance axis; it resists crashes (§4.3).

### 2.3 Tracks weight the axes

Each track carries weights over the three axes that **sum to 1.0**. A varied calendar means different pilot+bike combos win different rounds → builds stay co-equal.

| Track | Location | speed | cornering | acceleration | Character |
|---|---|---|---|---|---|
| Mugello | Italy | 0.50 | 0.30 | 0.20 | Power / flowing |
| Sachsenring | Germany | 0.20 | 0.60 | 0.20 | Technical |
| Red Bull Ring | Austria | 0.30 | 0.25 | 0.45 | Stop-go |
| Phillip Island | Australia | 0.40 | 0.45 | 0.15 | Fast flowing |
| Jerez | Spain | 0.20 | 0.45 | 0.35 | Technical + drive |
| Silverstone | UK | 0.35 | 0.40 | 0.25 | Balanced |

The calendar uses all six tracks in a shuffled order (variety is built into the set, so no extra spread invariant is needed).

---

## 3. Season-start selection (replaces point-buy)

On the main menu the player: enters a **team name**, picks **1 pilot** from the roster, picks **1 bike brand**. The 9 AI riders take distinct remaining pilots (roster padded with generated pilots if needed) and are each assigned a brand.

### 3.1 Pilot roster (`pace / cornering / consistency`)

| Pilot | Nickname | P | C | Cons | Identity |
|---|---|---|---|---|---|
| Marco Rossi | The Rocket | 9 | 5 | 5 | Speedster |
| Luca Bianchi | The Surgeon | 5 | 9 | 6 | Technician |
| Sven Larsson | The Metronome | 6 | 6 | 9 | Steady veteran |
| Diego Marquez | The All-Rounder | 7 | 7 | 6 | Balanced |
| Yuki Tanaka | The Hotshot | 8 | 7 | 3 | Fast but fragile |
| Sara Lindqvist | The Smooth Operator | 6 | 8 | 7 | Smooth & safe |

### 3.2 Bike brands (`speed / handling / acceleration`)

| Brand | S | H | A | Identity |
|---|---|---|---|---|
| Velocita | 9 | 5 | 6 | Rocket (straights) |
| Apex | 6 | 9 | 6 | Sweet handling |
| Titan | 7 | 7 | 7 | Balanced |
| Vortex | 6 | 6 | 9 | Drive monster |

> **Resolved:** selection is **free pick from handcrafted rosters** (no budget/economy). Pilot and brand are independent picks. AI riders get the remaining pilots/brands (assigned without the player's picks; generate extras if the pools run short).

---

## 4. The two per-race decisions & the simulation

Before each race the player reads the track and picks a **Setup** and a **Risk** level. AI pick both automatically (§4.5).

### 4.1 Setup (strategy) — bias the bike toward one axis

| Setup | Effect on this race's axes |
|---|---|
| `topSpeed` | speedAxis `+SETUP_BONUS`, cornering & accel each `−SETUP_PENALTY` |
| `handling` | corneringAxis `+SETUP_BONUS`, speed & accel each `−SETUP_PENALTY` |
| `acceleration` | accelerationAxis `+SETUP_BONUS`, speed & cornering each `−SETUP_PENALTY` |

Start values: `SETUP_BONUS = 1.5`, `SETUP_PENALTY = 0.75` (net ≈ 0). Matching the track's dominant axis is the skill; mismatch costs.

### 4.2 Risk (push) — speed vs. crash

| Risk | `pushBonus` | base crash chance |
|---|---|---|
| `low` | −1.0 | 0.03 |
| `medium` | 0.0 | 0.10 |
| `high` | +1.5 | 0.22 |

### 4.3 Crash model (track- & consistency-dependent)

```
consistencyFactor = max(CONSISTENCY_FLOOR, 1 − (consistency − 1) / CONSISTENCY_DIVISOR)
                    // FLOOR 0.35, DIVISOR 15 → consistency 10 ≈ 0.40, consistency 1 = 1.0
crashProb = BASE_CRASH[risk] * consistencyFactor * (1 + CRASH_TECH_FACTOR * track.cornering)
            // track.cornering weight is the "technical" proxy; CRASH_TECH_FACTOR start 1.0
crashProb = clamp(crashProb, 0, 0.90)
if (rng.nextFloat() < crashProb): crashed = true; penalty = CRASH_PENALTY_BASE + rng·CRASH_PENALTY_RANGE
            // base 4.0, range 6.0
```

So high push on a technical track is genuinely dangerous unless your consistency is high.

### 4.4 Performance & finishing order

```
base = STAT_SCALE * ( track.speed*speedAxis + track.cornering*corneringAxis + track.acceleration*accelerationAxis )
       // axes include the setup bias from §4.1
performance = base + pushBonus[risk] + gaussian(0, NOISE_STD_DEV) − (crashed ? penalty : 0)
```

`STAT_SCALE` start 1.0, `NOISE_STD_DEV` start 1.2 (both tuned by the harness). Sort by `performance` desc → positions 1–10 → points `[25,18,15,12,10,8,6,4,2,1]`. Intra-race ties broken by: higher speedAxis → corneringAxis → accelerationAxis → deterministic RNG. Crash flag recorded for UI.

### 4.5 AI setup & risk

Each AI rider, per race: **setup** = the track's highest-weighted axis with some randomness (mostly reads the track correctly, sometimes errs); **risk** = weighted by its consistency (high-consistency riders push more; low-consistency lean safe), plus mild randomness. Routed through the seeded RNG.

---

## 5. Progression (the season arc)

> **Resolved:** **pilot grows automatically; bike is player-invested.** Gain size is **flat base + small win bonus** (no snowball).

### 5.1 Pilot — automatic experience

Each race the pilot earns `PILOT_XP = PILOT_XP_BASE + (podium ? PILOT_XP_PODIUM : 0) + (win ? PILOT_XP_WIN : 0)` (start: base 10, podium +5, win +5). Accumulated XP converts at `PILOT_XP_PER_LEVEL` (start 25) into **+1 to one pilot skill** (capped at 10). The improved skill is the one tied to the **axis most weighted across the tracks raced so far** ("you get better at what you race"); ties broken deterministically. No UI decision — shown as a result-screen notification.

### 5.2 Bike — player-invested R&D

Each race the player earns `RND = RND_BASE + (podium ? RND_PODIUM : 0) + (win ? RND_WIN : 0)` development points (start: base 2, podium +1, win +1). Between races, on the Season hub, the player spends points (`+1` per point) on `speed`, `handling`, or `acceleration` (capped at 10). Unspent points carry over.

### 5.3 AI evolution

AI pilots gain XP and auto-level the same way. AI bikes auto-spend their R&D points on their **weakest param** (or the param most useful for upcoming tracks). AI gains use the same flat-base+win-bonus rates so the grid scales with the player and the title stays contested.

---

## 6. Data model (`src/core/types.ts`)

```typescript
type Setup = 'topSpeed' | 'handling' | 'acceleration';
type Risk  = 'low' | 'medium' | 'high';

interface PilotSkills { pace: number; cornering: number; consistency: number; }   // 1..10
interface BikeParams  { speed: number; handling: number; acceleration: number; }   // 1..10

interface PilotArchetype { id: string; name: string; nickname: string; skills: PilotSkills; }
interface Brand          { id: string; name: string; params: BikeParams; }

interface TrackWeights { speed: number; cornering: number; acceleration: number; } // sum = 1
interface Track { id: string; name: string; location: string; weights: TrackWeights; }

interface Rider {
  id: string; name: string; team: string; isPlayer: boolean;
  skills: PilotSkills;      // evolves automatically (pilot XP)
  bike: BikeParams;         // evolves via R&D investment
  pilotXp: number;          // accumulated, drives auto level-ups
  rndPoints: number;        // unspent bike development points
  points: number;
  positionCounts: number[]; // length 10, countback tiebreak
}

interface RaceEntry {
  rider: Rider; position: number; pointsAwarded: number;
  setup: Setup; risk: Risk; crashed: boolean; performanceScore: number;
}
interface RaceResult { raceIndex: number; track: Track; finishingOrder: RaceEntry[]; }

interface SeasonState {
  playerRider: Rider; aiRiders: Rider[];   // 9
  calendar: Track[];                        // 6
  currentRaceIndex: number;                 // 0..6
  raceResults: RaceResult[];
  isSeasonComplete: boolean;
}
```

---

## 7. Constants (`src/core/constants.ts`, all tunable)

```typescript
export const SEASON_RACE_COUNT = 6, GRID_SIZE = 10, AI_RIDER_COUNT = 9;
export const POINTS_TABLE = [25,18,15,12,10,8,6,4,2,1] as const;
export const STAT_MIN = 1, STAT_MAX = 10;

export const STAT_SCALE = 1.0;
export const NOISE_STD_DEV = 1.2;

export const SETUP_BONUS = 1.5, SETUP_PENALTY = 0.75;

export const PUSH_BONUS  = { low: -1.0, medium: 0.0, high: 1.5 } as const;
export const BASE_CRASH  = { low: 0.03, medium: 0.10, high: 0.22 } as const;
export const CONSISTENCY_DIVISOR = 15, CONSISTENCY_FLOOR = 0.35;
export const CRASH_TECH_FACTOR = 1.0;
export const CRASH_PENALTY_BASE = 4.0, CRASH_PENALTY_RANGE = 6.0;

export const PILOT_XP_BASE = 10, PILOT_XP_PODIUM = 5, PILOT_XP_WIN = 5, PILOT_XP_PER_LEVEL = 25;
export const RND_BASE = 2, RND_PODIUM = 1, RND_WIN = 1;

export const TARGET_BUILD_RATE: readonly [number, number] = [0.25, 0.45];
export const MAX_BUILD_RATE_SPREAD = 0.15;
```

---

## 8. Scenes & UI

Keep the 3-scene Phaser shell; expand each. All controls use the now-fixed `Button` (full-area hit + hover/press) and boxed selectors.

### 8.1 MainMenuScene → Selection
- Team-name field (native keyboard input, as fixed in V1).
- **Pilot picker:** a row/grid of the 6 archetype cards (name, nickname, three skill bars). Click to select (highlighted). 
- **Brand picker:** the 4 brand cards (three param bars). Click to select.
- START enabled once a team name, a pilot, and a brand are chosen.

### 8.2 SeasonScene (hub)
- Calendar with **track-type tags** (e.g. icons/labels for the dominant axis) and a small weight bar.
- Your **pilot card** (current skills) + **bike card** (current params), reflecting progression.
- **R&D panel:** "Development points: N" with `+` steppers on speed/handling/acceleration (disabled at 10 or when N=0).
- **Pre-race decisions:** Setup selector (3 boxed buttons) + Risk selector (3 boxed buttons), each with a one-line effect hint.
- Standings table (player highlighted). **SIMULATE RACE** button.

### 8.3 RaceResultScene
- Finishing order: pos / rider / setup / risk / crash flag / points; player highlighted.
- **Progression earned:** "Pilot improved: +1 Cornering", "Earned 3 R&D points".
- Updated standings with movement arrows. Next Race / season-end champion screen (with full final standings + your summary) and Play Again.

---

## 9. Balance harness (`tests/balance.test.ts`, rebuilt)

Monte Carlo, ≥1000 seasons each, seeded/deterministic, with a **reasonable player policy**: pick the bike-relevant brand pairing, choose **setup = track's dominant axis**, choose **risk by track + consistency** (push hard on fast tracks / when consistency high; safer on technical tracks), and invest R&D toward the weakest axis / upcoming tracks. Assert:

- Each of three reference identities (a **pace** pilot+bike, a **cornering** pilot+bike, a **balanced** pilot+bike) wins the title in **25–45%** of seasons.
- Spread `(max − min)` of those three rates ≤ **15 points** (co-equal).
- **Setup matters:** correct-setup policy beats always-`topSpeed` by ≥ 4 points for the cornering identity.
- **Risk matters:** track-aware risk beats always-`high` by ≥ 4 points.
- **No snowball:** with progression on, the field's end-of-season standings spread is not dramatically wider than a no-progression control (development keeps the title contested, doesn't run away).
- Invariants per race: 10 unique positions, points sum 101, player present, determinism under fixed seed.

Tune §7 constants until these hold; log all rates.

---

## 10. Migration from V1

- **Reuse:** `RNG`, `POINTS_TABLE`, countback standings/tiebreak (`Championship`), seeded-determinism patterns, Phaser shell, `Button`/boxed-selector UI, native text input, HMR-reload guard, the `tools/uiprobe.mjs` verification approach.
- **Rewrite:** `types.ts` (new entities), `constants.ts`, `RaceSimulator.ts` (axis model + setup/risk/crash), `MistakeSystem.ts` → crash model, factories (pilot/brand rosters, AI assignment, AI setup/risk + AI evolution), `SeasonScene`/`MainMenuScene`/`RaceResultScene` (selection, R&D, two-axis UI, progression display), `balance.test.ts`.
- **Remove:** point-buy (`validatePointBuy`, 18-pt budget), single `RidingStyle`, `CORNERING_MULTIPLIER`, old `STYLE_PACE_MODIFIER`, single-scalar `technicality`.

---

## 11. Edge cases

| Case | Handling |
|---|---|
| Stat/param already at 10 | `+` stepper / auto level-up skips it; pick next eligible (deterministic order) |
| No R&D points to spend | Steppers disabled; player can simulate without spending (points carry over) |
| Pilot pool < needed for AI | Pad with generated pilots (distinct names) |
| Crash with very high consistency | `CONSISTENCY_FLOOR` keeps a residual chance; never 0 |
| All-equal field | Noise + crashes produce a valid distribution; tiebreak by axes then RNG |
| Setup pushes an axis below realistic range | Allowed; axis values may dip but order is relative — no clamp needed for correctness |
| Simulate past calendar | Throw explicit error |

---

## 12. Phase B preview (separate spec, not built here)

The 2D race-day animation will expand `performance` into a **per-lap pace** (e.g. `lapTime ≈ K − performance + per-lap noise`, with crashes landing on a specific lap and setup/risk shaping the lap-by-lap arc), accumulate lap times into gaps, and animate riders as dots around a track layout with live position changes. Phase A's `RaceResult`/`RaceEntry` already carry setup, risk, crash, and `performanceScore` so Phase B can drive the animation without changing the core model.

---

## Appendix — open tuning notes
Starting constants in §7 are first guesses; the harness (§9) is the source of truth. Expect to adjust `STAT_SCALE`, `NOISE_STD_DEV`, `SETUP_BONUS/PENALTY`, crash params, and AI evolution rates to land the co-equal + no-snowball targets.
