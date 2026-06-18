import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { createSeason } from '../core/factories/SeasonFactory';
import { RNG } from '../core/RNG';
import { PILOT_ROSTER } from '../data/pilots';
import { BRAND_ROSTER } from '../data/brands';
import { hasCareer, loadCareer, newCareer, saveCareer } from '../core/CareerStore';
import type { PilotArchetype, Brand } from '../core/types';

export class MainMenuScene extends Phaser.Scene {
  private team = 'My Team';
  private teamText!: Phaser.GameObjects.Text;
  private editingTeam = false;
  private pilot: PilotArchetype | null = null;
  private brand: Brand | null = null;
  private pilotCards: Card[] = [];
  private brandCards: Card[] = [];
  private startButton!: Button;
  private hasSave = false;
  private selectionUI!: Phaser.GameObjects.Container;

  constructor() { super('MainMenuScene'); }

  create(): void {
    this.add.text(512, 36, 'MotoGT', { fontSize: '52px', color: '#f5c518' }).setOrigin(0.5);

    this.hasSave = hasCareer();
    if (this.hasSave) {
      new Button(this, { x: 512, y: 100, width: 300, height: 48, label: 'CONTINUE CAREER', onClick: () => this.continueCareer() });
      new Button(this, { x: 512, y: 160, width: 300, height: 48, label: 'NEW CAREER', onClick: () => this.showSelection() });
      this.selectionUI = this.createSelectionUI(true);
     } else {
      this.selectionUI = this.createSelectionUI(false);
     }

     // Team name (native keyboard input).
    this.add.text(330, 92, 'Team:', { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const box = this.add.rectangle(560, 92, 240, 32, 0x0f3460).setStrokeStyle(2, 0x16213e);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => { this.editingTeam = true; this.renderTeam(); });
    this.teamText = this.add.text(450, 92, this.team, { fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
   }

  private createSelectionUI(hidden: boolean): Phaser.GameObjects.Container {
    const group = this.add.container(0, 220);

    this.add.text(80, 0, 'Choose your pilot', { fontSize: '18px', color: '#e0e0e0' });
    PILOT_ROSTER.forEach((p, i) => {
      const card = new Card(this, {
        x: 160 + (i % 3) * 235, y: 0 + Math.floor(i / 3) * 150, width: 220, height: 130,
        title: p.name, subtitle: p.nickname,
        stats: [
          { label: 'Pace', value: p.skills.pace },
          { label: 'Cornering', value: p.skills.cornering },
          { label: 'Consistency', value: p.skills.consistency },
        ],
        onClick: () => { this.pilot = p; this.pilotCards.forEach((c, j) => c.setSelected(j === i)); this.refresh(); },
      });
      this.pilotCards.push(card);
      group.add(card);
     });

    this.add.text(80, 510, 'Choose your bike', { fontSize: '18px', color: '#e0e0e0' });
    BRAND_ROSTER.forEach((b, i) => {
      const card = new Card(this, {
        x: 160 + i * 235, y: 510 + 115, width: 220, height: 120,
        title: b.name,
        stats: [
          { label: 'Speed', value: b.params.speed },
          { label: 'Handling', value: b.params.handling },
          { label: 'Acceleration', value: b.params.acceleration },
        ],
        onClick: () => { this.brand = b; this.brandCards.forEach((c, j) => c.setSelected(j === i)); this.refresh(); },
      });
      this.brandCards.push(card);
      group.add(card);
     });

    new Button(this, { x: 512, y: 725, width: 280, height: 54, label: 'START SEASON', onClick: () => this.start() });

    if (hidden) group.setVisible(false);
    return group;
   }

  private showSelection(): void {
    this.selectionUI.setVisible(true);
   }

  private continueCareer(): void {
    const career = loadCareer();
    if (!career) return;
    let season = career.season;
    if (!season) {
       // First season — create it from the career
      const rng = new RNG((Date.now() ^ 0) >>> 0);
      const pilot = PILOT_ROSTER.find((p) => p.id === career.pilotArchetypeId);
      const brand = BRAND_ROSTER.find((b) => b.id === career.brandId);
      if (pilot && brand) {
        season = createSeason(career.team, pilot, brand, rng);
       }
     }
    if (!season) return;
    this.scene.start('SeasonScene', { season });
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
  }

  private start(): void {
    if (!this.pilot || !this.brand) return;
    const career = newCareer(this.team.trim(), this.pilot.id, this.brand.id, new RNG(Date.now() >>> 0));
    const season = createSeason(career.team, PILOT_ROSTER.find((p) => p.id === career.pilotArchetypeId)!, BRAND_ROSTER.find((b) => b.id === career.brandId)!, new RNG((Date.now() + 1) >>> 0));
    career.season = season;
    saveCareer(career);
    this.scene.start('SeasonScene', { season: season, career } as never);
   }
}
