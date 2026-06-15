import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { createSeason } from '../core/factories/SeasonFactory';
import { validatePointBuy } from '../core/factories/RiderFactory';
import { RNG } from '../core/RNG';
import { PLAYER_STAT_BUDGET, STAT_MIN, STAT_MAX } from '../core/constants';
import type { RiderStats } from '../core/types';

export class MainMenuScene extends Phaser.Scene {
  private stats: RiderStats = { pace: 6, cornering: 6, consistency: 6 };
  private riderName = 'Player';
  private teamName = 'My Team';
  private remainingText!: Phaser.GameObjects.Text;
  private statTexts: Record<keyof RiderStats, Phaser.GameObjects.Text> = {} as never;
  private startButton!: Button;

  constructor() { super('MainMenuScene'); }

  create(): void {
    this.add.text(512, 80, 'MotoGT', { fontSize: '72px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(512, 140, 'Motorcycle Racing Manager', { fontSize: '22px', color: '#e0e0e0' }).setOrigin(0.5);

    this.createTextInput(512, 210, 'Rider', this.riderName, (v) => { this.riderName = v; this.refresh(); });
    this.createTextInput(512, 270, 'Team', this.teamName, (v) => { this.teamName = v; this.refresh(); });

    this.add.text(512, 330, 'Distribute 18 points', { fontSize: '20px', color: '#e0e0e0' }).setOrigin(0.5);
    let y = 380;
    (['pace', 'cornering', 'consistency'] as (keyof RiderStats)[]).forEach((key) => {
      this.createStepper(key, y);
      y += 60;
    });

    this.remainingText = this.add.text(512, 560, '', { fontSize: '20px', color: '#f5c518' }).setOrigin(0.5);
    this.startButton = new Button(this, {
      x: 512, y: 640, width: 320, height: 56, label: 'START SEASON',
      onClick: () => this.start(),
    });
    this.refresh();
  }

  private createTextInput(x: number, y: number, label: string, initial: string, onChange: (v: string) => void): void {
    this.add.text(x - 220, y, `${label}:`, { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const el = this.add.dom(x + 40, y, 'input', 'width:220px;height:28px;font-size:16px;') as Phaser.GameObjects.DOMElement;
    const input = el.node as HTMLInputElement;
    input.value = initial;
    input.maxLength = 20;
    input.addEventListener('input', () => onChange(input.value.trim()));
  }

  private createStepper(key: keyof RiderStats, y: number): void {
    this.add.text(280, y, key, { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const minus = this.add.text(520, y, '[-]', { fontSize: '22px', color: '#e94560' }).setOrigin(0.5).setInteractive();
    this.statTexts[key] = this.add.text(580, y, '', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const plus = this.add.text(640, y, '[+]', { fontSize: '22px', color: '#00c853' }).setOrigin(0.5).setInteractive();
    minus.on('pointerdown', () => this.adjust(key, -1));
    plus.on('pointerdown', () => this.adjust(key, +1));
  }

  private adjust(key: keyof RiderStats, delta: number): void {
    const next = this.stats[key] + delta;
    const total = this.stats.pace + this.stats.cornering + this.stats.consistency;
    if (next < STAT_MIN || next > STAT_MAX) return;
    if (delta > 0 && total >= PLAYER_STAT_BUDGET) return;
    this.stats[key] = next;
    this.refresh();
  }

  private refresh(): void {
    const total = this.stats.pace + this.stats.cornering + this.stats.consistency;
    (['pace', 'cornering', 'consistency'] as (keyof RiderStats)[]).forEach((k) => {
      this.statTexts[k]?.setText(String(this.stats[k]));
    });
    this.remainingText.setText(`Points remaining: ${PLAYER_STAT_BUDGET - total}`);
    const valid = validatePointBuy(this.stats) && this.riderName.length > 0 && this.teamName.length > 0;
    this.startButton.setEnabled(valid);
  }

  private start(): void {
    const season = createSeason(this.riderName, this.teamName, this.stats, new RNG(Date.now() >>> 0));
    this.scene.start('SeasonScene', { season });
  }
}
