import Phaser from 'phaser';
import { THEME } from './theme';

export interface StatRow { label: string; value: number; }

export interface CardOptions {
  x: number; y: number; width: number; height: number;
  title: string; subtitle?: string; stats: StatRow[];
  onClick?: () => void;
}

export class Card extends Phaser.GameObjects.Container {
  private box: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Graphics;
  private selected = false;
  private readonly cardWidth: number;
  private readonly cardHeight: number;

  constructor(scene: Phaser.Scene, opts: CardOptions) {
    super(scene, opts.x, opts.y);
    this.cardWidth = opts.width;
    this.cardHeight = opts.height;

    this.shadow = scene.add.graphics();
    this.drawShadow();
    this.add(this.shadow);

    this.box = scene.add.graphics();
    this.drawBox(false, false);
    this.add([this.box]);

    const titleText = scene.add.text(-opts.width / 2 + 12, -opts.height / 2 + 10, opts.title, { fontFamily: THEME.fontFamily, fontSize: '18px', color: '#ffffff' });
    this.add(titleText);
    if (opts.subtitle) {
      this.add(scene.add.text(-opts.width / 2 + 12, -opts.height / 2 + 32, opts.subtitle, {
        fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.muted,
      }));
    }
    // Stat rows: start below the title/subtitle and space so all rows fit inside the card.
    const hasSub = !!opts.subtitle;
    const statStart = -opts.height / 2 + (hasSub ? 54 : 46);
    const statGap = 20;
    opts.stats.forEach((s, i) => {
      const ry = statStart + i * statGap;
      this.add(scene.add.text(-opts.width / 2 + 12, ry, s.label, {
        fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.text,
      }).setOrigin(0, 0.5));
      this.add(scene.add.text(opts.width / 2 - 14, ry, String(s.value), {
        fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.gold,
      }).setOrigin(1, 0.5));
    });

    this.setSize(opts.width, opts.height);
    if (opts.onClick) {
      this.setInteractive({ useHandCursor: true });
      this.on('pointerover', () => { if (!this.selected) { this.drawBox(true, false); this.tweenLift(-2); } });
      this.on('pointerout', () => { this.setSelected(this.selected); this.tweenLift(0); });
      this.on('pointerup', opts.onClick);
    }
    scene.add.existing(this);
  }

  private drawShadow(): void {
    this.shadow.clear();
    this.shadow.fillStyle(THEME.shadow.color, THEME.shadow.alpha * 0.6);
    this.shadow.fillRoundedRect(-this.cardWidth / 2 + 2, -this.cardHeight / 2 + 3, this.cardWidth, this.cardHeight, 8);
  }

  private drawBox(hover: boolean, selected: boolean): void {
    this.box.clear();
    const fill = selected ? THEME.panelStyle.borderNum : THEME.panelStyle.bgNum;
    const stroke = selected ? THEME.goldNum : hover ? THEME.redNum : THEME.borderNum;
    const width = selected ? 4 : 2;
    this.box.fillStyle(fill, 1);
    this.box.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 8);
    this.box.lineStyle(width, stroke, 1);
    this.box.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 8);
    // Top highlight.
    this.box.lineStyle(1, 0xffffff, 0.12);
    this.box.lineBetween(-this.cardWidth / 2 + 6, -this.cardHeight / 2 + 1, this.cardWidth / 2 - 6, -this.cardHeight / 2 + 1);
  }

  private tweenLift(offset: number): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, y: this.y + offset, duration: 120, ease: 'Quad.easeOut' });
  }

  setSelected(value: boolean): this {
    this.selected = value;
    this.drawBox(false, value);
    return this;
  }
}
