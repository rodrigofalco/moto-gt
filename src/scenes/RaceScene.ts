import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { buildPath, pointAt, type SampledPath } from '../core/Path';
import { TRACK_LAYOUTS } from '../data/trackLayouts';
import { RACE_LAPS, RACE_ANIM_SECONDS, RACE_SPEEDS, BRAND_COLORS } from '../core/constants';
import { stepLap, finalizeRace, type RaceRun } from '../core/RaceEngine';
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
  private displayProg: Map<string, number> = new Map();   // smoothed progress for on-track motion
  private chaseRing!: Phaser.GameObjects.Arc;             // marks the rider just ahead of the player
  private calloutText!: Phaser.GameObjects.Text;
  private flashText!: Phaser.GameObjects.Text;            // brief overtake gained/lost flash
  private prevPlayerPos = -1;

  constructor() { super('RaceScene'); }
  init(data: SceneData): void {
    this.sd = data; this.gfx = new Map(); this.numbers = new Map();
    this.prev = new Map(); this.cur = new Map(); this.displayProg = new Map();
    this.lapsDone = 0; this.acc = 0; this.speed = 1; this.order = 'medium'; this.done = false;
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
      const ring = r.isPlayer ? this.add.circle(OX, OY, 12).setStrokeStyle(3, 0xf5c518) : undefined;
      const dot = this.add.circle(OX, OY, r.isPlayer ? 9 : 7, color).setStrokeStyle(2, 0x1a1a2e);
      const num = this.add.text(OX, OY, String(this.numbers.get(r.id)), { fontSize: '11px', color: '#0b0b14', fontStyle: 'bold' }).setOrigin(0.5);
      this.gfx.set(r.id, { dot, ring, num });
      this.prev.set(r.id, 0);
      this.cur.set(r.id, 0);
      this.displayProg.set(r.id, 0);
    }

    // Ring that marks whichever rider is directly ahead of the player (your battle).
    this.chaseRing = this.add.circle(OX, OY, 13).setStrokeStyle(2, 0x00e5ff).setVisible(false);

    this.lapText = this.add.text(700, 110, '', { fontSize: '20px', color: '#f5c518' });
    this.orderText = this.add.text(700, 146, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e0e0e0' });
    this.calloutText = this.add.text(70, 590, '', { fontSize: '16px', color: '#00e5ff' });
    this.flashText = this.add.text(370, 590, '', { fontSize: '18px', color: '#00c853', fontStyle: 'bold' }).setOrigin(0, 0.5).setAlpha(0);

    // Order radio (live risk).
    this.add.text(70, 612, 'Orders', { fontSize: '16px', color: '#e0e0e0' });
    ORDER.forEach((o, i) => {
      const box = this.add.rectangle(140 + i * 150, 648, 140, 36, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(140 + i * 150, 648, o.label, { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.order = o.risk; this.refreshOrder(); });
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
  }

  private renderFrame(frac: number): void {
    const EMA = 0.14; // smooths per-lap pace changes so dots glide instead of lurching
    const screen = new Map<string, { x: number; y: number }>();
    for (const s of this.sd.run.states) {
      const id = s.rider.id;
      const trueP = (this.prev.get(id) ?? 0) + ((this.cur.get(id) ?? 0) - (this.prev.get(id) ?? 0)) * frac;
      const last = this.displayProg.get(id) ?? trueP;
      const disp = last + (trueP - last) * EMA;
      this.displayProg.set(id, disp);
      // Start as a clear staggered grid (large offset by start number) that fades to a
      // small anti-overlap offset by ~lap 2, so early laps read as a grid and later laps
      // show true gaps.
      const gridFade = Math.max(0, 1 - (this.lapsDone + frac) / 2);
      const offset = ((this.numbers.get(id) ?? 1) - 1) * (0.006 + 0.020 * gridFade);
      const loops = disp / this.progressPerLoop - offset;
      const pt = pointAt(this.path, ((loops % 1) + 1) % 1);
      const g = this.gfx.get(id)!;
      const sx = OX + pt.x * W, sy = OY + pt.y * H;
      g.dot.setPosition(sx, sy); g.num.setPosition(sx, sy);
      if (g.ring) g.ring.setPosition(sx, sy);
      if (s.crashed) g.dot.setFillStyle(0xff1744);
      screen.set(id, { x: sx, y: sy });
    }

    const order = this.sd.run.states.slice().sort((a, b) => {
      if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;
      return b.progress - a.progress;
    });
    const secPerLap = RACE_ANIM_SECONDS / RACE_LAPS;
    const playerIdx = order.findIndex((s) => s.rider.isPlayer);

    this.lapText.setText(`Lap ${Math.min(RACE_LAPS, this.lapsDone + 1)} / ${RACE_LAPS}`);
    this.orderText.setText(order.map((s, i) => {
      const r = s.rider;
      const near = Math.abs(i - playerIdx) === 1;
      const tag = r.isPlayer ? '>' : near ? '·' : ' ';
      const gap = i > 0 ? ((order[i - 1].progress - s.progress) / this.progressPerLoop) * secPerLap : 0;
      const gapStr = s.crashed ? 'OUT' : i === 0 ? 'LEADER' : `+${gap.toFixed(1)}s`;
      return `${tag}${String(i + 1).padStart(2)} #${String(this.numbers.get(r.id)).padStart(2)} ${r.name.slice(0, 12).padEnd(12)} ${gapStr}`;
    }).join('\n'));

    // Mark and name whoever the player is battling (the rider directly ahead).
    const me = order[playerIdx];
    if (me?.crashed) {
      this.chaseRing.setVisible(false);
      this.calloutText.setText('You crashed out.');
    } else if (playerIdx > 0) {
      const ahead = order[playerIdx - 1];
      const pos = screen.get(ahead.rider.id)!;
      this.chaseRing.setPosition(pos.x, pos.y).setVisible(true);
      const gap = ((ahead.progress - me.progress) / this.progressPerLoop) * secPerLap;
      this.calloutText.setText(`P${playerIdx + 1} — chasing #${this.numbers.get(ahead.rider.id)} ${ahead.rider.name} (+${gap.toFixed(1)}s)`);
    } else {
      this.chaseRing.setVisible(false);
      this.calloutText.setText('You are leading the race!');
    }

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
    if (this.lapsDone >= RACE_LAPS) { this.renderFrame(1); this.done = true; this.time.delayedCall(900, () => this.finish()); return; }
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
