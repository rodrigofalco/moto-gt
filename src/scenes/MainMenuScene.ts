import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { createSeason } from '../core/factories/SeasonFactory';
import { RNG } from '../core/RNG';
import { SaveSystem } from '../core/SaveSystem';
import { PILOT_ROSTER } from '../data/pilots';
import { BRAND_ROSTER } from '../data/brands';
import type { PilotArchetype, Brand, CareerStats } from '../core/types';

export class MainMenuScene extends Phaser.Scene {
  private team = 'My Team';
  private teamText!: Phaser.GameObjects.Text;
  private editingTeam = false;
  private pilot: PilotArchetype | null = null;
  private brand: Brand | null = null;
  private pilotCards: Card[] = [];
  private brandCards: Card[] = [];
  private startButton!: Button;
  private continueButton!: Button;
  private careerStats: CareerStats | null = null;

  constructor() { super('MainMenuScene'); }

  init(data: { carryCareer?: boolean; careerStats?: CareerStats } = {}): void {
    this.careerStats = data.carryCareer && data.careerStats ? data.careerStats : null;
   }

  create(): void {
    this.add.text(512, 36, 'MotoGT', { fontSize: '52px', color: '#f5c518' }).setOrigin(0.5);

    // Team name (native keyboard input).
    this.add.text(330, 92, 'Team:', { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const box = this.add.rectangle(560, 92, 240, 32, 0x0f3460).setStrokeStyle(2, 0x16213e);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => { this.editingTeam = true; this.renderTeam(); });
    this.teamText = this.add.text(450, 92, this.team, { fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));

    this.add.text(80, 132, 'Choose your pilot', { fontSize: '18px', color: '#e0e0e0' });
    PILOT_ROSTER.forEach((p, i) => {
      const card = new Card(this, {
        x: 160 + (i % 3) * 235, y: 225 + Math.floor(i / 3) * 150, width: 220, height: 130,
        title: p.name, subtitle: p.nickname,
        stats: [
          { label: 'Pace', value: p.skills.pace },
          { label: 'Cornering', value: p.skills.cornering },
          { label: 'Consistency', value: p.skills.consistency },
        ],
        onClick: () => { this.pilot = p; this.pilotCards.forEach((c, j) => c.setSelected(j === i)); this.refresh(); },
      });
      this.pilotCards.push(card);
    });

    this.add.text(80, 530, 'Choose your bike', { fontSize: '18px', color: '#e0e0e0' });
    BRAND_ROSTER.forEach((b, i) => {
      const card = new Card(this, {
        x: 160 + i * 235, y: 625, width: 220, height: 120,
        title: b.name,
        stats: [
          { label: 'Speed', value: b.params.speed },
          { label: 'Handling', value: b.params.handling },
          { label: 'Acceleration', value: b.params.acceleration },
        ],
        onClick: () => { this.brand = b; this.brandCards.forEach((c, j) => c.setSelected(j === i)); this.refresh(); },
      });
      this.brandCards.push(card);
    });

    const save = SaveSystem.Instance;
    const hasSave = save.hasSave();

    this.continueButton = new Button(this, { x: 512, y: 645, width: 280, height: 48, label: 'CONTINUE', onClick: () => {
      const s = save.loadSeason();
      if (s) this.scene.start('SeasonScene', { season: s });
     }});
    this.continueButton.setEnabled(hasSave);

    this.startButton = new Button(this, { x: 512, y: 725, width: 280, height: 54, label: 'NEW SEASON', onClick: () => this.start() });
    this.refresh();
    this.renderTeam();
    this.renderCareerBadge();
    }

  private onKey(e: KeyboardEvent): void {
    if (!this.editingTeam) return;
    if (e.key === 'Backspace') this.team = this.team.slice(0, -1);
    else if (e.key === 'Enter') this.editingTeam = false;
    else if (e.key.length === 1 && /[A-Za-z0-9 \-_']/.test(e.key) && this.team.length < 20) this.team += e.key;
    else return;
    this.renderTeam();
    this.refresh();
  }

  private renderTeam(): void {
    this.teamText.setText(this.team + (this.editingTeam ? '|' : ''));
    this.teamText.setColor(this.editingTeam ? '#f5c518' : '#ffffff');
  }

  private refresh(): void {
    this.startButton.setEnabled(this.team.trim().length > 0 && this.pilot !== null && this.brand !== null);
    this.continueButton.setEnabled(SaveSystem.Instance.hasSave());
    }

  private renderCareerBadge(): void {
    if (!this.careerStats) return;
    const badge = this.add.text(512, 680, `Career: ${this.careerStats.seasonsPlayed} seasons | ${this.careerStats.totalWins} wins | Best: P${this.careerStats.bestChampionship === 99 ? '-' : this.careerStats.bestChampionship}`, { fontSize: '13px', color: '#f5c518' }).setOrigin(0.5);
    badge.setAlpha(0.7);
    }

  private start(): void {
    if (!this.pilot || !this.brand) return;
    const season = createSeason(this.team.trim(), this.pilot, this.brand, new RNG(Date.now() >>> 0), this.careerStats ?? undefined);
    this.scene.start('SeasonScene', { season });
   }
}
