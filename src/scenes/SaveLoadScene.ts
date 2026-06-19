import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { SaveSystem } from '../core/SaveSystem';
import { getStandings } from '../core/Championship';

export class SaveLoadScene extends Phaser.Scene {
  constructor() { super('SaveLoadScene'); }

  create(): void {
    const save = SaveSystem.Instance;
    const has = save.hasSave();
    const ts = save.getSaveTimestamp();
    const dateStr = ts ? new Date(ts).toLocaleDateString() : '';

    this.add.text(512, 40, 'SAVE / LOAD', { fontSize: '40px', color: '#f5c518' }).setOrigin(0.5);

    if (has) {
      const season = save.loadSeason();
      const standings = season ? getStandings(season) : [];
      const playerPos = standings.findIndex((r) => r.isPlayer) + 1;
      const racesLeft = season ? season.calendar.length - season.currentRaceIndex : 0;
      const info = season
        ? `Race ${season.currentRaceIndex + 1} of ${season.calendar.length}  |  ${racesLeft} races left  |  ${season.playerRider.name} — P${playerPos}  |  Saved: ${dateStr}`
        : 'Save data corrupted';

      this.add.text(512, 90, info, { fontSize: '15px', color: '#94a3b8' }).setOrigin(0.5);

      new Button(this, { x: 512, y: 180, width: 320, height: 50, label: 'CONTINUE SEASON', onClick: () => {
        const s = save.loadSeason();
        if (s) this.scene.start('SeasonScene', { season: s });
       }});
    }

    new Button(this, { x: 512, y: has ? 270 : 180, width: 320, height: 50, label: 'NEW SEASON', onClick: () => this.scene.start('MainMenuScene') });

    if (has) {
      new Button(this, { x: 512, y: has ? 350 : 270, width: 320, height: 44, label: 'DELETE SAVE', onClick: () => {
        save.deleteSave();
        this.scene.restart();
       }});
    }

    new Button(this, { x: 512, y: 500, width: 200, height: 40, label: 'BACK', onClick: () => this.scene.start('MainMenuScene') });
  }
}
