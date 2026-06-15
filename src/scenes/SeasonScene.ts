import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { simulateRace } from '../core/RaceSimulator';
import { applyRaceResult, getStandings } from '../core/Championship';
import { RNG } from '../core/RNG';
import type { SeasonState, RidingStyle } from '../core/types';

const STYLES: RidingStyle[] = ['safe', 'balanced', 'aggressive'];

export class SeasonScene extends Phaser.Scene {
  private season!: SeasonState;
  private style: RidingStyle = 'balanced';
  private styleBoxes: Record<RidingStyle, Phaser.GameObjects.Rectangle> = {} as never;
  private styleLabels: Record<RidingStyle, Phaser.GameObjects.Text> = {} as never;

  constructor() { super('SeasonScene'); }

  init(data: { season: SeasonState }): void { this.season = data.season; }

  create(): void {
    const idx = this.season.currentRaceIndex;
    const track = this.season.calendar[idx];

    this.add.text(40, 30, `Race ${idx + 1} of ${this.season.calendar.length}`, { fontSize: '26px', color: '#f5c518' });

    // Calendar
    const cal = this.season.calendar.map((t, i) => {
      const mark = i < idx ? '✓' : i === idx ? '►' : ' ';
      return `${mark} ${t.name}`;
    }).join('\n');
    this.add.text(40, 90, cal, { fontFamily: 'monospace', fontSize: '16px', color: '#e0e0e0' });

    // Next race + player stats
    this.add.text(360, 90, `${track.name} (${track.location})\nTechnicality: ${track.technicality.toFixed(2)}`, { fontSize: '18px', color: '#e0e0e0' });
    const s = this.season.playerRider.stats;
    this.add.text(360, 170, `Pace ${s.pace}  Cornering ${s.cornering}  Consistency ${s.consistency}`, { fontSize: '16px', color: '#e0e0e0' });

    // Style selector — boxed buttons with full-area click targets.
    this.add.text(360, 230, 'Riding style:', { fontSize: '18px', color: '#e0e0e0' });
    let y = 280;
    STYLES.forEach((st) => {
      const box = this.add.rectangle(470, y, 220, 36, 0x16213e)
        .setStrokeStyle(2, 0x0f3460)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(470, y, st, { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0.5);
      box.on('pointerover', () => { if (st !== this.style) box.setStrokeStyle(2, 0xe94560); });
      box.on('pointerout', () => this.refreshStyle());
      box.on('pointerdown', () => { this.style = st; this.refreshStyle(); });
      this.styleBoxes[st] = box;
      this.styleLabels[st] = label;
      y += 46;
    });
    this.refreshStyle();

    // Standings
    this.add.text(720, 60, 'Standings', { fontSize: '20px', color: '#f5c518' });
    renderStandings(this, 720, 90, getStandings(this.season));

    // Simulate
    new Button(this, { x: 470, y: 680, width: 280, height: 56, label: 'SIMULATE RACE', onClick: () => this.simulate() });
  }

  private refreshStyle(): void {
    STYLES.forEach((st) => {
      const selected = st === this.style;
      this.styleBoxes[st].setFillStyle(selected ? 0x0f3460 : 0x16213e);
      this.styleBoxes[st].setStrokeStyle(2, selected ? 0xf5c518 : 0x0f3460);
      this.styleLabels[st].setColor(selected ? '#f5c518' : '#e0e0e0');
    });
  }

  private simulate(): void {
    const rng = new RNG((Date.now() ^ (this.season.currentRaceIndex * 2654435761)) >>> 0);
    const result = simulateRace(this.season, this.style, rng);
    applyRaceResult(this.season, result);
    this.scene.start('RaceResultScene', { season: this.season, result });
  }
}
