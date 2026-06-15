import Phaser from 'phaser';

export interface ButtonOptions {
  x: number; y: number; width: number; height: number; label: string;
  onClick: () => void;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private enabled = true;

  constructor(scene: Phaser.Scene, opts: ButtonOptions) {
    super(scene, opts.x, opts.y);
    this.bg = scene.add.rectangle(0, 0, opts.width, opts.height, 0xe94560).setStrokeStyle(2, 0xffffff);
    const text = scene.add.text(0, 0, opts.label, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    this.add([this.bg, text]);
    this.setSize(opts.width, opts.height);
    this.setInteractive(new Phaser.Geom.Rectangle(-opts.width / 2, -opts.height / 2, opts.width, opts.height), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => { if (this.enabled) opts.onClick(); });
    scene.add.existing(this);
  }

  setEnabled(value: boolean): this {
    this.enabled = value;
    this.bg.setFillStyle(value ? 0xe94560 : 0x555555);
    return this;
  }
}
