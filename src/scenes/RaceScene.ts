import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { buildPath, pointAt, type SampledPath } from '../core/Path';
import { TRACK_LAYOUTS } from '../data/trackLayouts';
import { RACE_LAPS, RACE_ANIM_SECONDS } from '../core/constants';
import type { SeasonState, RaceResult, RaceTimeline } from '../core/types';
import type { ProgressionSummary } from '../core/Progression';

// Maps the normalized [0,1] path into a screen rectangle.
const OX = 80, OY = 90, W = 600, H = 560;

interface SceneData { season: SeasonState; result: RaceResult; timeline: RaceTimeline; playerSummary: ProgressionSummary; }

export class RaceScene extends Phaser.Scene {
  private raceData!: SceneData;
  private path!: SampledPath;
  private dots: Map<string, Phaser.GameObjects.Arc> = new Map();
  private finalLeaderProgress = 1;
  private elapsedMs = 0;
  private lapText!: Phaser.GameObjects.Text;
  private orderText!: Phaser.GameObjects.Text;
  private done = false;

  constructor() { super('RaceScene'); }
  init(data: SceneData): void { this.raceData = data; this.elapsedMs = 0; this.done = false; this.dots = new Map(); }

  create(): void {
    const track = this.raceData.result.track;
    this.add.text(OX, 30, `Race Day — ${track.name}`, { fontSize: '24px', color: '#f5c518' });

    this.path = buildPath(TRACK_LAYOUTS[track.id].points);
    this.drawTrack();

    const lastLap = this.raceData.timeline.laps[this.raceData.timeline.laps.length - 1];
    this.finalLeaderProgress = Math.max(1, ...lastLap.entries.filter((e) => !e.crashed).map((e) => e.progress));

    for (const e of lastLap.entries) {
      const rider = this.riderById(e.riderId);
      const dot = this.add.circle(OX, OY, rider.isPlayer ? 8 : 6, rider.isPlayer ? 0xf5c518 : 0x4fc3f7).setStrokeStyle(2, 0x1a1a2e);
      this.dots.set(e.riderId, dot);
    }

    this.lapText = this.add.text(720, 90, '', { fontSize: '20px', color: '#f5c518' });
    this.orderText = this.add.text(720, 130, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e0e0e0' });

    new Button(this, { x: 880, y: 700, width: 180, height: 48, label: 'SKIP', onClick: () => this.finish() });
    this.renderFrame(0);
  }

  private riderById(id: string) {
    return [this.raceData.season.playerRider, ...this.raceData.season.aiRiders].find((r) => r.id === id)!;
  }

  private drawTrack(): void {
    const g = this.add.graphics();
    const pts = this.path.samples.map((p) => new Phaser.Math.Vector2(OX + p.x * W, OY + p.y * H));
    g.lineStyle(10, 0x16213e);
    g.strokePoints(pts, true, true);
    g.lineStyle(2, 0x0f3460);
    g.strokePoints(pts, true, true);
  }

  private progressAt(riderId: string, tau: number): number {
    const laps = this.raceData.timeline.laps;
    const x = tau * laps.length;
    const i = Math.min(laps.length - 1, Math.floor(x));
    const frac = x - i;
    const cur = laps[i].entries.find((e) => e.riderId === riderId)!.progress;
    const prev = i === 0 ? 0 : laps[i - 1].entries.find((e) => e.riderId === riderId)!.progress;
    return prev + (cur - prev) * frac;
  }

  private renderFrame(tau: number): void {
    const lastLap = this.raceData.timeline.laps[this.raceData.timeline.laps.length - 1];
    const standings: { id: string; prog: number }[] = [];
    for (const e of lastLap.entries) {
      const prog = this.progressAt(e.riderId, tau);
      const loops = (prog / this.finalLeaderProgress) * RACE_LAPS;
      const pt = pointAt(this.path, loops % 1);
      const dot = this.dots.get(e.riderId)!;
      dot.setPosition(OX + pt.x * W, OY + pt.y * H);
      if (e.crashed && tau >= 0.985) dot.setFillStyle(0xff1744);
      standings.push({ id: e.riderId, prog });
    }
    standings.sort((a, b) => b.prog - a.prog);
    const lap = Math.min(RACE_LAPS, Math.floor(tau * RACE_LAPS) + 1);
    this.lapText.setText(`Lap ${lap} / ${RACE_LAPS}`);
    this.orderText.setText(standings.slice(0, 10).map((s, i) => {
      const r = this.riderById(s.id);
      const tag = r.isPlayer ? '>' : ' ';
      return `${tag}${String(i + 1).padStart(2)} ${r.name.slice(0, 14)}`;
    }).join('\n'));
  }

  update(_time: number, delta: number): void {
    if (this.done) return;
    this.elapsedMs += delta;
    const tau = Math.min(1, this.elapsedMs / (RACE_ANIM_SECONDS * 1000));
    this.renderFrame(tau);
    if (tau >= 1) { this.done = true; this.time.delayedCall(800, () => this.goToResult()); }
  }

  private finish(): void { if (!this.done) { this.done = true; this.goToResult(); } }

  private goToResult(): void {
    this.scene.start('RaceResultScene', { season: this.raceData.season, result: this.raceData.result, playerSummary: this.raceData.playerSummary });
  }
}
