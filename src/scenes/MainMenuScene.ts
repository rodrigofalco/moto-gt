import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { THEME } from '../ui/theme';
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
    this.drawBackground();

    // Title banner.
    const banner = this.add.graphics();
    banner.fillGradientStyle(0x0f3460, 0x0f3460, 0x1a1a2e, 0x1a1a2e, 1);
    banner.fillRoundedRect(312, 12, 400, 56, 8);
    banner.lineStyle(2, THEME.goldNum, 0.6);
    banner.strokeRoundedRect(312, 12, 400, 56, 8);
    this.add.text(512, 40, 'MotoGT', { fontFamily: THEME.fontFamily, fontSize: '52px', color: THEME.gold, fontStyle: 'bold' }).setOrigin(0.5);

    this.hasSave = hasCareer();
    new Button(this, { x: 900, y: 40, width: 160, height: 40, label: 'SAVE / LOAD', onClick: () => this.scene.start('SaveLoadScene') });
    if (this.hasSave) {
      new Button(this, { x: 512, y: 100, width: 300, height: 48, label: 'CONTINUE CAREER', onClick: () => this.continueCareer() });
      new Button(this, { x: 512, y: 160, width: 300, height: 48, label: 'NEW CAREER', onClick: () => this.showSelection() });
      this.selectionUI = this.createSelectionUI(true);
     } else {
      this.selectionUI = this.createSelectionUI(false);
     }
    this.selectionUI.setY(200);
    // Start button is scene-level (Button adds itself to scene), so position it in world coords below the selection UI container.
    this.startButton = new Button(this, { x: 512, y: 1000, width: 280, height: 44, label: 'START SEASON', onClick: () => this.start() });
    this.startButton.setEnabled(false);

     // Team name panel (left side, clear of centered career buttons).
    this.add.text(24, 92, 'TEAM', { fontFamily: THEME.fontFamily, fontSize: '14px', color: THEME.muted }).setOrigin(0, 0.5);
    const box = this.add.rectangle(180, 92, 200, 34, 0x0f3460).setStrokeStyle(2, 0x16213e);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => { this.editingTeam = true; this.renderTeam(); });
    this.teamText = this.add.text(90, 92, this.team, { fontFamily: THEME.fontFamily, fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
   }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    g.fillRect(0, 0, 1024, 1100);
  }

  private createSelectionUI(hidden: boolean): Phaser.GameObjects.Container {
    const group = this.add.container(0, 140);

    this.drawSectionBar(group, 80, 0, 'SELECT PILOT');
    PILOT_ROSTER.forEach((p, i) => {
      const card = new Card(this, {
        x: 120 + (i % 4) * 210, y: 40 + Math.floor(i / 4) * 105, width: 200, height: 90,
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

    this.drawSectionBar(group, 80, 560, 'SELECT BIKE');
    BRAND_ROSTER.forEach((b, i) => {
      const card = new Card(this, {
        x: 160 + i * 235, y: 650, width: 220, height: 100,
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

    if (hidden) group.setVisible(false);
    return group;
   }

  private drawSectionBar(group: Phaser.GameObjects.Container, x: number, y: number, label: string): void {
    const g = this.add.graphics();
    g.fillStyle(THEME.header.bgNum, 1);
    g.fillRoundedRect(x, y, 864, 28, 6);
    const text = this.add.text(x + 12, y + 14, label, { fontFamily: THEME.fontFamily, fontSize: '15px', color: THEME.gold, fontStyle: 'bold' }).setOrigin(0, 0.5);
    group.add(g);
    group.add(text);
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
    this.teamText.setColor(this.editingTeam ? THEME.gold : '#ffffff');
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
