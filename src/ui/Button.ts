import Phaser from 'phaser';

export interface ButtonOptions {
  x: number; y: number; width: number; height: number; label: string;
  onClick: () => void;
}

const COLOR = {
  normal: 0xe94560,
  hover: 0xff5f7a,
  press: 0xc4324c,
  disabled: 0x555555,
} as const;

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private enabled = true;
  private readonly handler: () => void;

  constructor(scene: Phaser.Scene, opts: ButtonOptions) {
    super(scene, opts.x, opts.y);
    this.handler = opts.onClick;
    this.bg = scene.add.rectangle(0, 0, opts.width, opts.height, COLOR.normal).setStrokeStyle(2, 0xffffff);
    const text = scene.add.text(0, 0, opts.label, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    this.add([this.bg, text]);
    this.setSize(opts.width, opts.height);
    // Phaser 4 hit-tests a Container against (localPoint + displayOrigin), and this
    // container's origin is 0.5 (displayOrigin = w/2,h/2). So the hit-area rectangle
    // must be top-left anchored (0,0,w,h), NOT centered, to cover the whole button.
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, opts.width, opts.height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    this.on('pointerover', () => { if (this.enabled) this.bg.setFillStyle(COLOR.hover); });
    this.on('pointerout', () => this.bg.setFillStyle(this.enabled ? COLOR.normal : COLOR.disabled));
    this.on('pointerdown', () => { if (this.enabled) this.bg.setFillStyle(COLOR.press); });
    this.on('pointerup', () => {
      if (!this.enabled) return;
      this.bg.setFillStyle(COLOR.hover);
      this.handler();
    });

    scene.add.existing(this);
  }

  setEnabled(value: boolean): this {
    this.enabled = value;
    this.bg.setFillStyle(value ? COLOR.normal : COLOR.disabled);
    this.input!.cursor = value ? 'pointer' : 'default';
    return this;
  }
}
