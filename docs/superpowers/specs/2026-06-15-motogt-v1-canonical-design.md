# MotoGT — Canonical V1 Specification

> **Version:** 1.0 (canonical)
> **Date:** 2026-06-15
> **Status:** Approved design — ready for implementation planning
> **Supersedes:** the five candidate specs in `specs/` (deepseek-v4-pro, qwen3.7-plus, qwen3.6-plus, glm-5.1, kimi-k2.7-code)

This document is the single source of truth for MotoGT V1. It merges the five candidate specs and resolves every divergence between them. Where the candidates disagreed, the chosen option and its rationale are recorded inline under **Resolved divergence** callouts.

---

## 1. Vision & Scope

### 1.1 Product

MotoGT is a minimalist motorcycle racing **manager**. The player guides a single rider through a **6-race season** against **9 AI riders** on a 10-rider grid. There is no real-time physics and no reflex play. The core loop is **one decision per race** — choosing a riding style — and the simulated results that follow. A full season takes about five minutes.

- **Genre:** Racing/sports management (menu-driven, text-based)
- **Inspiration:** Motorsport Manager
- **Mode:** Single player, single session, no save

### 1.2 Philosophy: "Finish first, expand later"

V1 is deliberately minimal. The goal is one complete, publishable, replayable season loop. Everything that bogged down earlier attempts is **explicitly out of scope**: budget/money, R&D/bike upgrades, staff/engineers/contracts, sponsors, weather, tire strategy, multiple seasons, rider avatars, lap-by-lap live view.

### 1.3 What makes V1 worth playing

Depth comes entirely from the interaction of three things: the **point-buy build** chosen at season start, the **per-race style decision**, and the **track type** of each round. The design (Section 4) gives each stat a distinct role so these three inputs genuinely interact rather than collapsing into one dominant number.

---

## 2. Architecture

### 2.1 Stack

| Component | Technology | Version |
|---|---|---|
| Language | TypeScript (strict) | 5.x |
| Engine | Phaser 3 | 3.80+ |
| Bundler | Vite | 5.x |
| Runtime | Modern browser (ES2020+) | — |
| Testing | Vitest | latest |

### 2.2 Layering principle

A **pure `core/` layer with zero Phaser dependencies** holds all game logic: data types, the race simulator, the mistake system, AI style selection, factories, championship/standings math, the seeded RNG, and all tunable constants. Phaser is used only for rendering, input, and scene transitions in `scenes/` and `ui/`.

> **Why:** This separation is what makes the **balance harness** (Section 8) possible — the simulation can run thousands of headless seasons in tests without a browser.

### 2.3 Project structure

```
moto-gt/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.ico
├── src/
│   ├── main.ts                 # Entry: creates Phaser.Game
│   ├── config.ts               # Phaser GameConfig
│   ├── core/                   # PURE logic — no Phaser imports
│   │   ├── constants.ts        # All tunable constants (Section 9)
│   │   ├── types.ts            # All interfaces/types (Section 3)
│   │   ├── RNG.ts              # Seeded RNG wrapper
│   │   ├── RaceSimulator.ts    # Performance-score engine (Section 4)
│   │   ├── MistakeSystem.ts    # Mistake probability + penalty
│   │   ├── AIStyleSelector.ts  # Consistency-biased AI style choice
│   │   ├── Championship.ts     # Standings + tiebreak (countback)
│   │   └── factories/
│   │       ├── RiderFactory.ts # Player (point-buy) + AI riders
│   │       └── SeasonFactory.ts# Calendar + season assembly
│   ├── data/
│   │   ├── tracks.ts           # Track bank
│   │   └── names.ts            # Rider/team name banks
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MainMenuScene.ts
│   │   ├── SeasonScene.ts
│   │   └── RaceResultScene.ts
│   └── ui/
│       ├── Button.ts
│       ├── Panel.ts
│       ├── StatStepper.ts      # Point-buy stepper control
│       ├── StandingsTable.ts
│       └── StatBar.ts
├── tests/
│   ├── simulation.test.ts
│   ├── balance.test.ts         # Monte Carlo balance harness
│   └── championship.test.ts
├── specs/                      # The five candidate specs (historical)
└── docs/superpowers/specs/     # This canonical spec
```

### 2.4 Scene graph

```
BootScene ──► MainMenuScene ──► SeasonScene ⇄ RaceResultScene
                  ▲                                  │
                  └──────────────────────────────────┘
                       (only on season end → Play Again)
```

| Scene | Purpose | Transitions to |
|---|---|---|
| `BootScene` | Load fonts/minimal assets | `MainMenuScene` (auto) |
| `MainMenuScene` | Title; rider/team names; **point-buy** | `SeasonScene` |
| `SeasonScene` | Calendar, standings, style choice, simulate | `RaceResultScene` |
| `RaceResultScene` | Race results + updated standings; season-end variant | `SeasonScene` or `MainMenuScene` |

### 2.5 State management

> **Resolved divergence — state passing.** Candidates proposed scene params, Phaser `registry`, a `window` global, and an `EventBus`. **Chosen: explicit `scene.start('SceneName', data)` params.** For a 4-scene linear flow this is the simplest to reason about and needs no extra infrastructure.

The full `SeasonState` lives in memory for the session (no persistence). It is created by `MainMenuScene`, mutated by `SeasonScene` after each simulation, forwarded to `RaceResultScene`, and passed back. A reload restarts the game.

---

## 3. Data Model

```typescript
// === Core enums & stats ===
type RidingStyle = 'safe' | 'balanced' | 'aggressive';

interface RiderStats {
  pace: number;        // 1..10 — raw speed (dominant on every track)
  cornering: number;   // 1..10 — technical speed (scales with track technicality)
  consistency: number; // 1..10 — error resistance (lowers mistake probability ONLY)
}

// === Rider ===
interface Rider {
  id: string;
  name: string;
  team: string;
  isPlayer: boolean;
  stats: RiderStats;
  points: number;            // championship points, starts 0
  positionCounts: number[];  // length 10: [#P1, #P2, ... #P10] — drives countback tiebreak
}

// === Track ===
interface Track {
  id: string;
  name: string;
  location: string;
  technicality: number; // 0..1 — how much cornering matters here
}

// === Race results ===
interface FinishingPosition {
  position: number;          // 1..10
  rider: Rider;
  pointsAwarded: number;
  performanceScore: number;  // for debug/UI
  hadMistake: boolean;
}

interface RaceResult {
  raceIndex: number;         // 0..5
  track: Track;
  playerStyle: RidingStyle;
  finishingOrder: FinishingPosition[]; // length 10, position ascending
}

// === Season ===
interface SeasonState {
  playerRider: Rider;
  aiRiders: Rider[];         // exactly 9
  calendar: Track[];         // exactly 6
  currentRaceIndex: number;  // 0..6 (6 = season over)
  raceResults: RaceResult[];
  isSeasonComplete: boolean;
}
```

**Invariants:**
- `aiRiders.length === 9`, `calendar.length === 6`
- `raceResults.length === currentRaceIndex`
- exactly one rider has `isPlayer === true`
- `positionCounts` has length 10 and sums to `currentRaceIndex` per rider

> **Resolved divergence — track model.** Candidates used `technicalFactor` 0–1, `technicality` 1–10, and a `corners`+`straightLength` pair. **Chosen: a single `technicality` scalar in [0,1].** It is the minimum needed to drive the cornering bonus; recommended values stay in [0.2, 0.85] so no track fully nullifies a stat.

> **Resolved divergence — tiebreak data.** Candidates used a `positionCounts` countback ladder vs. a wins→podiums→best-finish chain. **Chosen: `positionCounts` countback** — fully deterministic, motorsport-authentic, and needs no alphabetical fallback in practice.

---

## 4. Simulation Engine (the heart)

### 4.1 Stat-role separation

> **Resolved divergence — sim philosophy.** Most candidates folded all three stats into one weighted speed value (making consistency a minor speed bonus). **Chosen: DeepSeek's stat-role separation**, where each stat has one non-overlapping job. This is what gives point-buy builds identity and makes the style decision meaningful.

| Stat | Sole job |
|---|---|
| **Pace** | Raw speed — dominant term, every track |
| **Cornering** | Technical speed — bonus scaled by track `technicality` |
| **Consistency** | Error resistance — lowers mistake probability; **never adds speed** |

### 4.2 Performance score formula

> **Resolved divergence — score direction & style modifier.** Candidates split on higher-vs-lower-is-better and additive-vs-multiplicative style modifiers. **Chosen: higher = better, additive style modifier.** Most legible; the score reads directly as "who's fastest today."

For each rider with chosen `style` on track `t`:

```
performanceScore =
      pace                                    // 1..10, dominant
    + corneringContribution                   // 0..3
    + styleModifier                           // safe −2 / balanced 0 / aggressive +2
    + gaussianNoise(0, NOISE_STD_DEV)         // a good/bad day (σ = 1.5)
    − mistakePenalty                          // 0, or MISTAKE_PENALTY_BASE..+RANGE

corneringContribution = (cornering / 10) * technicality * CORNERING_MULTIPLIER   // mult = 3.0
```

### 4.3 Mistake system

```
mistakeProbability(style, consistency) = BASE_MISTAKE_PROB[style] * consistencyFactor
    BASE_MISTAKE_PROB = { safe: 0.02, balanced: 0.10, aggressive: 0.25 }
    consistencyFactor = max(CONSISTENCY_FLOOR, 1 − (consistency − 1) / CONSISTENCY_DIVISOR)
                        // CONSISTENCY_FLOOR = 0.01, CONSISTENCY_DIVISOR = 15
                        // consistency 1 → 1.00, 5 → 0.72, 10 → 0.40

if (rng.nextFloat() < mistakeProbability):
    mistakePenalty = MISTAKE_PENALTY_BASE + rng.nextFloatRange(0, MISTAKE_PENALTY_RANGE)
                     // base 4.0, range 6.0 → penalty in [4, 10]
```

A mistake of 4–10 points against a no-mistake score range of roughly −1..15 usually drops a rider toward the back — but a high-`pace` rider can still recover a points-paying place, which is intended (an error isn't always last place).

### 4.4 Noise

Gaussian, mean 0, `σ = NOISE_STD_DEV = 1.5` (≈95% within ±3.0). Implemented via Box–Muller or sum-of-uniforms through the seeded RNG. Guarantees races are never fully deterministic and lower-stat riders retain a real-but-small upset chance.

### 4.5 Finishing order & intra-race tiebreak

Sort by `performanceScore` descending. On an exact score tie (vanishingly rare with float noise): higher `pace`, then `cornering`, then `consistency`, then a deterministic RNG coin flip. Assign positions 1–10 and `POINTS_TABLE` points.

### 4.6 Algorithm

```
simulateRace(season, playerStyle, rng) -> RaceResult
  track = season.calendar[season.currentRaceIndex]
  for each rider in [playerRider, ...aiRiders]:
     style   = rider.isPlayer ? playerStyle : AIStyleSelector.select(rider, rng)
     score   = pace + corneringContribution(rider, track) + styleModifier(style) + noise(rng)
     mistake = rng.nextFloat() < mistakeProbability(style, rider.stats.consistency)
     if mistake: score -= mistakePenalty(rng)
     record { rider, style, score, mistake }
  sort records by score desc (apply intra-race tiebreak)
  assign positions 1..10 and POINTS_TABLE points
  return RaceResult
```

After a race, the caller adds `pointsAwarded` to each rider's `points`, increments `positionCounts[position-1]`, appends the `RaceResult`, and increments `currentRaceIndex`.

---

## 5. Scoring & Standings

### 5.1 Points table

```typescript
const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]; // sum = 101
```

All 10 finishers score. Season max for one rider: 150 (6 wins).

### 5.2 Championship tiebreak (countback)

Sort by `points` desc, then:
1. More P1s (`positionCounts[0]`), then more P2s, … through P10 (countback ladder).
2. Higher `pace`, then `cornering`, then `consistency`.
3. Deterministic RNG coin flip (effectively never reached).

---

## 6. Riders, AI & Generation

### 6.1 Player rider — point-buy

> **Resolved divergence — player stats.** Candidates ranged from fixed 6/6/6 to 7/6/6 to optional point-buy. **Chosen: point-buy.** The player distributes **18 points** across the three stats at season start, each stat in [1, 10]. This adds one upfront strategic decision (speedster vs. technician vs. safe finisher) and replay variety, paid for with a small MainMenu widget.

Validation: must spend exactly 18; each stat ∈ [1, 10]; "Start Season" disabled until satisfied.

### 6.2 AI riders

- **Stats:** each ∈ [2, 9], sum ∈ [14, 21] (no degenerate rivals). Generated via rejection sampling with a safety valve.
- **Names/teams:** drawn without repetition from the banks in `data/names.ts`. If a bank is exhausted, fall back to generated names ("Rider 1"…).

> **Resolved divergence — AI style choice.** Candidates split between flat 25/50/25 and consistency-biased weighting. **Chosen: consistency-biased.** High-consistency riders lean aggressive, low-consistency lean safe — coherent "personalities" rather than noise. The selector maps an `aggressionScore = pace − consistency` to weighted Safe/Balanced/Aggressive buckets, then rolls via the seeded RNG.

### 6.3 Calendar

6 tracks shuffled from the bank, with an **invariant**: at least one track with `technicality < 0.3` and at least one with `> 0.7`, so both pace-builds and cornering-builds get a track that favors them.

### 6.4 RNG

> **Resolved divergence — RNG.** Candidates split between `Math.random()` and seeded. **Chosen: a seeded `RNG` wrapper** (mulberry32/xorshift) exposing `nextFloat()`, `nextFloatRange(min,max)`, `nextInt(min,max)`, `pick<T>(arr)`, and `gaussian(mean,std)`. Defaults to a time-derived seed in play; tests inject a fixed seed for deterministic races. All randomness routes through this wrapper.

---

## 7. Scenes & UI

### 7.1 MainMenuScene

Title, rider-name field, team-name field, and the **point-buy widget**: three `StatStepper` controls (Pace/Cornering/Consistency) with +/− buttons, a live "Points remaining: N" counter, and per-stat clamping to [1,10]. Names: 1–20 chars, non-empty after trim. "INICIAR" / "Start Season" enabled only when both names are valid and exactly 18 points are allocated. On start: `SeasonFactory.create(...)` → `SeasonScene`.

### 7.2 SeasonScene

Three-panel hub:
- **Calendar (left):** 6 tracks; done = ✓ grey, current = ► highlighted, future = dim; each shows a technicality bar.
- **Next race (center):** track name/location, technicality bar, flavor text; player stat bars; **style selector** (3 radio buttons with risk descriptions); large **SIMULATE** button (enabled once a style is chosen).
- **Standings (right):** Pos / Rider / Team / Points, player row highlighted, ordered with tiebreaks.

On SIMULATE: disable button, run `RaceSimulator.simulate`, mutate `SeasonState`, transition to `RaceResultScene`.

### 7.3 RaceResultScene

- **Finishing order:** Pos / Rider / Points / mistake flag (⚠), player row highlighted; extra line if the player erred.
- **Updated standings:** with movement arrows (▲▼—) vs. the previous race (none after race 1).
- **Performance message:** dynamic by finishing position / mistake.
- **Continue button:** "Next Race →" if `currentRaceIndex < 6`, else "Final Results".
- **Season-end variant** (`currentRaceIndex === 6`): champion banner (name/team/points), podium 2nd/3rd, player summary (final position, wins, podiums, mistakes), **Play Again** → resets state → `MainMenuScene`.

### 7.4 Visual style

- Palette: bg `#1a1a2e`, panel `#16213e`, text `#e0e0e0`, highlight `#f5c518`, accent `#e94560`, player row `#0f3460`, success `#00c853`, error `#ff1744`.
- Type: bold racing display font for titles (e.g. Kanit), legible sans/mono for body.
- Base resolution 1024×768, `Scale.FIT` + `CENTER_BOTH`. Desktop/tablet first.

---

## 8. Balance (mandated)

The simulation constants **cannot be eyeballed** to hit the agreed target. The spec mandates a **Monte Carlo balance harness** that runs ≥1000 seasons and asserts:

- **Target — skill-expressive, ~winnable:** a representative point-buy player playing reasonable styles wins the championship in **30–45%** of seasons; playing poorly drops well below that. (Constants in `constants.ts` are tuned until this holds.)
- Aggressive style yields more mistakes on average than safe.
- Higher `pace` correlates with more wins.

If the harness fails, constants are retuned — logic is never touched. This harness is the acceptance gate for "balanced."

---

## 9. Constants (single source — `core/constants.ts`)

```typescript
export const SEASON_RACE_COUNT = 6;
export const GRID_SIZE = 10;
export const AI_RIDER_COUNT = 9;

export const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

export const PLAYER_STAT_BUDGET = 18;     // point-buy total
export const STAT_MIN = 1, STAT_MAX = 10;
export const AI_STAT_MIN = 2, AI_STAT_MAX = 9;
export const AI_SUM_MIN = 14, AI_SUM_MAX = 21;

export const CORNERING_MULTIPLIER = 3.0;
export const NOISE_STD_DEV = 1.5;

export const STYLE_PACE_MODIFIER = { safe: -2, balanced: 0, aggressive: +2 } as const;
export const BASE_MISTAKE_PROB   = { safe: 0.02, balanced: 0.10, aggressive: 0.25 } as const;
export const CONSISTENCY_DIVISOR = 15.0;
export const CONSISTENCY_FLOOR   = 0.01;
export const MISTAKE_PENALTY_BASE  = 4.0;
export const MISTAKE_PENALTY_RANGE = 6.0;

// Champion-rate target for the balance harness:
export const TARGET_CHAMPION_RATE = [0.30, 0.45] as const;
```

> All gameplay tuning happens here. No magic numbers in logic files.

---

## 10. Edge Cases

| Case | Handling |
|---|---|
| Exact score tie in a race | pace → cornering → consistency → deterministic RNG flip |
| Championship points tie | countback ladder → stats → RNG flip (§5.2) |
| Title mathematically decided early | Season still completes all 6 races; standings reflect reality |
| Player mathematically eliminated | No special casing; play continues for placing |
| All stats equal across grid | Noise + mistakes produce a valid uniform-ish distribution |
| Stat at limit (1 or 10) | Formulas clamp via `CONSISTENCY_FLOOR`; no division issues |
| Empty/whitespace names | Blocked in MainMenu; trim + min length 1 |
| Point-buy ≠ 18 or stat out of [1,10] | Start button disabled |
| No WebGL/canvas | Phaser `AUTO` falls back to canvas; show a message if neither |
| Browser reload mid-season | Progress lost (no save in V1); optional beforeunload warning |
| `simulate` called with `currentRaceIndex >= 6` | Throw explicit error |

---

## 11. Testing

1. **Per-race invariants:** 10 unique positions; points sum = 101; player always present (`tests/simulation.test.ts`).
2. **Determinism:** fixed seed → byte-identical `RaceResult`.
3. **Balance harness:** §8 assertions (`tests/balance.test.ts`).
4. **Championship:** countback tiebreak resolves correctly; points accumulate correctly (`tests/championship.test.ts`).
5. **Generation:** AI stats within bounds; calendar technicality-spread invariant holds; point-buy validation.
6. **Integration:** full 6-race season completes, `isSeasonComplete` true, a champion exists.

---

## 12. Roadmap (V2+, out of scope for V1)

Deferred and intentionally excluded from V1, listed only to confirm the V1 data model can grow toward them: budget/economy, bike R&D (`BikeStats` as a second factor in the score), staff/contracts, sponsors, weather + tire strategy (second pre-race decision; weather modulates `technicality`), multiple seasons / career progression, rider avatars, lap-by-lap live race view (progressive execution of the same scoring model). None of these are implemented in V1.

---

## Appendix A — Resolved Divergences (summary)

| Divergence | Candidates | Canonical choice |
|---|---|---|
| Score direction | higher-better vs. lower-better | **Higher = better** |
| Style modifier | additive vs. multiplicative | **Additive −2/0/+2** |
| Stat model | weighted blend vs. role separation | **Role separation** |
| Track model | 0–1 / 1–10 / corners+straight | **Single `technicality` 0–1** |
| Player stats | fixed 6/6/6 vs 7/6/6 vs point-buy | **Point-buy, 18 pts** |
| RNG | `Math.random` vs seeded | **Seeded wrapper** |
| AI style choice | flat 25/50/25 vs biased | **Consistency-biased** |
| Standings tiebreak | countback vs wins/podiums chain | **Countback ladder** |
| State passing | params / registry / global / EventBus | **Scene params** |
| Spec language | Spanish | **English** (this doc) |
