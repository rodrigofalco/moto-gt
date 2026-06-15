import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { createSeason } from '../core/factories/SeasonFactory';
import { validatePointBuy } from '../core/factories/RiderFactory';
import { RNG } from '../core/RNG';
import { PLAYER_STAT_BUDGET, STAT_MIN, STAT_MAX } from '../core/constants';
import type { RiderStats } from '../core/types';

type FieldKey = 'rider' | 'team';
const MAX_NAME_LENGTH = 20;

export class MainMenuScene extends Phaser.Scene {
  private stats: RiderStats = { pace: 6, cornering: 6, consistency: 6 };
  private values: Record<FieldKey, string> = { rider: 'Player', team: 'My Team' };
  private fieldTexts: Record<FieldKey, Phaser.GameObjects.Text> = {} as never;
  private activeField: FieldKey = 'rider';
  private remainingText!: Phaser.GameObjects.Text;
  private statTexts: Record<keyof RiderStats, Phaser.GameObjects.Text> = {} as never;
  private startButton!: Button;

  constructor() { super('MainMenuScene'); }

  create(): void {
    this.add.text(512, 80, 'MotoGT', { fontSize: '72px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(512, 140, 'Motorcycle Racing Manager', { fontSize: '22px', color: '#e0e0e0' }).setOrigin(0.5);
    this.add.text(512, 178, 'Click a field and type. Tab switches fields.', { fontSize: '14px', color: '#94a3b8' }).setOrigin(0.5);

    this.createField(512, 215, 'rider', 'Rider');
    this.createField(512, 270, 'team', 'Team');

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

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));

    this.refresh();
    this.renderFields();
  }

  private createField(x: number, y: number, key: FieldKey, label: string): void {
    this.add.text(x - 220, y, `${label}:`, { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    // Clickable input box.
    const box = this.add.rectangle(x + 40, y, 240, 34, 0x0f3460).setStrokeStyle(2, 0x16213e);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => { this.activeField = key; this.renderFields(); });
    this.fieldTexts[key] = this.add.text(x - 70, y, '', { fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.activeField = this.activeField === 'rider' ? 'team' : 'rider';
      this.renderFields();
      return;
    }
    if (event.key === 'Backspace') {
      this.values[this.activeField] = this.values[this.activeField].slice(0, -1);
    } else if (event.key.length === 1 && /[A-Za-z0-9 \-_']/.test(event.key)) {
      if (this.values[this.activeField].length < MAX_NAME_LENGTH) {
        this.values[this.activeField] += event.key;
      }
    } else {
      return;
    }
    this.renderFields();
    this.refresh();
  }

  private renderFields(): void {
    (['rider', 'team'] as FieldKey[]).forEach((key) => {
      const caret = key === this.activeField ? '|' : '';
      this.fieldTexts[key].setText(this.values[key] + caret);
      this.fieldTexts[key].setColor(key === this.activeField ? '#f5c518' : '#ffffff');
    });
  }

  private createStepper(key: keyof RiderStats, y: number): void {
    this.add.text(280, y, key, { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const minus = this.add.text(520, y, '[-]', { fontSize: '22px', color: '#e94560' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.statTexts[key] = this.add.text(580, y, '', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const plus = this.add.text(640, y, '[+]', { fontSize: '22px', color: '#00c853' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
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
    const valid = validatePointBuy(this.stats)
      && this.values.rider.trim().length > 0
      && this.values.team.trim().length > 0;
    this.startButton.setEnabled(valid);
  }

  private start(): void {
    const season = createSeason(
      this.values.rider.trim(), this.values.team.trim(), this.stats, new RNG(Date.now() >>> 0),
    );
    this.scene.start('SeasonScene', { season });
  }
}
