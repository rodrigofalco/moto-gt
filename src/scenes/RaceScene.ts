import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { buildPath, pointAt, type SampledPath } from '../core/Path';
import { TRACK_LAYOUTS } from '../data/trackLayouts';
import { RACE_LAPS, RACE_ANIM_SECONDS, RACE_SPEEDS, BRAND_COLORS, MIN_SEP, MAX_STEP, MAX_SPREAD, LAP_TIME_BASE, LAP_TIME_SPREAD } from '../core/constants';
import { stepLap, finalizeRace, type RaceRun } from '../core/RaceEngine';
import { trainLayout, lapTime, formatLapTime, type TrainEntry } from '../core/raceView';
import { applyProgression } from '../core/Progression';
import { applyRaceResult } from '../core/Championship';
import type { SeasonState, Risk } from '../core/types';

const OX = 70, OY = 110, W = 560, H = 470;
const ORDER: { risk: Risk; label: string }[] = [
  { risk: 'low', label: 'Settle' }, { risk: 'medium', label: 'Defend' }, { risk: 'high', label: 'Attack' },
];

interface SceneData { season: SeasonState; run: RaceRun; }
interface DotGfx { dot: Phaser.GameObjects.Arc; ring?: Phaser.GameObjects.Arc; num: Phaser.GameObjects.Text; }

export class RaceScene extends Phaser.Scene {
  private sd!: SceneData;
  private path!: SampledPath;
  private gfx: Map<string, DotGfx> = new Map();
  private numbers: Map<string, number> = new Map();
  private progressPerLoop = 7;
  private prev: Map<string, number> = new Map();
  private cur: Map<string, number> = new Map();
  private lapsDone = 0;
  private acc = 0;
  private speed = 1;
  private order: Risk = 'medium';
  private done = false;
  private lapText!: Phaser.GameObjects.Text;
  private orderText!: Phaser.GameObjects.Text;
  private orderBoxes: Phaser.GameObjects.Rectangle[] = [];
  private speedBoxes: Phaser.GameObjects.Rectangle[] = [];
  private placeBehind: Map<string, number> = new Map();   // smoothed train spacing (loop fraction) per rider
  private lastLap: Map<string, number> = new Map();       // last completed lap time (race-fiction seconds)
  private bestLap: Map<string, number> = new Map();
  private raceTime: Map<string, number> = new Map();      // cumulative race-fiction time (drives gaps)
  private fastest: { id: string; time: number } | null = null;
  private chaseRing!: Phaser.GameObjects.Arc;             // marks the rider just ahead of the player
  private calloutText!: Phaser.GameObjects.Text;
  private flashText!: Phaser.GameObjects.Text;            // brief overtake gained/lost flash
  private playerLapText!: Phaser.GameObjects.Text;
  private flText!: Phaser.GameObjects.Text;               // fastest-lap banner
  private youText!: Phaser.GameObjects.Text;              // "YOU" label that follows the player dot
  private prevPlayerPos = -1;

  constructor() { super('RaceScene'); }
  init(data: SceneData): void {
    this.sd = data; this.gfx = new Map(); this.numbers = new Map();
    this.prev = new Map(); this.cur = new Map(); this.placeBehind = new Map();
    this.lastLap = new Map(); this.bestLap = new Map(); this.raceTime = new Map(); this.fastest = null;
    this.lapsDone = 0; this.acc = 0; this.speed = 1; this.order = data.season.lastRisk ?? 'medium'; this.done = false;
    this.orderBoxes = []; this.speedBoxes = []; this.prevPlayerPos = -1;
  }

  create(): void {
    const run = this.sd.run;
    this.add.text(OX, 28, `Race Day — ${run.track.name}`, { fontSize: '24px', color: '#f5c518' });

    this.path = buildPath(TRACK_LAYOUTS[run.track.id].points);
    this.drawTrack();
    this.drawFinishLine();

    this.progressPerLoop = run.states.reduce((a, s) => a + s.basePace, 0) / run.states.length || 7;

    const grid = [this.sd.season.playerRider, ...this.sd.season.aiRiders];
    grid.forEach((r, i) => this.numbers.set(r.id, i + 1));

    for (const s of run.states) {
      const r = s.rider;
      const color = BRAND_COLORS[r.brandId] ?? 0x4fc3f7;
      const ring = r.isPlayer ? this.add.circle(OX, OY, 15).setStrokeStyle(4, 0xf5c518) : undefined;
      const dot = this.add.circle(OX, OY, r.isPlayer ? 9 : 7, color).setStrokeStyle(2, 0x1a1a2e);
      const num = this.add.text(OX, OY, String(this.numbers.get(r.id)), { fontSize: '11px', color: '#0b0b14', fontStyle: 'bold' }).setOrigin(0.5);
      this.gfx.set(r.id, { dot, ring, num });
      this.prev.set(r.id, 0);
      this.cur.set(r.id, 0);
      this.placeBehind.set(r.id, 0);
      this.raceTime.set(r.id, 0);
    }

    // Ring that marks whichever rider is directly ahead of the player (your battle).
    this.chaseRing = this.add.circle(OX, OY, 16).setStrokeStyle(2, 0x00e5ff).setVisible(false);
    // "YOU" label pinned above the player's dot so it's never ambiguous which one is you.
    this.youText = this.add.text(OX, OY, 'YOU', { fontSize: '12px', color: '#f5c518', fontStyle: 'bold' }).setOrigin(0.5);

    this.lapText = this.add.text(700, 110, '', { fontSize: '20px', color: '#f5c518' });
    this.playerLapText = this.add.text(700, 134, '', { fontSize: '14px', color: '#9ad0ff' });
    this.orderText = this.add.text(700, 158, '', { fontFamily: 'monospace', fontSize: '13px', color: '#e0e0e0' });
    this.flText = this.add.text(700, 322, '', { fontFamily: 'monospace', fontSize: '13px', color: '#d500f9' });
    this.calloutText = this.add.text(70, 590, '', { fontSize: '16px', color: '#00e5ff' });
    this.flashText = this.add.text(370, 590, '', { fontSize: '18px', color: '#00c853', fontStyle: 'bold' }).setOrigin(0, 0.5).setAlpha(0);

    // Order radio (live risk).
    this.add.text(70, 612, 'Orders', { fontSize: '16px', color: '#e0e0e0' });
    ORDER.forEach((o, i) => {
      const box = this.add.rectangle(140 + i * 150, 648, 140, 36, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(140 + i * 150, 648, o.label, { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.order = o.risk; this.sd.season.lastRisk = o.risk; this.refreshOrder(); });
      this.orderBoxes.push(box);
    });
    this.refreshOrder();

    // Speed control.
    this.add.text(640, 612, 'Speed', { fontSize: '16px', color: '#e0e0e0' });
    RACE_SPEEDS.forEach((sp, i) => {
      const box = this.add.rectangle(700 + i * 70, 648, 60, 36, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(700 + i * 70, 648, `${sp}x`, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.speed = sp; this.refreshSpeed(); });
      this.speedBoxes.push(box);
    });
    this.refreshSpeed();

    this.drawLegend();
    new Button(this, { x: 900, y: 712, width: 150, height: 44, label: 'SKIP', onClick: () => this.skip() });
    // Prime lap 1 so dots roll from the gun (prev=grid, cur=lap1) — no frozen opening lap.
    this.advanceOneLap();
    this.renderFrame(0);
  }

  private drawLegend(): void {
    this.add.text(700, 348, 'Orders:  Attack = push (risky) · Defend = hold · Settle = safe', { fontSize: '12px', color: '#94a3b8', wordWrap: { width: 312 } });
    this.add.text(700, 388, 'Bikes:', { fontSize: '12px', color: '#94a3b8' });
    const legend: [string, number][] = [['Velocita', 0xe94560], ['Apex', 0x4fc3f7], ['Titan', 0xcfd8dc], ['Vortex', 0xff9800]];
    legend.forEach(([name, color], i) => {
      const lx = 758 + (i % 2) * 130, ly = 390 + Math.floor(i / 2) * 22;
      this.add.circle(lx, ly, 5, color);
      this.add.text(lx + 12, ly, name, { fontSize: '12px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    });
    this.add.text(700, 440, "Gold ring = you  ·  cyan ring = the rider you're chasing", { fontSize: '12px', color: '#94a3b8', wordWrap: { width: 312 } });
  }

  private refreshOrder(): void {
    ORDER.forEach((o, i) => this.orderBoxes[i].setFillStyle(o.risk === this.order ? 0x0f3460 : 0x16213e).setStrokeStyle(2, o.risk === this.order ? 0xf5c518 : 0x0f3460));
  }
  private refreshSpeed(): void {
    RACE_SPEEDS.forEach((sp, i) => this.speedBoxes[i].setFillStyle(sp === this.speed ? 0x0f3460 : 0x16213e).setStrokeStyle(2, sp === this.speed ? 0xf5c518 : 0x0f3460));
  }

  private drawTrack(): void {
    const g = this.add.graphics();
    const pts = this.path.samples.map((p) => new Phaser.Math.Vector2(OX + p.x * W, OY + p.y * H));
    g.lineStyle(10, 0x16213e); g.strokePoints(pts, true, true);
    g.lineStyle(2, 0x0f3460); g.strokePoints(pts, true, true);
  }

  // Checkered start/finish bar across the track at t=0, perpendicular to the racing line.
  private drawFinishLine(): void {
    const p0 = pointAt(this.path, 0);
    const p1 = pointAt(this.path, 0.012);
    const ax = OX + p0.x * W, ay = OY + p0.y * H;
    const dx = (OX + p1.x * W) - ax, dy = (OY + p1.y * H) - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // unit perpendicular
    const half = 18, cells = 6;
    const g = this.add.graphics();
    for (let i = 0; i < cells; i++) {
      const t0 = -half + (2 * half) * (i / cells);
      const t1 = -half + (2 * half) * ((i + 1) / cells);
      g.lineStyle(7, i % 2 === 0 ? 0xffffff : 0x0b0b14);
      g.lineBetween(ax + nx * t0, ay + ny * t0, ax + nx * t1, ay + ny * t1);
    }
  }

  private snapshot(target: Map<string, number>): void {
    for (const s of this.sd.run.states) target.set(s.rider.id, s.progress);
  }

  private advanceOneLap(): void {
    this.snapshot(this.prev);
    stepLap(this.sd.run, this.order);
    this.snapshot(this.cur);
    this.lapsDone += 1;
    // Record each rider's lap time from the progress gained this lap (skip crash laps).
    for (const s of this.sd.run.states) {
      if (s.crashed) continue;
      const delta = (this.cur.get(s.rider.id) ?? 0) - (this.prev.get(s.rider.id) ?? 0);
      if (delta <= 0.01) continue;
      const lt = lapTime(delta, this.progressPerLoop, LAP_TIME_BASE, LAP_TIME_SPREAD);
      this.lastLap.set(s.rider.id, lt);
      this.raceTime.set(s.rider.id, (this.raceTime.get(s.rider.id) ?? 0) + lt);
      const best = this.bestLap.get(s.rider.id);
      if (best === undefined || lt < best) this.bestLap.set(s.rider.id, lt);
      if (!this.fastest || lt < this.fastest.time) this.fastest = { id: s.rider.id, time: lt };
    }
  }

  private renderFrame(frac: number): void {
    const EMA = 0.2; // smooths the train so overtakes slide past instead of snapping
    const states = this.sd.run.states;

    // Interpolated progress for this frame.
    const trueP = new Map<string, number>();
    for (const s of states) {
      const id = s.rider.id;
      trueP.set(id, (this.prev.get(id) ?? 0) + ((this.cur.get(id) ?? 0) - (this.prev.get(id) ?? 0)) * frac);
    }

    // The pack circulates at a constant rate (one loop per lap) driven by the animation
    // clock, NOT the leader's noisy lap pace — so motion is smooth. Real pace differences
    // show up only in the relative spacing (placeBehind), not the circulation speed.
    const anchor = (((this.lapsDone - 1 + frac) % 1) + 1) % 1;
    const gapScale = MAX_SPREAD / this.progressPerLoop;
    const entries: TrainEntry[] = states.map((s) => ({
      id: s.rider.id, progress: trueP.get(s.rider.id)!, crashed: s.crashed, grid: this.numbers.get(s.rider.id) ?? 1,
    }));
    const slots = new Map(trainLayout(entries, { minSep: MIN_SEP, gapScale, maxStep: MAX_STEP, maxSpread: MAX_SPREAD }).map((sl) => [sl.id, sl]));

    const screen = new Map<string, { x: number; y: number }>();
    for (const s of states) {
      const id = s.rider.id;
      const g = this.gfx.get(id)!;
      if (s.crashed) {
        g.dot.setFillStyle(0xff1744);                 // frozen where they crashed
        screen.set(id, { x: g.dot.x, y: g.dot.y });
        continue;
      }
      const target = slots.get(id)!.placeBehind;
      const last = this.placeBehind.get(id) ?? target;
      const pb = last + (target - last) * EMA;
      this.placeBehind.set(id, pb);
      const t = (((anchor - pb) % 1) + 1) % 1;
      const pt = pointAt(this.path, t);
      const sx = OX + pt.x * W, sy = OY + pt.y * H;
      g.dot.setPosition(sx, sy); g.num.setPosition(sx, sy);
      if (g.ring) g.ring.setPosition(sx, sy);
      screen.set(id, { x: sx, y: sy });
    }

    // Leaderboard — real progress (the same key the result uses), gaps on the race-fiction clock.
    const order = states.slice().sort((a, b) => {
      if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;
      return b.progress - a.progress;
    });
    const playerIdx = order.findIndex((s) => s.rider.isPlayer);

    const pLast = this.lastLap.get(this.sd.season.playerRider.id);
    this.lapText.setText(`Lap ${Math.min(RACE_LAPS, this.lapsDone)} / ${RACE_LAPS}`);
    this.playerLapText.setText(`Last lap: ${pLast ? formatLapTime(pLast) : '—'}`);

    // Gaps come from accumulated lap times (same clock as the lap times themselves), so a
    // gap of "+2.4" is consistent with the lap times shown; a full lap behind reads "+1 LAP".
    const leaderTime = this.raceTime.get(order[0]?.rider.id ?? '') ?? 0;
    const leaderProg = order[0]?.progress ?? 0;
    this.orderText.setText(order.map((s, i) => {
      const r = s.rider;
      const near = Math.abs(i - playerIdx) === 1;
      const tag = r.isPlayer ? '>' : near ? '·' : ' ';
      const lapsDown = Math.floor((leaderProg - s.progress) / this.progressPerLoop + 1e-9);
      const gapStr = s.crashed ? 'OUT'
        : i === 0 ? 'LEAD'
        : lapsDown >= 1 ? `+${lapsDown} LAP`
        : `+${((this.raceTime.get(r.id) ?? 0) - leaderTime).toFixed(1)}`;
      const lt = this.lastLap.get(r.id);
      const ltStr = s.crashed || !lt ? '—' : formatLapTime(lt);
      return `${tag}${String(i + 1).padStart(2)} #${String(this.numbers.get(r.id)).padStart(2)} ${r.name.slice(0, 9).padEnd(9)} ${gapStr.padStart(6)} ${ltStr.padStart(8)}`;
    }).join('\n'));

    // Fastest-lap banner.
    if (this.fastest) {
      const fr = states.find((s) => s.rider.id === this.fastest!.id)!.rider;
      this.flText.setText(`⚡ FL  #${this.numbers.get(fr.id)} ${fr.name.slice(0, 12)}  ${formatLapTime(this.fastest.time)}`);
    }

    // Mark and name whoever the player is battling (the rider directly ahead).
    const me = order[playerIdx];
    if (me?.crashed) {
      this.chaseRing.setVisible(false);
      this.calloutText.setText('You crashed out.');
    } else if (playerIdx > 0) {
      const ahead = order[playerIdx - 1];
      const pos = screen.get(ahead.rider.id)!;
      this.chaseRing.setPosition(pos.x, pos.y).setVisible(true);
      const gapS = (this.raceTime.get(me.rider.id) ?? 0) - (this.raceTime.get(ahead.rider.id) ?? 0);
      this.calloutText.setText(`P${playerIdx + 1} — chasing #${this.numbers.get(ahead.rider.id)} ${ahead.rider.name} (+${gapS.toFixed(1)}s)`);
    } else {
      this.chaseRing.setVisible(false);
      this.calloutText.setText('You are leading the race!');
    }

    // Keep the "YOU" label pinned just above the player's dot.
    const myPos = screen.get(this.sd.season.playerRider.id);
    if (myPos) this.youText.setPosition(myPos.x, myPos.y - 18);

    // Overtake flash when the player's position changes (only at lap boundaries).
    const curPos = playerIdx + 1;
    if (this.prevPlayerPos !== -1 && curPos !== this.prevPlayerPos && !me?.crashed) {
      const gained = curPos < this.prevPlayerPos;
      this.flashText.setText(`${gained ? '▲' : '▼'} P${this.prevPlayerPos} → P${curPos}`)
        .setColor(gained ? '#00c853' : '#ff5f7a').setAlpha(1);
      this.tweens.killTweensOf(this.flashText);
      this.tweens.add({ targets: this.flashText, alpha: 0, duration: 1400, ease: 'Quad.easeIn' });
    }
    this.prevPlayerPos = curPos;
  }

  update(_t: number, delta: number): void {
    if (this.done) return;
    const lapMs = (RACE_ANIM_SECONDS * 1000) / RACE_LAPS;
    this.acc += delta * this.speed;
    while (this.acc >= lapMs && this.lapsDone < RACE_LAPS) { this.advanceOneLap(); this.acc -= lapMs; }
    if (this.lapsDone >= RACE_LAPS && this.acc >= lapMs) { this.renderFrame(1); this.done = true; this.time.delayedCall(900, () => this.finish()); return; }
    this.renderFrame(Math.min(1, this.acc / lapMs));
  }

  private skip(): void {
    if (this.done) return;
    while (this.lapsDone < RACE_LAPS) this.advanceOneLap();
    this.done = true;
    this.finish();
  }

  private finish(): void {
    const run = this.sd.run;
    const result = finalizeRace(run, run.rng);
    const summaries = applyProgression([this.sd.season.playerRider, ...this.sd.season.aiRiders], result);
    applyRaceResult(this.sd.season, result);
    const playerSummary = summaries.find((su) => su.riderId === 'player')!;
    this.scene.start('RaceResultScene', { season: this.sd.season, result, playerSummary });
  }
}
