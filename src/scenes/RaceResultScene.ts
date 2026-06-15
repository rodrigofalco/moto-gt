import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { getStandings, getChampion } from '../core/Championship';
import type { SeasonState, RaceResult } from '../core/types';

export class RaceResultScene extends Phaser.Scene {
  private season!: SeasonState;
  private result!: RaceResult;

  constructor() { super('RaceResultScene'); }

  init(data: { season: SeasonState; result: RaceResult }): void {
    this.season = data.season;
    this.result = data.result;
  }

  create(): void {
    if (this.season.isSeasonComplete) { this.renderSeasonEnd(); return; }
    this.renderRaceResult();
  }

  private renderRaceResult(): void {
    this.add.text(40, 30, `Results — ${this.result.track.name}`, { fontSize: '26px', color: '#f5c518' });

    const lines = this.result.finishingOrder.map((fp) => {
      const tag = fp.rider.isPlayer ? '> ' : '  ';
      const mark = fp.hadMistake ? ' !' : '  ';
      return `${tag}${String(fp.position).padStart(2)}. ${fp.rider.name.padEnd(18)} ${String(fp.pointsAwarded).padStart(3)}${mark}`;
    });
    this.add.text(40, 90, lines.join('\n'), { fontFamily: 'monospace', fontSize: '16px', color: '#e0e0e0' });

    this.add.text(560, 60, 'Standings', { fontSize: '20px', color: '#f5c518' });
    renderStandings(this, 560, 90, getStandings(this.season));

    const playerFp = this.result.finishingOrder.find((f) => f.rider.isPlayer)!;
    this.add.text(40, 420, this.message(playerFp.position, playerFp.hadMistake, playerFp.pointsAwarded), { fontSize: '18px', color: '#00c853' });

    new Button(this, { x: 512, y: 700, width: 280, height: 56, label: 'NEXT RACE', onClick: () => this.scene.start('SeasonScene', { season: this.season }) });
  }

  private renderSeasonEnd(): void {
    const standings = getStandings(this.season);
    const champion = getChampion(this.season);
    this.add.text(512, 80, 'SEASON COMPLETE', { fontSize: '40px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(512, 150, `Champion: ${champion.name} (${champion.team}) — ${champion.points} pts`, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);

    const playerPos = standings.findIndex((r) => r.isPlayer) + 1;
    const player = this.season.playerRider;
    const wins = player.positionCounts[0];
    const podiums = player.positionCounts[0] + player.positionCounts[1] + player.positionCounts[2];
    this.add.text(512, 210, `You finished P${playerPos} with ${player.points} pts | Wins ${wins} | Podiums ${podiums}`, { fontSize: '18px', color: '#e0e0e0' }).setOrigin(0.5);

    renderStandings(this, 360, 270, standings);

    new Button(this, { x: 512, y: 700, width: 280, height: 56, label: 'PLAY AGAIN', onClick: () => this.scene.start('MainMenuScene') });
  }

  private message(position: number, hadMistake: boolean, points: number): string {
    if (hadMistake && position > 5) return 'A mistake cost you today.';
    if (position === 1) return `Victory! +${points} pts.`;
    if (position <= 3) return `Podium! +${points} pts.`;
    if (position <= 6) return `Solid result. +${points} pts.`;
    return `Tough race. +${points} pts.`;
  }
}
