import Phaser from 'phaser';

export interface StatRow { label: string; value: number; }

export interface CardOptions {
  x: number; y: number; width: number; height: number;
  title: string; subtitle?: string; stats: StatRow[];
  onClick?: () => void;
}

export class Card extends Phaser.GameObjects.Container {
  private box: Phaser.GameObjects.Rectangle;
  private selected = false;

  constructor(scene: Phaser.Scene, opts: CardOptions) {
    super(scene, opts.x, opts.y);
    this.box = scene.add.rectangle(0, 0, opts.width, opts.height, 0x16213e).setStrokeStyle(2, 0x0f3460);
    this.add(this.box);
    this.add(scene.add.text(-opts.width / 2 + 12, -opts.height / 2 + 10, opts.title, { fontSize: '18px', color: '#ffffff' }));
    if (opts.subtitle) {
      this.add(scene.add.text(-opts.width / 2 + 12, -opts.height / 2 + 34, opts.subtitle, { fontSize: '13px', color: '#94a3b8' }));
    }
    opts.stats.forEach((s, i) => {
      const ry = -opts.height / 2 + 60 + i * 22;
      this.add(scene.add.text(-opts.width / 2 + 12, ry, s.label, { fontSize: '13px', color: '#e0e0e0' }));
      this.add(scene.add.text(opts.width / 2 - 28, ry, String(s.value), { fontSize: '13px', color: '#f5c518' }));
    });
    this.setSize(opts.width, opts.height);
    if (opts.onClick) {
      this.box.setInteractive({ useHandCursor: true });
      this.box.on('pointerover', () => { if (!this.selected) this.box.setStrokeStyle(2, 0xe94560); });
      this.box.on('pointerout', () => this.setSelected(this.selected));
      this.box.on('pointerup', opts.onClick);
    }
    scene.add.existing(this);
  }

  setSelected(value: boolean): this {
    this.selected = value;
    this.box.setStrokeStyle(value ? 3 : 2, value ? 0xf5c518 : 0x0f3460);
    this.box.setFillStyle(value ? 0x0f3460 : 0x16213e);
    return this;
  }
}
