import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { buildPath, pointAt, type SampledPath } from '../core/Path';
import { TRACK_LAYOUTS } from '../data/trackLayouts';
import { RACE_LAPS, RACE_ANIM_SECONDS, RACE_SPEEDS, BRAND_COLORS, MIN_SEP, MAX_STEP, MAX_SPREAD, LAP_TIME_BASE, LAP_TIME_SPREAD } from '../core/constants';
import { stepLap, finalizeRace, hasDraftTow, type RaceRun } from '../core/RaceEngine';
import { trainLayout, lapTime, formatLapTime, type TrainEntry } from '../core/raceView';
import { applyProgression } from '../core/Progression';
import { applyRaceResult } from '../core/Championship';
import { THEME, hex } from '../ui/theme';
import { SoundEngine } from '../core/SoundEngine';
import { saveCareer } from '../core/CareerStore';
import { prizeFor } from '../core/Economy';
import { generateCommentary } from '../core/Commentary';
import { getCompoundColor, getCompoundLabel } from '../core/TireModel';
import { ellipsize } from '../ui/text';

import type { SeasonState, Risk, CareerState, RaceSnapshot, CommentaryEvent, CommentaryType } from '../core/types';

const OX = 70, OY = 110, W = 560, H = 470;
const ORDER: { risk: Risk; label: string }[] = [
   { risk: 'low', label: 'Settle' }, { risk: 'medium', label: 'Defend' }, { risk: 'high', label: 'Attack' },
];

interface SceneData { season: SeasonState; run: RaceRun; career?: CareerState; grid?: string[]; }
interface DotGfx { dot: Phaser.GameObjects.Arc; ring?: Phaser.GameObjects.Arc; num: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Arc; }
interface RainDrop { x: number; y: number; len: number; sp: number; }

const COMMENTARY_COLOR: Partial<Record<CommentaryType, string>> = {
  crash: '#ff5f7a', overtake: '#00c853', battle: '#ffb74d', tire: '#ffd54f',
  fastest_lap: '#d500f9', lead_change: '#9ad0ff',
};

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
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private posArrows: Map<string, string> = new Map();
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
  private soundEngine!: SoundEngine;
  private muteBtn!: Phaser.GameObjects.Text;
  private career: CareerState | null = null;
  private feedTexts: Phaser.GameObjects.Text[] = [];
  private feed: CommentaryEvent[] = [];
  private commentaryQueue: CommentaryEvent[] = [];
  private commentaryTimer = 0;
  private tireText!: Phaser.GameObjects.Text;
  private tireWearText!: Phaser.GameObjects.Text;
  private prevSnapshot!: RaceSnapshot;
  private rainDrops: RainDrop[] = [];
  private rainG: Phaser.GameObjects.Graphics | null = null;

  constructor() { super('RaceScene'); }
  init(data: SceneData): void {
    this.sd = data; this.gfx = new Map(); this.numbers = new Map();
    this.prev = new Map(); this.cur = new Map(); this.placeBehind = new Map();
    this.lastLap = new Map(); this.bestLap = new Map(); this.raceTime = new Map(); this.fastest = null;
    this.lapsDone = 0; this.acc = 0; this.speed = 1; this.order = data.season.lastRisk ?? 'medium'; this.done = false;
    this.orderBoxes = []; this.speedBoxes = []; this.prevPlayerPos = -1;
    this.career = data.career ?? null;
    this.commentaryQueue = [];
    this.commentaryTimer = 0;
    this.feed = []; this.feedTexts = []; this.rowTexts = [];
    this.posArrows = new Map();
    this.rainDrops = []; this.rainG = null;
   }

  create(): void {
    this.drawBackground();
    const run = this.sd.run;
    const weather = run.weather;
    const weatherEmoji = weather === 'wet' ? '🌧️' : '☀️';
    this.add.text(OX, 28, `Race Day — ${run.track.name} ${weatherEmoji}`, { fontSize: '24px', color: '#f5c518' });

    this.path = buildPath(TRACK_LAYOUTS[run.track.id].points);
    this.drawTrack();
    this.drawFinishLine();

    this.progressPerLoop = run.states.reduce((a, s) => a + s.basePace, 0) / run.states.length || 7;

     // Wire grid order: number = starting position, dot order = grid
    const grid = this.sd.grid ?? [this.sd.season.playerRider, ...this.sd.season.aiRiders].map((r) => r.id);
    grid.forEach((riderId, i) => this.numbers.set(riderId, i + 1));

    for (const s of run.states) {
      const r = s.rider;
      const color = BRAND_COLORS[r.brandId] ?? 0x4fc3f7;
      // Slipstream glow: soft halo shown while this rider is getting a draft tow.
      const glow = this.add.circle(OX, OY, 14, 0x00e5ff, 0.18).setVisible(false);
      const ring = r.isPlayer ? this.add.circle(OX, OY, 15).setStrokeStyle(4, 0xf5c518) : undefined;
      const dot = this.add.circle(OX, OY, r.isPlayer ? 9 : 7, color).setStrokeStyle(2, 0x1a1a2e);
      const num = this.add.text(OX, OY, String(this.numbers.get(r.id)), { fontSize: '11px', color: '#0b0b14', fontStyle: 'bold' }).setOrigin(0.5);
      this.gfx.set(r.id, { dot, ring, num, glow });
      this.prev.set(r.id, 0);
      this.cur.set(r.id, 0);
      this.placeBehind.set(r.id, 0);
      this.raceTime.set(r.id, 0);
    }

    // Ring that marks whichever rider is directly ahead of the player (your battle).
    this.chaseRing = this.add.circle(OX, OY, 16).setStrokeStyle(2, 0x00e5ff).setVisible(false);
    // "YOU" label pinned above the player's dot so it's never ambiguous which one is you.
    this.youText = this.add.text(OX, OY, 'YOU', { fontSize: '12px', color: '#f5c518', fontStyle: 'bold' }).setOrigin(0.5);

    this.drawPanel(688, 64, 316, 486);
    this.add.text(704, 80, 'LIVE TIMING', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    this.tireText = this.add.text(704, 104, '', { fontFamily: THEME.fontFamily, fontSize: '13px', color: '#e0e0e0' });
    this.tireWearText = this.add.text(830, 104, '', { fontFamily: THEME.fontFamily, fontSize: '13px', color: '#00c853', fontStyle: 'bold' });
    this.lapText = this.add.text(704, 124, '', { fontSize: '20px', color: '#f5c518' });
    this.playerLapText = this.add.text(704, 148, '', { fontSize: '14px', color: '#9ad0ff' });
    for (let i = 0; i < this.sd.run.states.length; i++) {
      this.rowTexts.push(this.add.text(704, 172 + i * 16, '', { fontFamily: 'monospace', fontSize: '12px', color: '#e0e0e0' }));
    }
    this.flText = this.add.text(704, 336, '', { fontFamily: 'monospace', fontSize: '13px', color: '#d500f9' });

    // Commentary feed: the last 3 events, newest at the bottom, older lines fading out.
    this.drawPanel(56, 540, 624, 104);
    this.add.text(72, 548, 'COMMENTARY', { fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.gold, fontStyle: 'bold' });
    for (let i = 0; i < 3; i++) {
      this.feedTexts.push(this.add.text(72, 566 + i * 18, '', { fontFamily: THEME.fontFamily, fontSize: '14px', color: '#f5c518' }));
    }
    this.calloutText = this.add.text(72, 622, '', { fontSize: '15px', color: '#00e5ff' });
    this.flashText = this.add.text(480, 629, '', { fontSize: '17px', color: '#00c853', fontStyle: 'bold' }).setOrigin(0, 0.5).setAlpha(0);

    // Order radio (live risk).
    this.drawPanel(56, 656, 476, 86);
    this.add.text(70, 668, 'Orders', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    ORDER.forEach((o, i) => {
      const box = this.add.rectangle(200 + i * 122, 696, 112, 34, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(200 + i * 122, 696, o.label, { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.order = o.risk; this.sd.season.lastRisk = o.risk; this.refreshOrder(); });
      this.orderBoxes.push(box);
    });
    this.refreshOrder();

    // Speed control.
    this.drawPanel(552, 656, 280, 86);
    this.add.text(566, 668, 'Speed', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    RACE_SPEEDS.forEach((sp, i) => {
      const box = this.add.rectangle(680 + i * 70, 696, 60, 34, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(680 + i * 70, 696, `${sp}x`, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.speed = sp; this.refreshSpeed(); });
      this.speedBoxes.push(box);
    });
    this.refreshSpeed();

    if (weather === 'wet') this.createRain();

     // Mute button (top-right speaker icon).
    this.soundEngine = (this.game as unknown as { __soundEngine: SoundEngine }).__soundEngine;
    this.muteBtn = this.add.text(980, 16, this.soundEngine.isMuted() ? '🔇' : '🔊', { fontSize: '22px' }).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerup', () => {
      this.soundEngine.toggleMute();
      this.muteBtn.setText(this.soundEngine.isMuted() ? '🔇' : '🔊');
     });

    this.drawLegend();
    new Button(this, { x: 930, y: 700, width: 140, height: 44, label: 'SKIP', onClick: () => this.skip() });
    // Place everyone on the grid BEFORE lap 1 resolves, so a lap-1 crasher's dot has a
    // real on-track position to freeze at (not the sprite's init position).
    this.prevSnapshot = this.buildSnapshot();
    this.renderFrame(0);
    // Prime lap 1 so dots roll from the gun (prev=grid, cur=lap1) — no frozen opening lap.
    this.advanceOneLap();
    this.renderFrame(0);
  }

  private drawLegend(): void {
    this.drawPanel(688, 358, 316, 118);
    this.add.text(704, 372, 'Bikes:', { fontFamily: THEME.fontFamily, fontSize: '13px', color: '#94a3b8', fontStyle: 'bold' });
    const legend: [string, number][] = [['Velocita', 0xe94560], ['Apex', 0x4fc3f7], ['Titan', 0xcfd8dc], ['Vortex', 0xff9800]];
    legend.forEach(([name, color], i) => {
      const lx = 758 + (i % 2) * 130, ly = 392 + Math.floor(i / 2) * 24;
      this.add.circle(lx, ly, 5, color);
      this.add.text(lx + 12, ly, name, { fontSize: '13px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    });
    this.add.text(704, 442, "Gold ring = you  ·  cyan ring = the rider you're chasing  ·  glow = slipstream tow", { fontFamily: THEME.fontFamily, fontSize: '12px', color: '#94a3b8', wordWrap: { width: 284 } });
  }

  private refreshOrder(): void {
    ORDER.forEach((o, i) => this.orderBoxes[i].setFillStyle(o.risk === this.order ? 0x0f3460 : 0x16213e).setStrokeStyle(2, o.risk === this.order ? 0xf5c518 : 0x0f3460));
  }
  private refreshSpeed(): void {
    RACE_SPEEDS.forEach((sp, i) => this.speedBoxes[i].setFillStyle(sp === this.speed ? 0x0f3460 : 0x16213e).setStrokeStyle(2, sp === this.speed ? 0xf5c518 : 0x0f3460));
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    g.fillRect(0, 0, 1024, 1100);
  }

  private drawPanel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(THEME.panelStyle.bgNum, 0.85);
    g.fillRoundedRect(x, y, w, h, THEME.panelStyle.radius);
    g.lineStyle(2, THEME.panelStyle.borderNum, 1);
    g.strokeRoundedRect(x, y, w, h, THEME.panelStyle.radius);
    return g;
  }

  private drawTrack(): void {
    const wet = this.sd.run.weather === 'wet';
    const g = this.add.graphics();
    const pts = this.path.samples.map((p) => new Phaser.Math.Vector2(OX + p.x * W, OY + p.y * H));
    // Grass/outer curb (darker, colder under rain).
    g.lineStyle(26, wet ? 0x12401a : 0x1b5e20); g.strokePoints(pts, true, true);
    // Alternating curb segments on curves.
    g.lineStyle(18, wet ? 0x8e2020 : 0xc62828); g.strokePoints(pts, true, true);
    g.lineStyle(18, wet ? 0xb8c4cc : 0xffffff); g.strokePoints(pts, true, true);
    // Asphalt surface — blue-dark sheen when wet.
    g.lineStyle(14, wet ? 0x1e3a4a : 0x263238); g.strokePoints(pts, true, true);
    // Inner edge line.
    g.lineStyle(2, 0xffffff, wet ? 0.2 : 0.35); g.strokePoints(pts, true, true);
    if (wet) {
      // Standing-water glints along the racing line.
      const glint = this.add.graphics();
      glint.lineStyle(4, 0x4fc3f7, 0.12);
      glint.strokePoints(pts, true, true);
    }
  }

  // Lightweight rain layer: diagonal streaks over the track viewport, redrawn per frame.
  private createRain(): void {
    for (let i = 0; i < 70; i++) {
      this.rainDrops.push({
        x: OX - 40 + ((i * 137) % (W + 80)),
        y: OY - 20 + ((i * 89) % (H + 40)),
        len: 8 + (i % 5) * 2,
        sp: 0.5 + (i % 4) * 0.15,
      });
    }
    this.rainG = this.add.graphics();
  }

  private updateRain(delta: number): void {
    if (!this.rainG) return;
    this.rainG.clear();
    this.rainG.lineStyle(1, 0x9ad0ff, 0.35);
    for (const d of this.rainDrops) {
      d.y += d.sp * delta;
      d.x -= d.sp * delta * 0.25;
      if (d.y > OY + H + 20) { d.y = OY - 20; d.x = OX - 40 + Math.abs((d.x * 7919) % (W + 80)); }
      if (d.x < OX - 40) d.x += W + 80;
      if (d.y > OY + H + 20) continue; // big frame delta can overshoot; skip the stray frame
      this.rainG.lineBetween(d.x, d.y, d.x + d.len * 0.25, d.y - d.len);
    }
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
    this.prevSnapshot = this.buildSnapshot();
    const preCrashed = new Set(this.sd.run.states.filter((s) => s.crashed).map((s) => s.rider.id));
    stepLap(this.sd.run, this.order);
    const crashers = this.sd.run.states.filter((s) => s.crashed && !preCrashed.has(s.rider.id));
    if (crashers.length > 0) {
      this.soundEngine.playCrash();
      for (const s of crashers) this.spawnCrashEffect(s.rider.id);
    }
    this.snapshot(this.cur);
    this.lapsDone += 1;
    const curSnap = this.buildSnapshot();
    this.commentaryQueue.push(...generateCommentary(this.prevSnapshot, curSnap));
    // Live position arrows: movement vs the previous lap, shown until the next lap.
    this.posArrows.clear();
    for (const [id, pos] of curSnap.positions.entries()) {
      const pp = this.prevSnapshot.positions.get(id);
      this.posArrows.set(id, pp === undefined || pp === pos || curSnap.crashed.has(id) ? ' ' : pos < pp ? '▲' : '▼');
    }
    if (this.lapsDone === RACE_LAPS) this.showFinalLapBanner();
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

  private buildSnapshot(): RaceSnapshot {
    const states = this.sd.run.states;
    const order = states.slice().sort((a, b) => {
      if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;
      return b.progress - a.progress;
    });
    const positions = new Map(order.map((s, i) => [s.rider.id, i + 1]));
    const riders = states.map((s) => ({ id: s.rider.id, name: s.rider.name }));
    const crashed = new Set(states.filter((s) => s.crashed).map((s) => s.rider.id));
    // Gap (race-fiction seconds) to the rider directly ahead — drives battle commentary.
    const gapAheadSec = new Map<string, number>();
    order.forEach((s, i) => {
      if (i === 0 || s.crashed) return;
      const ahead = order[i - 1];
      if (ahead.crashed) return;
      gapAheadSec.set(s.rider.id, Math.max(0, (this.raceTime.get(s.rider.id) ?? 0) - (this.raceTime.get(ahead.rider.id) ?? 0)));
    });
    const fastestLap = this.fastest ? { id: this.fastest.id, time: formatLapTime(this.fastest.time) } : null;
    const overtakeBy = new Map<string, string>();
    if (this.prevSnapshot) {
      const playerId = this.sd.season.playerRider.id;
      const prevPos = this.prevSnapshot.positions.get(playerId) ?? -1;
      const curPos = positions.get(playerId) ?? -1;
      if (prevPos > 0 && curPos > 0 && curPos < prevPos) {
        // The rider who was at the player's current position in the previous snapshot was overtaken.
        for (const [rid, pos] of this.prevSnapshot.positions.entries()) {
          if (pos === curPos) { overtakeBy.set(playerId, rid); break; }
        }
      }
    }
    return {
      lap: this.lapsDone,
      totalLaps: RACE_LAPS,
      positions,
      riders,
      crashed,
      fastestLap,
      tireWear: new Map(states.map((s) => [s.rider.id, s.tireWear])),
      overtookBy: new Map(),
      overtakeBy,
      gapAheadSec,
    };
  }

  // Crash moment: shake, expanding shockwave ring, skid mark, and an ✕ over the dot.
  private spawnCrashEffect(riderId: string): void {
    const g = this.gfx.get(riderId);
    if (!g) return;
    const { x, y } = g.dot;
    this.cameras.main.shake(180, 0.004);
    const wave = this.add.circle(x, y, 6).setStrokeStyle(3, 0xff1744, 0.9);
    this.tweens.add({ targets: wave, radius: 30, alpha: 0, duration: 550, ease: 'Quad.easeOut', onComplete: () => wave.destroy() });
    const skid = this.add.graphics();
    skid.lineStyle(3, 0x0b0b14, 0.7);
    skid.lineBetween(x - 10, y + 4, x + 6, y - 3);
    skid.lineBetween(x - 8, y + 8, x + 8, y + 1);
    this.tweens.add({ targets: skid, alpha: 0.25, duration: 3000, ease: 'Quad.easeOut' });
    const mark = this.add.text(x, y - 14, '✕', { fontSize: '14px', color: '#ff5f7a', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: mark, alpha: 0.6, y: y - 18, duration: 1200, ease: 'Quad.easeOut' });
  }

  private showFinalLapBanner(): void {
    const banner = this.add.text(OX + W / 2, OY + 60, 'FINAL LAP', {
      fontFamily: THEME.fontFamily, fontSize: '42px', color: '#f5c518', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0).setScale(0.6);
    this.tweens.add({
      targets: banner, alpha: 1, scale: 1.05, duration: 350, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({ targets: banner, alpha: 0, duration: 900, delay: 1200, onComplete: () => banner.destroy() }),
    });
  }

  // Checkered-flag flourish at the moment the race ends, before the results scene.
  private showFinishFlourish(): void {
    const flag = this.add.text(OX + W / 2, OY + H / 2 - 30, '🏁', { fontSize: '64px' }).setOrigin(0.5).setAlpha(0).setScale(0.4);
    this.tweens.add({ targets: flag, alpha: 1, scale: 1.2, duration: 400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: flag, angle: { from: -8, to: 8 }, duration: 180, yoyo: true, repeat: 5 });
    const playerPos = this.buildSnapshot().positions.get(this.sd.season.playerRider.id);
    const label = playerPos ? `You finish P${playerPos}!` : 'Race complete!';
    const sub = this.add.text(OX + W / 2, OY + H / 2 + 34, label, {
      fontFamily: THEME.fontFamily, fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 250 });
  }

  private updateCommentary(delta: number): void {
    if (this.commentaryQueue.length === 0) return;
    this.commentaryTimer += delta;
    // Feed pacing scales with playback speed; drains faster when a burst queues up
    // so no event is silently dropped.
    const dwell = (this.commentaryQueue.length > 2 ? 700 : 1500) / this.speed;
    if (this.commentaryTimer < dwell && this.feed.length > 0) return;
    this.commentaryTimer = 0;
    this.feed.push(this.commentaryQueue.shift()!);
    if (this.feed.length > 3) this.feed.shift();
    // Newest line at the bottom, older lines fading out above it.
    const ALPHAS = [0.35, 0.6, 1];
    const start = 3 - this.feed.length;
    for (let i = 0; i < 3; i++) {
      const ev = this.feed[i - start];
      const t = this.feedTexts[i];
      if (!ev) { t.setText(''); continue; }
      t.setText(ellipsize(ev.text, 68));
      t.setColor(COMMENTARY_COLOR[ev.type] ?? '#f5c518');
      t.setAlpha(ALPHAS[i]);
    }
  }

  private applyDotNudge(screen: Map<string, { x: number; y: number; t: number }>): void {
    const ids = [...screen.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = screen.get(ids[i])!, b = screen.get(ids[j])!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 12) {
          const midT = ((a.t + b.t) / 2 + 1) % 1;
          const p0 = pointAt(this.path, midT);
          const p1 = pointAt(this.path, (midT + 0.005) % 1);
          const tx = (p1.x - p0.x) * W, ty = (p1.y - p0.y) * H;
          const len = Math.hypot(tx, ty) || 1;
          const nx = -ty / len, ny = tx / len;
          const push = 4 * (1 - dist / 12);
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
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

    const screen = new Map<string, { x: number; y: number; t: number }>();
    for (const s of states) {
      const id = s.rider.id;
      const g = this.gfx.get(id)!;
      if (s.crashed) {
        g.dot.setFillStyle(0xff1744);                 // frozen where they crashed
        screen.set(id, { x: g.dot.x, y: g.dot.y, t: 0 });
        continue;
      }
      const target = slots.get(id)!.placeBehind;
      const last = this.placeBehind.get(id) ?? target;
      const pb = last + (target - last) * EMA;
      this.placeBehind.set(id, pb);
      const t = (((anchor - pb) % 1) + 1) % 1;
      const pt = pointAt(this.path, t);
      const sx = OX + pt.x * W, sy = OY + pt.y * H;
      screen.set(id, { x: sx, y: sy, t });
    }
    this.applyDotNudge(screen);
    // Slipstream tows on the interpolated positions: towed riders get a glow halo.
    const progressArr = states.map((s) => trueP.get(s.rider.id)!);
    const crashedArr = states.map((s) => s.crashed);
    for (let i = 0; i < states.length; i++) {
      const s = states[i];
      const id = s.rider.id;
      const g = this.gfx.get(id)!;
      if (s.crashed) { g.glow.setVisible(false); continue; }
      const pos = screen.get(id)!;
      g.dot.setPosition(pos.x, pos.y); g.num.setPosition(pos.x, pos.y);
      if (g.ring) g.ring.setPosition(pos.x, pos.y);
      g.glow.setPosition(pos.x, pos.y).setVisible(hasDraftTow(progressArr, crashedArr, i));
    }

    // Leaderboard — real progress (the same key the result uses), gaps on the race-fiction clock.
    const order = states.slice().sort((a, b) => {
      if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;
      return b.progress - a.progress;
    });
    const playerIdx = order.findIndex((s) => s.rider.isPlayer);

    const pLast = this.lastLap.get(this.sd.season.playerRider.id);
    const playerState = states.find((s) => s.rider.isPlayer)!;
    const playerWear = Math.round(playerState.tireWear);
    this.tireText.setText(`Tires: ${getCompoundLabel(playerState.compound)}`).setColor(hex(getCompoundColor(playerState.compound)));
    // Wear reads as a traffic light: fine → managing → critical.
    const wearColor = playerWear < 50 ? '#00c853' : playerWear < 75 ? '#ffd54f' : '#ff5f7a';
    this.tireWearText.setText(`${playerWear}% worn`).setColor(wearColor);
    this.lapText.setText(`Lap ${Math.min(RACE_LAPS, this.lapsDone)} / ${RACE_LAPS}`);
    this.playerLapText.setText(`Last lap: ${pLast ? formatLapTime(pLast) : '—'}`);

    // Gaps come from accumulated lap times (same clock as the lap times themselves), so a
    // gap of "+2.4" is consistent with the lap times shown; a full lap behind reads "+1 LAP".
    const leaderTime = this.raceTime.get(order[0]?.rider.id ?? '') ?? 0;
    const leaderProg = order[0]?.progress ?? 0;
    order.forEach((s, i) => {
      const r = s.rider;
      const near = Math.abs(i - playerIdx) === 1;
      const tag = r.isPlayer ? '>' : near ? '·' : ' ';
      const lapsDown = Math.floor((leaderProg - s.progress) / this.progressPerLoop + 1e-9);
      const gapStr = s.crashed ? 'OUT'
        : i === 0 ? 'LEAD'
        : lapsDown >= 1 ? `+${lapsDown} LAP`
        : `+${Math.max(0, (this.raceTime.get(r.id) ?? 0) - leaderTime).toFixed(1)}`;
      const lt = this.lastLap.get(r.id);
      const ltStr = s.crashed || !lt ? '—' : formatLapTime(lt);
      const arrow = this.posArrows.get(r.id) ?? ' ';
      const row = this.rowTexts[i];
      row.setText(`${tag}${String(i + 1).padStart(2)}${arrow} #${String(this.numbers.get(r.id)).padStart(2)} ${ellipsize(r.name, 12).padEnd(12)} ${gapStr.padStart(7)} ${ltStr.padStart(8)}`);
      row.setColor(s.crashed ? '#8b93a7' : r.isPlayer ? '#f5c518' : arrow === '▲' ? '#a5ffc8' : arrow === '▼' ? '#ffb3c0' : '#e0e0e0');
    });

    // Fastest-lap banner.
    if (this.fastest) {
      const fr = states.find((s) => s.rider.id === this.fastest!.id)!.rider;
      this.flText.setText(`⚡ FL  #${this.numbers.get(fr.id)} ${ellipsize(fr.name, 12)}  ${formatLapTime(this.fastest.time)}`);
    }

    // Mark and name whoever the player is battling (the rider directly ahead).
    const me = order[playerIdx];
    if (me?.crashed) {
      this.chaseRing.setVisible(false);
      this.calloutText.setText('You crashed out.');
     } else if (playerIdx > 0) {
      const ahead = order[playerIdx - 1];
      const pos = screen.get(ahead.rider.id)!;
      const gapS = Math.max(0, (this.raceTime.get(me.rider.id) ?? 0) - (this.raceTime.get(ahead.rider.id) ?? 0));
      const inBattle = gapS < 1.0;
      this.chaseRing.setPosition(pos.x, pos.y).setVisible(true).setStrokeStyle(2, inBattle ? 0xffb74d : 0x00e5ff);
      this.calloutText
        .setText(`${inBattle ? '» BATTLE!  ' : ''}P${playerIdx + 1} — chasing #${this.numbers.get(ahead.rider.id)} ${ellipsize(ahead.rider.name, 18)} (+${gapS.toFixed(1)}s)`)
        .setColor(inBattle ? '#ffb74d' : '#00e5ff');
    } else {
      this.chaseRing.setVisible(false);
      this.calloutText.setText('You are leading the race!').setColor('#00e5ff');
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
       if (gained) this.soundEngine.playOvertake();
      }
    this.prevPlayerPos = curPos;
  }

  update(_t: number, delta: number): void {
    if (this.done) return;
    this.updateCommentary(delta);
    this.updateRain(delta);
    const lapMs = (RACE_ANIM_SECONDS * 1000) / RACE_LAPS;
    this.acc += delta * this.speed;
    while (this.acc >= lapMs && this.lapsDone < RACE_LAPS) { this.advanceOneLap(); this.acc -= lapMs; }
    if (this.lapsDone >= RACE_LAPS && this.acc >= lapMs) {
      this.renderFrame(1); this.done = true; this.soundEngine.stopEngine();
      this.soundEngine.playCheckeredFlag();
      this.showFinishFlourish();
      this.time.delayedCall(1600, () => this.finish());
      return;
    }
    this.renderFrame(Math.min(1, this.acc / lapMs));
    this.soundEngine.playEngine(this.speed);
   }

  private skip(): void {
    if (this.done) return;
    while (this.lapsDone < RACE_LAPS) this.advanceOneLap();
    this.done = true;
    this.soundEngine.playCheckeredFlag();
    this.finish();
  }

  private finish(): void {
    const run = this.sd.run;
    const result = finalizeRace(run, run.rng);
    const summaries = applyProgression([this.sd.season.playerRider, ...this.sd.season.aiRiders], result);
    applyRaceResult(this.sd.season, result);
     // Award prize money to career
    if (this.career) {
      const playerEntry = result.finishingOrder.find((e) => e.rider.isPlayer);
      if (playerEntry) this.career.money += prizeFor(playerEntry.position);
      saveCareer(this.career);
       }
    const playerSummary = summaries.find((su) => su.riderId === 'player')!;
    this.scene.start('RaceResultScene', { season: this.sd.season, result, playerSummary, career: this.career } as never);
     }
}
