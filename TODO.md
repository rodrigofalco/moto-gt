# MotoGT — Development Status (2026-06-19)

## Current State
- **Branch:** `main` — clean, all features merged
- **Game:** 1024×1100 viewport, scalable via Phaser FIT
- **Tests:** 27 files, 136 passing ✅
- **Build:** ✅ `npm run build` → 1.4MB bundle
- **Dev:** `npm run dev` → http://localhost:5173/

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

- [ ] **Commentary system** needs to be wired into RaceScene (currently exists but not used)
- [ ] **Tire model** needs integration (compound selection in hub, wear tracking in race)
- [ ] **Sound engine** needs race-day events (overtake sounds, crash sounds)
- [ ] **Save/Load scene** needs menu buttons to navigate to it
- [ ] **AI variety** — 9 AI draw from 18 archetypes but could be more varied
- [ ] **Anti-overlap dot nudge** — race day dots can stack

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
