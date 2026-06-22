# MotoGT — Development Status (2026-06-21)

## Current State
- **Branch:** `main` — clean, all changes committed
- **Game:** 1024×1100 viewport, scalable via Phaser FIT
- **Tests:** 27 files, 136 passing ✅
- **Build:** ✅ `npm run build` → 1.4MB bundle
- **Dev:** `npm run dev` → http://localhost:5173/

## Latest Session Notes (2026-06-21)
- V2 overnight polish pass committed (`feat(v2)`): unique AI names, finish line, overtake flash, race legend, result arrows, season podium, hub track hints.
- Visual-fixes plan executed & **archived** to `docs/done/plans/motogt-visual-fixes.md` — all 5 deferred features wired (see below), F1–F4 review agents APPROVED, build+136 tests green.
- Project infrastructure committed (`chore(project)`): `AGENTS.md`, `.pi/` config, `docs/`, screenshot helpers, verification tools, updated `.gitignore`.
- **Balance state (N=150 sweep, `tests/sweep.test.ts` → `/tmp/sweep-report.txt`):**
  - **P1 (accel blended with pilot pace) IS applied** — commit `15c4e85`. The overnight log's "Vortex 42%" finding was measured *before* this commit; it is stale.
  - **Brand balance is now excellent:** Velocita 38.1% · Apex 37.9% · Vortex 36.7% · Titan 36.6% — only **1.5pt spread**. ✅
  - **Crash tuning applied:** `BASE_CRASH` bumped ~1.4× (0.028/0.084/0.224 → 0.039/0.118/0.314) to restore ~9–10% player crash rate.
  - **Pilot spread remains very wide:** Drift Prince 63.7% → Ice Rider 8.3% = **55pt spread**. Previous session accepted this as "roster flavor"; root cause is that **`pace` is double-dipped** (feeds both `speed` and `acceleration` axes via `baseAxes`), while `cornering` feeds only one axis. Open for decision — see Known/Deferred below.

## Implemented Features

### Core Game Loop
- **6-race season** with 10 riders (player + 9 AI)
- **3 riding styles:** Safe / Balanced / Aggressive
- **Scoring:** Standard 25-1-10 points per race
- **Scenes:** MainMenu → Season (hub) → Race-day → Results → Off-season → repeat

### Pilot/Bike Selection (main menu)
- **18 pilots** with unique names, nicknames, and stat profiles
- **4 bike brands** (Velocita, Apex, Titan, Vortex) with 3 stats each
- Team name customization (keyboard input)
- Pilot grid (4×5 layout) + bike selection (4×1 row)
- START SEASON button (enabled when pilot + brand + team selected)

### Economy & Progression
- **Prize money** earned per race finish position
- **R&D points** for bike upgrades (pilot XP auto-levels)
- **Career system** with save/load (CareerStore + CareerScene)
- **Convex cost curves** for progression scaling

### Race-Day (Phase B)
- **8-lap interactive view** with Attack/Defend/Settle decisions
- **Lap-by-lap dot progress** (ring-based, brand-colored dots)
- **Drafting, braking, AR(1) momentum** for stable pack racing
- **Speed control:** 1× / 2× / 4×
- **Qualifying system** with seeded RNG starting grid
- **Weather system:** per-race sunny/rainy with wet crash multiplier 1.4×
- **Weather emoji badge** on hub and race-day header

### Off-Season
- **Rider aging** with stat decline after PEAK_AGE
- **Retire weakest AI** → add rookies each season
- **AI growth** based on championship results
- **Tire compounds** (soft/medium/hard) with wear + traction degradation

### New (from merge)
- **Multi-season career** with continue/new options
- **Commentary system** for race events (dynamic text during races)
- **Sound engine** (Web Audio API: engine hum, crash, podium, checkered, click, overtake)
- **Expanded roster** (18 pilots, unique AI names)

## Architecture

```
src/
├── config.ts                    # Game config (Phaser 1024×1100, scale FIT)
├── main.ts                     # Entry point (Phaser + SoundEngine)
├── core/
│   ├── Advice.ts               # Track recommendation + result headline
│   ├── AIDecision.ts          # AI risk/setup selection
│   ├── CareerStore.ts         # Save/load with persist (localStorage)
│   ├── Championship.ts         # Points table, standings, getChampion()
│   ├── Commentary.ts          # Race commentary system (events + phrases)
│   ├── constants.ts           # Tuning constants (130+ settings)
│   ├── CostCurve.ts           # Progression cost scaling
│   ├── CrashModel.ts          # Crash probability model
│   ├── Economy.ts             # Prize money, wallet, prize table
│   ├── OffSeason.ts           # Aging, retire, rookies
│   ├── Path.ts                # (purpose unknown)
│   ├── PerformanceModel.ts    # Pace, cornering, consistency scoring
│   ├── Progression.ts         # Pilot XP, R&D points, level-up
│   ├── Qualifying.ts          # Grid determination via seeded RNG
│   ├── RaceEngine.ts          # Lap-by-lap simulation (8 laps)
│   ├── RaceSimulator.ts       # One-race simulation (finishing order)
│   ├── raceView.ts            # Visual helpers for race day
│   ├── RNG.ts                 # Seeded random number generator
│   ├── SaveSystem.ts          # Save/load with CareerState
│   ├── SoundEngine.ts         # Web Audio (engine, crash, podium, etc.)
│   ├── TireModel.ts           # Compound degradation + crash risk
│   └── types.ts              # Shared TypeScript types
├── data/
│   ├── brands.ts (4: Velocita, Apex, Titan, Vortex)
│   ├── names.ts (15 AI extra names)
│   ├── pilots.ts (18: Marco Rossi → Johan Bekker)
│   ├── tiers.ts (career promotion tiers)
│   ├── trackLayouts.ts        # Track shapes for race view
│   └── tracks.ts (6: Barcelona → Suzuka)
├── scenes/
│   ├── BootScene.ts           # Load + show splash
│   ├── MainMenuScene.ts       # Select pilot + bike, start season
│   ├── OffSeasonScene.ts      # Off-season transitions + report
│   ├── RaceResultScene.ts     # Results table + standings
│   ├── RaceScene.ts           # Interactive 8-lap view
│   ├── SaveLoadScene.ts       # Save/load menu (NEW)
│   └── SeasonScene.ts         # Hub: setup/risk + calendar standigs
└── ui/
    ├── Button.ts              # Reusable button component
    ├── Card.ts                # Pilot/bike card component
    ├── StandingsTable.ts      # Championship standings table
    └── theme.ts               # Shared styling (colors, fonts)
```

## Known / Deferred Items

### ✅ Done (previously listed as deferred — all wired & committed)
- [x] **Commentary system** wired into RaceScene — `generateCommentary` + `commentaryText` + `updateCommentary` (`RaceScene.ts:14,131,253,318`)
- [x] **Tire model** integrated — compound selection in hub, wear tracking via `calcTireWear`/`getTireGrip` (`RaceScene.ts:15,82,310`)
- [x] **Sound engine** race-day events — `playCrash`, `playOvertake`, `playEngine` + mute toggle (`RaceScene.ts:250,469,482`)
- [x] **Save/Load scene** menu buttons — `MainMenuScene.ts:38` → `SaveLoadScene`
- [x] **Anti-overlap dot nudge** — `applyDotNudge` + EMA smoothing (`RaceScene.ts:332`)

### 🔓 Open
- [ ] **Pilot roster balance** — 55pt spread (Drift Prince 63.7% → Ice Rider 8.3%). Root cause: `pace` feeds two axes (`speed` + `acceleration`) in `baseAxes`, `cornering` feeds one. **Decision needed:** narrow the spread (e.g. cap pace's double-count, or raise cornering weight) or keep as difficulty flavor. Previous session accepted it; not yet re-decided.
- [x] **AI variety** — 9 AI slots now draw a seeded-shuffled 9-of-17 archetypes each season (`RiderFactory.generateAIRiders`), so opponents vary across seasons. Deterministic per seed. Tests: determinism + variety (≥15/20 seeds yield distinct rosters).
- [ ] **V1 → V2 boundary** — career/save/prize/R&D are already in despite AGENTS.md saying defer to later versions. Decide whether V1 is feature-complete.

## How to Run
```bash
# Install dependencies
npm install

# Run dev server
npm run dev   # → http://localhost:5173/

# Run tests
npm test      # 136 passing

# Build for production
npm run build # → dist/ (1.4MB)
```
