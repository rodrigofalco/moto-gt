import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { simulateRace } from '../core/RaceSimulator';
import { applyRaceResult, getStandings } from '../core/Championship';
import { RNG } from '../core/RNG';
import type { SeasonState, RidingStyle } from '../core/types';

export class SeasonScene extends Phaser.Scene {
  private season!: SeasonState;
  private style: RidingStyle = 'balanced';
  private styleTexts: Record<RidingStyle, Phaser.GameObjects.Text> = {} as never;

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

    // Style selector
    this.add.text(360, 230, 'Riding style:', { fontSize: '18px', color: '#e0e0e0' });
    let y = 270;
    (['safe', 'balanced', 'aggressive'] as RidingStyle[]).forEach((st) => {
      const t = this.add.text(380, y, st, { fontSize: '18px', color: '#e0e0e0' }).setInteractive();
      t.on('pointerdown', () => { this.style = st; this.refreshStyle(); });
      this.styleTexts[st] = t;
      y += 36;
    });
    this.refreshStyle();

    // Standings
    this.add.text(720, 60, 'Standings', { fontSize: '20px', color: '#f5c518' });
    renderStandings(this, 720, 90, getStandings(this.season));

    // Simulate
    new Button(this, { x: 460, y: 680, width: 280, height: 56, label: 'SIMULATE RACE', onClick: () => this.simulate() });
  }

  private refreshStyle(): void {
    (['safe', 'balanced', 'aggressive'] as RidingStyle[]).forEach((st) => {
      this.styleTexts[st].setColor(st === this.style ? '#f5c518' : '#e0e0e0');
    });
  }

  private simulate(): void {
    const rng = new RNG((Date.now() ^ (this.season.currentRaceIndex * 2654435761)) >>> 0);
    const result = simulateRace(this.season, this.style, rng);
    applyRaceResult(this.season, result);
    this.scene.start('RaceResultScene', { season: this.season, result });
  }
}
