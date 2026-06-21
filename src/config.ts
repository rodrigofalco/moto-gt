import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SeasonScene } from './scenes/SeasonScene';
import { RaceScene } from './scenes/RaceScene';
import { RaceResultScene } from './scenes/RaceResultScene';
import { OffSeasonScene } from './scenes/OffSeasonScene';
import { SaveLoadScene } from './scenes/SaveLoadScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 1100,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MainMenuScene, SeasonScene, RaceScene, RaceResultScene, OffSeasonScene, SaveLoadScene],
};
