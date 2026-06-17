import Phaser from 'phaser';
import { gameConfig } from './config';
import { SoundEngine } from './core/SoundEngine';

const game = new Phaser.Game(gameConfig);
const soundEngine = new SoundEngine();

// Dev-only: expose the game so a headless probe / devtools can inspect scenes.
if (import.meta.env.DEV) {
   (window as unknown as { __game: Phaser.Game; __soundEngine: SoundEngine }).__game = game;
   (window as unknown as { __soundEngine: SoundEngine }).__soundEngine = soundEngine;
}

// A Phaser.Game is constructed once and is not HMR-friendly: hot-swapping modules
// leaves a stale game running old config. Force a full reload on any hot update so
// the running game always matches the source.
if (import.meta.hot) {
  import.meta.hot.accept(() => location.reload());
}
