import Phaser from 'phaser';
import { gameConfig } from './config';

const game = new Phaser.Game(gameConfig);

// Dev-only: expose the game so a headless probe / devtools can inspect scenes.
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

// A Phaser.Game is constructed once and is not HMR-friendly: hot-swapping modules
// leaves a stale game running old config. Force a full reload on any hot update so
// the running game always matches the source.
if (import.meta.hot) {
  import.meta.hot.accept(() => location.reload());
}
