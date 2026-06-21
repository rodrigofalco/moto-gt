import Phaser from 'phaser';
import { THEME } from './theme';

export interface ButtonOptions {
  x: number; y: number; width: number; height: number; label: string;
  onClick: () => void;
}

export class Button extends Phaser.GameObjects.Container {
  private enabled = true;
  private readonly handler: () => void;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly btnWidth: number;
  private readonly btnHeight: number;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, opts: ButtonOptions) {
    super(scene, opts.x, opts.y);
    this.handler = opts.onClick;
    this.btnWidth = opts.width;
    this.btnHeight = opts.height;

    // Drop shadow.
    const shadow = scene.add.graphics();
    shadow.fillStyle(THEME.shadow.color, THEME.shadow.alpha);
    shadow.fillRoundedRect(-this.btnWidth / 2 + 2, -this.btnHeight / 2 + THEME.shadow.offsetY, this.btnWidth, this.btnHeight, 8);
    this.add(shadow);

    // Main rounded background.
    this.bg = scene.add.graphics();
    this.drawBg(THEME.button.normal);
    this.add(this.bg);

    // 1px top-edge highlight for depth.
    this.highlight = scene.add.graphics();
    this.highlight.lineStyle(1, 0xffffff, 0.25);
    this.highlight.lineBetween(-this.btnWidth / 2 + 6, -this.btnHeight / 2 + 1, this.btnWidth / 2 - 6, -this.btnHeight / 2 + 1);
    this.add(this.highlight);

    this.label = scene.add.text(0, 0, opts.label, {
      fontFamily: THEME.fontFamily,
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.add(this.label);

    this.setSize(opts.width, opts.height);
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-opts.width / 2, -opts.height / 2, opts.width, opts.height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    this.on('pointerover', () => { if (this.enabled) { this.drawBg(THEME.button.hover); this.tweenScale(1.04); } });
    this.on('pointerout', () => { this.drawBg(this.enabled ? THEME.button.normal : THEME.button.disabled); this.tweenScale(1); });
    this.on('pointerdown', () => { if (this.enabled) this.drawBg(THEME.button.press); });
    this.on('pointerup', () => {
      if (!this.enabled) return;
      this.drawBg(THEME.button.hover);
      this.handler();
    });

    scene.add.existing(this);
  }

  private drawBg(color: number): void {
    this.bg.clear();
    // Two-tone simulated gradient: lighter top, darker bottom.
    this.bg.fillStyle(color, 1);
    this.bg.fillRoundedRect(-this.btnWidth / 2, -this.btnHeight / 2, this.btnWidth, this.btnHeight, 8);
    this.bg.fillStyle(0xffffff, 0.08);
    this.bg.fillRoundedRect(-this.btnWidth / 2, -this.btnHeight / 2, this.btnWidth, this.btnHeight / 2, { tl: 8, tr: 8, bl: 0, br: 0 });
  }

  private tweenScale(scale: number): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, scaleX: scale, scaleY: scale, duration: 100, ease: 'Quad.easeOut' });
  }

  setEnabled(value: boolean): this {
    this.enabled = value;
    this.drawBg(value ? THEME.button.normal : THEME.button.disabled);
    this.label.setAlpha(value ? 1 : 0.6);
    this.input!.cursor = value ? 'pointer' : 'default';
    return this;
  }
}
