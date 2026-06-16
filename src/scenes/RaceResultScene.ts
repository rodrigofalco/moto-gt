import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { getStandings, getChampion } from '../core/Championship';
import type { SeasonState, RaceResult } from '../core/types';
import type { ProgressionSummary } from '../core/Progression';

const SETUP_SHORT: Record<string, string> = { topSpeed: 'TS', handling: 'HN', acceleration: 'AC' };
const RISK_SHORT: Record<string, string> = { low: 'L', medium: 'M', high: 'H' };

export class RaceResultScene extends Phaser.Scene {
  private season!: SeasonState;
  private result!: RaceResult;
  private playerSummary!: ProgressionSummary;

  constructor() { super('RaceResultScene'); }
  init(data: { season: SeasonState; result: RaceResult; playerSummary: ProgressionSummary }): void {
    this.season = data.season; this.result = data.result; this.playerSummary = data.playerSummary;
  }

  create(): void {
    if (this.season.isSeasonComplete) { this.renderSeasonEnd(); return; }

    this.add.text(40, 24, `Results — ${this.result.track.name}`, { fontSize: '24px', color: '#f5c518' });
    const lines = this.result.finishingOrder.map((e) => {
      const tag = e.rider.isPlayer ? '>' : ' ';
      const crash = e.crashed ? ' !' : '  ';
      return `${tag}${String(e.position).padStart(2)}. ${e.rider.name.padEnd(16)} ${SETUP_SHORT[e.setup]}/${RISK_SHORT[e.risk]} ${String(e.pointsAwarded).padStart(3)}${crash}`;
    });
    this.add.text(40, 80, lines.join('\n'), { fontFamily: 'monospace', fontSize: '15px', color: '#e0e0e0' });

    const levels = this.playerSummary.pilotLevels;
    const msg = levels.length ? `Pilot improved: ${levels.map((l) => `+1 ${l}`).join(', ')}.   ` : '';
    this.add.text(40, 360, `${msg}Earned ${this.playerSummary.rndEarned} development points.`, { fontSize: '16px', color: '#00c853' });

    this.add.text(620, 60, 'Standings', { fontSize: '20px', color: '#f5c518' });
    this.renderStandingsWithArrows(620, 90);

    new Button(this, { x: 512, y: 700, width: 280, height: 56, label: 'NEXT RACE', onClick: () => this.scene.start('SeasonScene', { season: this.season }) });
  }

  // Championship standings with ▲/▼/— vs the order before this race.
  private renderStandingsWithArrows(x: number, y: number): void {
    const standings = getStandings(this.season);
    const thisRacePts = new Map(this.result.finishingOrder.map((e) => [e.rider.id, e.pointsAwarded]));
    const hasPrev = this.season.raceResults.length >= 2;
    const prev = [...standings].sort((a, b) =>
      (b.points - (thisRacePts.get(b.id) ?? 0)) - (a.points - (thisRacePts.get(a.id) ?? 0)));
    const prevPos = new Map(prev.map((r, i) => [r.id, i + 1]));
    const lines = standings.map((r, i) => {
      const cur = i + 1;
      const was = prevPos.get(r.id) ?? cur;
      const arrow = !hasPrev ? ' ' : cur < was ? '▲' : cur > was ? '▼' : '—';
      const tag = r.isPlayer ? '>' : ' ';
      return `${tag}${String(cur).padStart(2)} ${arrow} ${r.name.slice(0, 16).padEnd(16)} ${String(r.points).padStart(3)}`;
    });
    this.add.text(x, y, lines.join('\n'), { fontFamily: 'monospace', fontSize: '15px', color: '#e0e0e0' });
  }

  private renderSeasonEnd(): void {
    const standings = getStandings(this.season);
    const champ = getChampion(this.season);
    this.add.text(512, 70, 'SEASON COMPLETE', { fontSize: '40px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(512, 130, `Champion: ${champ.name} (${champ.team}) — ${champ.points} pts`, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const pos = standings.findIndex((r) => r.isPlayer) + 1;
    const p = this.season.playerRider;
    this.add.text(512, 175, `You finished P${pos} — ${p.points} pts | Wins ${p.positionCounts[0]} | Podiums ${p.positionCounts[0] + p.positionCounts[1] + p.positionCounts[2]}`, { fontSize: '17px', color: '#e0e0e0' }).setOrigin(0.5);
    renderStandings(this, 380, 230, standings);
    new Button(this, { x: 512, y: 700, width: 280, height: 56, label: 'PLAY AGAIN', onClick: () => this.scene.start('MainMenuScene') });
  }
}
