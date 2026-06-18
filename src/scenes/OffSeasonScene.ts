import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { runOffSeason } from '../core/OffSeason';
import { createSeasonForCareer } from '../core/factories/SeasonFactory';
import { saveCareer } from '../core/CareerStore';
import { RNG } from '../core/RNG';
import type { CareerState, OffSeasonReport } from '../core/types';

export class OffSeasonScene extends Phaser.Scene {
  private career!: CareerState;
  private report!: OffSeasonReport;

  constructor() { super('OffSeasonScene'); }

  init(data: { career: CareerState }): void {
    this.career = data.career;
    this.report = runOffSeason(this.career);
    }

  create(): void {
    this.add.text(512, 36, 'OFF-SEASON REPORT', { fontSize: '32px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(512, 72, `Season ${this.report.previousSeason} complete`, { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0.5);
    this.add.text(512, 100, `Champion: ${this.report.champion}`, { fontSize: '16px', color: '#94a3b8' }).setOrigin(0.5);
    this.add.text(512, 124, `You finished P${this.report.playerFinish}`, { fontSize: '18px', color: '#00e5ff' }).setOrigin(0.5);

    if (this.report.promoted) {
      this.add.text(512, 156, `PROMOTED! Welcome to the next tier.`, { fontSize: '18px', color: '#00c853' }).setOrigin(0.5);
      }

    if (this.report.retired.length > 0) {
      this.add.text(512, 196, `Retired: ${this.report.retired.join(', ')}`, { fontSize: '14px', color: '#e94560' }).setOrigin(0.5);
      }

    if (this.report.rookies.length > 0) {
      this.add.text(512, 220, `New rookies: ${this.report.rookies.join(', ')}`, { fontSize: '14px', color: '#9ad0ff' }).setOrigin(0.5);
      }

    if (this.report.statChanges.length > 0) {
      const notes = this.report.statChanges.slice(0, 5).map((s) => `${s.riderId}: ${s.note}`);
      this.add.text(512, 256, notes.join('\n'), { fontSize: '13px', color: '#94a3b8', wordWrap: { width: 700 } }).setOrigin(0.5);
      }

    new Button(this, { x: 512, y: 400, width: 320, height: 54, label: 'START NEXT SEASON', onClick: () => this.nextSeason() });
    }

  private nextSeason(): void {
    const rng = new RNG((Date.now() ^ this.career.seasonNumber) >>> 0);
    const season = createSeasonForCareer(this.career, rng);
    this.career.season = season;
    saveCareer(this.career);
    this.scene.start('SeasonScene', { season, career: this.career } as never);
    }
}
