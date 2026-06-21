# MotoGT

A minimalist **motorcycle racing manager** game, inspired by [Motorsport Manager](https://store.steampowered.com/app/415200/Motorsport_Manager/).

You run a single rider through one championship season and try to win the title. No physics, no twitch reflexes — just one decision per race and the results that follow.

> **V1 philosophy: finish first, expand later.** This version is deliberately tiny. Everything that made past attempts stall — budgets, R&D, staff, contracts, sponsors — is cut. The goal is a complete, playable season loop you can ship, then grow.

---

## The game in one minute

You manage **one rider** on a grid of 10. A season is **6 races**. Before each race you pick a **riding style**, **bike setup**, and **tire compound**, then watch the race unfold lap-by-lap. The championship table updates after every round. Win the most points across the season and you're champion.

A full season plays in about five minutes.

---

## Core loop

1. **Season start** — name your rider and team. A fixed 6-race calendar is generated, along with 9 AI rivals with randomized stats.
2. **Race weekend** — see the next track and your rider, then pick a **bike setup** (Top Speed / Handling / Acceleration) and **riding style**:
   - **Safe** — lower pace, very low chance of a mistake.
   - **Balanced** — neutral pace and risk.
   - **Aggressive** — higher pace, higher chance of a costly mistake.
3. **Simulate** — finishing order is computed from rider stats + riding style + randomness.
4. **Results & standings** — see the finishing table, collect points, watch the championship standings shift.
5. **Repeat** for all 6 races → the season ends and the champion is crowned → play again.

---

## Rider stats

Just three, scored 1–10:

| Stat | Effect |
|------|--------|
| **Pace** | Raw speed — the biggest factor in finishing position. |
| **Cornering** | Performance through technical sections. |
| **Consistency** | Resistance to mistakes; reduces the downside of aggressive riding. |

Setup should match the track's strengths, and riding style trades **expected pace against mistake risk**. A consistent rider can push Aggressive more safely than an erratic one.

---

## Scoring

Standard top-10 points per race:

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-----|---|---|---|---|---|---|---|---|---|----|
| Pts | 25 | 18 | 15 | 12 | 10 | 8 | 6 | 4 | 2 | 1 |

Most points after 6 races wins the championship.

---

## Scope

### In V1
- One player-controlled rider + 9 AI riders.
- 6-race fixed calendar with multi-season career support.
- Pre-race decisions: bike setup, tire compound, and riding style.
- Interactive lap-by-lap race view with live commentary.
- Simulated results from stats + setup + style + tires + weather + randomness.
- Live championship standings.
- Save/load career, prize money, and bike R&D upgrades.

### Out of V1 (deferred to V2+)
Sponsors · staff, engineers & contracts · multi-rider hiring · rider avatars.

These are intentionally out. They are what over-scoped the previous attempts.

---

## Tech stack

- **Language:** TypeScript
- **Engine:** [Phaser 4](https://phaser.io/)
- **Build tool:** Vite
- **Runtime:** Browser

### Scenes

The game uses seven scenes:

```
Boot → MainMenu → Season (calendar + standings + setup) → Race → RaceResult → OffSeason
       ↑______________________________________________________________|
```

Plus a **SaveLoad** scene for managing careers.

---

## Getting started

> _Setup commands below are the intended workflow once the project is scaffolded._

```bash
# install dependencies
npm install

# run the dev server
npm run dev

# build for production
npm run build
```

Then open the local URL printed by Vite (usually `http://localhost:5173`).

---

## Roadmap

- **V1** — the bare season loop described above. _(current target)_
- **V2** — prize money + simple bike upgrades between races.
- **V3** — multiple riders, hiring & contracts, sponsors.
- **V4** — R&D, multiple seasons / career tiers, weather & tires.

---

## Background

This is a fresh, deliberately scoped-down restart. Earlier attempts ([`MotoGT`](https://github.com/rodrigofalco/MotoGT) in Phaser, [`MotoGTGodot`](https://github.com/rodrigofalco/MotoGTGodot) in Godot) built extensive design docs and menu shells but never landed a complete playable loop. V1 exists to fix that: ship a finished season, then build outward.
