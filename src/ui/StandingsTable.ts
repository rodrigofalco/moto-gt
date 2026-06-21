import Phaser from 'phaser';
import { THEME } from './theme';
import type { Rider } from '../core/types';

const ROW_H = 22;
const COL_W = [44, 150, 54, 54];

export function renderStandings(
  scene: Phaser.Scene, x: number, y: number, riders: Rider[],
  opts: { showGap?: boolean } = {},
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const leaderPoints = riders[0]?.points ?? 0;

  const headerColor = THEME.header.bgNum;
  const g = scene.add.graphics();
  container.add(g);

  // Header background.
  const totalW = COL_W.reduce((a, b) => a + b, 0) + (opts.showGap ? COL_W[COL_W.length - 1] : 0);
  g.fillStyle(headerColor, 1);
  g.fillRoundedRect(0, 0, totalW, ROW_H, { tl: 6, tr: 6, bl: 0, br: 0 });

  const headers = ['Pos', 'Rider', 'Pts', ...(opts.showGap ? ['Gap'] : [])];
  let cx = 0;
  headers.forEach((h, i) => {
    container.add(scene.add.text(cx + 8, 2, h, {
      fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.gold, fontStyle: 'bold',
    }));
    cx += COL_W[i] ?? COL_W[COL_W.length - 1];
  });

  // Rows.
  riders.forEach((r, i) => {
    const ry = ROW_H + i * ROW_H;
    const isPlayer = r.isPlayer;
    const bg = isPlayer ? THEME.goldNum : i % 2 === 0 ? 0x1e2a45 : 0x16213e;
    const alpha = isPlayer ? 0.18 : 1;
    g.fillStyle(bg, alpha);
    g.fillRect(0, ry, totalW, ROW_H);

    let tcx = 0;
    const pos = `${isPlayer ? '>' : ' '}${String(i + 1).padStart(2)}`;
    container.add(scene.add.text(tcx + 8, ry + 3, pos, {
      fontFamily: THEME.fontFamily, fontSize: '13px', color: isPlayer ? THEME.gold : THEME.text,
      fontStyle: isPlayer ? 'bold' : 'normal',
    }));
    tcx += COL_W[0];

    container.add(scene.add.text(tcx + 8, ry + 3, r.name, {
      fontFamily: THEME.fontFamily, fontSize: '13px', color: isPlayer ? THEME.gold : THEME.text,
      fontStyle: isPlayer ? 'bold' : 'normal',
    }));
    tcx += COL_W[1];

    container.add(scene.add.text(tcx + 8, ry + 3, String(r.points), {
      fontFamily: 'monospace', fontSize: '13px', color: isPlayer ? THEME.gold : THEME.text,
      fontStyle: isPlayer ? 'bold' : 'normal',
    }));
    tcx += COL_W[2];

    if (opts.showGap) {
      const gap = i === 0 ? '' : `+${leaderPoints - r.points}`;
      container.add(scene.add.text(tcx + 8, ry + 3, gap, {
        fontFamily: 'monospace', fontSize: '13px', color: isPlayer ? THEME.gold : THEME.muted,
      }));
    }
  });

  // Column separators.
  g.lineStyle(1, THEME.borderNum, 0.5);
  let sx = 0;
  for (let i = 0; i < headers.length - 1; i++) {
    sx += COL_W[i] ?? COL_W[COL_W.length - 1];
    g.lineBetween(sx, ROW_H, sx, ROW_H + riders.length * ROW_H);
  }

  return container;
}
