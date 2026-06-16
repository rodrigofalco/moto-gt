import Phaser from 'phaser';
import type { Rider } from '../core/types';

export function renderStandings(
  scene: Phaser.Scene, x: number, y: number, riders: Rider[],
  opts: { showGap?: boolean } = {},
): Phaser.GameObjects.Text {
  const leaderPoints = riders[0]?.points ?? 0;
  const lines = riders.map((r, i) => {
    const tag = r.isPlayer ? '> ' : '  ';
    const base = `${tag}${String(i + 1).padStart(2)}. ${r.name.padEnd(18)} ${String(r.points).padStart(3)}`;
    if (!opts.showGap) return base;
    const gap = i === 0 ? '' : `+${leaderPoints - r.points}`;
    return `${base}  ${gap.padStart(4)}`;
  });
  return scene.add.text(x, y, lines.join('\n'), {
    fontFamily: 'monospace', fontSize: '16px', color: '#e0e0e0',
  });
}
