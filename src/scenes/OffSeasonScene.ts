import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { THEME } from '../ui/theme';
import { runOffSeason } from '../core/OffSeason';
import { createSeasonForCareer } from '../core/factories/SeasonFactory';
import { saveCareer } from '../core/CareerStore';
import { RNG } from '../core/RNG';
import type { CareerState, OffSeasonReport } from '../core/types';

export class OffSeasonScene extends Phaser.Scene {
  private career!: CareerState;
  private report!: OffSeasonReport;

  constructor() { super('OffSeasonScene'); }

  init(data: { career: CareerState; report?: OffSeasonReport }): void {
    this.career = data.career;
    // The caller (RaceResultScene) already ran the off-season and passes the report;
    // re-running it here would age/churn the field twice. Only run it as a fallback.
    this.report = data.report ?? runOffSeason(this.career, new RNG((Date.now() ^ this.career.seasonNumber) >>> 0));
     }

  create(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    g.fillRect(0, 0, 1024, 1100);

    this.add.text(512, 36, 'OFF-SEASON REPORT', { fontFamily: THEME.fontFamily, fontSize: '32px', color: THEME.gold, fontStyle: 'bold' }).setOrigin(0.5);

    this.drawPanel(212, 72, 600, 84);
    this.add.text(512, 96, `Season ${this.report.previousSeason} complete`, { fontFamily: THEME.fontFamily, fontSize: '18px', color: THEME.text }).setOrigin(0.5);
    this.add.text(512, 120, `Champion: ${this.report.champion}`, { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.muted }).setOrigin(0.5);
    this.add.text(512, 142, `You finished P${this.report.playerFinish}`, { fontFamily: THEME.fontFamily, fontSize: '20px', color: THEME.cyan, fontStyle: 'bold' }).setOrigin(0.5);

    if (this.report.promoted) {
      this.drawPanel(312, 170, 400, 80);
      const badge = this.add.text(512, 210, `PROMOTED!`, { fontFamily: THEME.fontFamily, fontSize: '28px', color: THEME.green, fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(512, 236, `Welcome to the next tier.`, { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.text }).setOrigin(0.5);
      this.tweens.add({ targets: badge, angle: 2, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.spawnConfetti();
    }

    const rosterY = this.report.promoted ? 270 : 180;
    this.drawPanel(212, rosterY, 600, 120);
    this.add.text(232, rosterY + 14, 'ROSTER CHANGES', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    if (this.report.retired.length > 0) {
      this.add.text(232, rosterY + 40, `Retired: ${this.report.retired.join(', ')}`, { fontFamily: THEME.fontFamily, fontSize: '14px', color: THEME.red, wordWrap: { width: 560 } });
    }
    if (this.report.rookies.length > 0) {
      this.add.text(232, rosterY + 76, `New rookies: ${this.report.rookies.join(', ')}`, { fontFamily: THEME.fontFamily, fontSize: '14px', color: THEME.blue, wordWrap: { width: 560 } });
    }
    if (this.report.retired.length === 0 && this.report.rookies.length === 0) {
      this.add.text(232, rosterY + 42, 'No roster changes this off-season.', { fontFamily: THEME.fontFamily, fontSize: '14px', color: THEME.muted });
    }

    if (this.report.statChanges.length > 0) {
      const statsY = rosterY + 140;
      this.drawPanel(212, statsY, 600, 130);
      this.add.text(232, statsY + 14, 'STAT CHANGES', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
      // Notes already carry the rider's display name — no raw ids.
      const notes = this.report.statChanges.slice(0, 5).map((s) => s.note);
      const extra = this.report.statChanges.length - 5;
      if (extra > 0) notes.push(`…and ${extra} more`);
      this.add.text(232, statsY + 42, notes.join('\n'), { fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.muted, wordWrap: { width: 560 } });
    }

    new Button(this, { x: 512, y: 640, width: 320, height: 54, label: 'START NEXT SEASON', onClick: () => this.nextSeason() });
    }

  private drawPanel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(THEME.panelStyle.bgNum, 0.85);
    g.fillRoundedRect(x, y, w, h, THEME.panelStyle.radius);
    g.lineStyle(2, THEME.panelStyle.borderNum, 1);
    g.strokeRoundedRect(x, y, w, h, THEME.panelStyle.radius);
    return g;
  }

  private spawnConfetti(): void {
    for (let i = 0; i < 40; i++) {
      const x = 200 + Math.random() * 624;
      const y = 100 + Math.random() * 200;
      const color = [THEME.goldNum, THEME.greenNum, THEME.cyanNum, THEME.redNum][Math.floor(Math.random() * 4)];
      const p = this.add.rectangle(x, y, 6, 6, color);
      this.tweens.add({
        targets: p,
        y: y + 300 + Math.random() * 200,
        angle: Math.random() * 360,
        alpha: 0,
        duration: 2000 + Math.random() * 1500,
        ease: 'Quad.easeIn',
      });
    }
  }

  private nextSeason(): void {
    const rng = new RNG((Date.now() ^ this.career.seasonNumber) >>> 0);
    const season = createSeasonForCareer(this.career, rng);
    this.career.season = season;
    saveCareer(this.career);
    this.scene.start('SeasonScene', { season, career: this.career } as never);
    }
}
