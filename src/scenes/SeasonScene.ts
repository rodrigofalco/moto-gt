import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { runRace } from '../core/RaceEngine';
import { applyRaceResult, getStandings } from '../core/Championship';
import { applyProgression, investBikePoint } from '../core/Progression';
import { RNG } from '../core/RNG';
import { SETUPS, RISKS } from '../core/constants';
import type { SeasonState, Setup, Risk, BikeParams } from '../core/types';

const SETUP_LABEL: Record<Setup, string> = { topSpeed: 'Top Speed', handling: 'Handling', acceleration: 'Acceleration' };
const RISK_LABEL: Record<Risk, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export class SeasonScene extends Phaser.Scene {
  private season!: SeasonState;
  private setup: Setup = 'handling';
  private risk: Risk = 'medium';
  private setupBoxes: Record<Setup, Phaser.GameObjects.Rectangle> = {} as never;
  private riskBoxes: Record<Risk, Phaser.GameObjects.Rectangle> = {} as never;
  private bikeText!: Phaser.GameObjects.Text;
  private rndText!: Phaser.GameObjects.Text;

  constructor() { super('SeasonScene'); }
  init(data: { season: SeasonState }): void { this.season = data.season; }

  create(): void {
    const idx = this.season.currentRaceIndex;
    const track = this.season.calendar[idx];
    this.add.text(40, 24, `Race ${idx + 1} of ${this.season.calendar.length} — ${track.name}`, { fontSize: '24px', color: '#f5c518' });
    this.add.text(40, 60, `Track focus   Speed ${track.weights.speed.toFixed(2)}   Cornering ${track.weights.cornering.toFixed(2)}   Accel ${track.weights.acceleration.toFixed(2)}`, { fontSize: '15px', color: '#94a3b8' });

    const s = this.season.playerRider.skills;
    this.add.text(40, 108, `Pilot   Pace ${s.pace}   Cornering ${s.cornering}   Consistency ${s.consistency}`, { fontSize: '16px', color: '#e0e0e0' });
    this.bikeText = this.add.text(40, 138, '', { fontSize: '16px', color: '#e0e0e0' });

    // R&D panel
    this.rndText = this.add.text(40, 180, '', { fontSize: '16px', color: '#f5c518' });
    (['speed', 'handling', 'acceleration'] as (keyof BikeParams)[]).forEach((param, i) => {
      const x = 40 + i * 160;
      const plus = this.add.text(x, 210, `[+] ${param}`, { fontSize: '15px', color: '#00c853' }).setInteractive({ useHandCursor: true });
      plus.on('pointerup', () => { if (investBikePoint(this.season.playerRider, param)) this.refreshBike(); });
    });
    this.refreshBike();

    // Setup selector
    this.add.text(40, 268, 'Setup (match the track)', { fontSize: '18px', color: '#e0e0e0' });
    SETUPS.forEach((st, i) => {
      const box = this.add.rectangle(130 + i * 200, 308, 184, 34, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(130 + i * 200, 308, SETUP_LABEL[st], { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.setup = st; this.refreshSelectors(); });
      this.setupBoxes[st] = box;
    });

    // Risk selector
    this.add.text(40, 360, 'Risk (push vs crash)', { fontSize: '18px', color: '#e0e0e0' });
    RISKS.forEach((rk, i) => {
      const box = this.add.rectangle(130 + i * 200, 400, 184, 34, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(130 + i * 200, 400, RISK_LABEL[rk], { fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { this.risk = rk; this.refreshSelectors(); });
      this.riskBoxes[rk] = box;
    });
    this.refreshSelectors();

    this.add.text(720, 90, 'Standings', { fontSize: '20px', color: '#f5c518' });
    renderStandings(this, 720, 120, getStandings(this.season));

    new Button(this, { x: 320, y: 700, width: 280, height: 56, label: 'SIMULATE RACE', onClick: () => this.simulate() });
  }

  private refreshBike(): void {
    const b = this.season.playerRider.bike;
    this.bikeText.setText(`Bike    Speed ${b.speed}   Handling ${b.handling}   Acceleration ${b.acceleration}`);
    this.rndText.setText(`Development points: ${this.season.playerRider.rndPoints}   (spend below)`);
  }

  private refreshSelectors(): void {
    SETUPS.forEach((st) => this.setupBoxes[st].setFillStyle(st === this.setup ? 0x0f3460 : 0x16213e).setStrokeStyle(2, st === this.setup ? 0xf5c518 : 0x0f3460));
    RISKS.forEach((rk) => this.riskBoxes[rk].setFillStyle(rk === this.risk ? 0x0f3460 : 0x16213e).setStrokeStyle(2, rk === this.risk ? 0xf5c518 : 0x0f3460));
  }

  private simulate(): void {
    const rng = new RNG((Date.now() ^ (this.season.currentRaceIndex * 2654435761)) >>> 0);
    const { result, timeline } = runRace(this.season, this.setup, this.risk, rng);
    const summaries = applyProgression([this.season.playerRider, ...this.season.aiRiders], result);
    applyRaceResult(this.season, result);
    const playerSummary = summaries.find((su) => su.riderId === 'player')!;
    this.scene.start('RaceScene', { season: this.season, result, timeline, playerSummary });
  }
}
