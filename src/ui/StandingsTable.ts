import Phaser from 'phaser';
import type { Rider } from '../core/types';

export function renderStandings(
  scene: Phaser.Scene, x: number, y: number, riders: Rider[],
): Phaser.GameObjects.Text {
  const lines = riders.map((r, i) => {
    const tag = r.isPlayer ? '> ' : '  ';
    return `${tag}${String(i + 1).padStart(2)}. ${r.name.padEnd(18)} ${String(r.points).padStart(3)}`;
  });
  return scene.add.text(x, y, lines.join('\n'), {
    fontFamily: 'monospace', fontSize: '16px', color: '#e0e0e0',
  });
}
