import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { THEME } from '../ui/theme';
import { getStandings, getChampion } from '../core/Championship';
import { resultHeadline } from '../core/Advice';
import { BRAND_COLORS } from '../core/constants';
import { SoundEngine } from '../core/SoundEngine';
import { runOffSeason } from '../core/OffSeason';
import { RNG } from '../core/RNG';
import type { SeasonState, RaceResult, Rider, CareerState } from '../core/types';
import type { ProgressionSummary } from '../core/Progression';

const SETUP_SHORT: Record<string, string> = { topSpeed: 'TS', handling: 'HN', acceleration: 'AC' };
const RISK_SHORT: Record<string, string> = { low: 'L', medium: 'M', high: 'H' };
const MEDAL_COLOR = [0xffd700, 0xc0c8d0, 0xcd7f32];

export class RaceResultScene extends Phaser.Scene {
  private season!: SeasonState;
  private result!: RaceResult;
  private playerSummary!: ProgressionSummary;
  private career: CareerState | null = null;

  constructor() { super('RaceResultScene'); }
  init(data: { season: SeasonState; result: RaceResult; playerSummary: ProgressionSummary; career?: CareerState }): void {
    this.season = data.season; this.result = data.result; this.playerSummary = data.playerSummary;
    this.career = data.career ?? null;
    }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    g.fillRect(0, 0, 1024, 1100);
  }

  create(): void {
    this.drawBackground();
    const sound = (this.game as unknown as { __soundEngine: SoundEngine }).__soundEngine;
    if (this.season.isSeasonComplete) { this.renderSeasonEnd(sound); return; }

    this.add.text(40, 24, `Results — ${this.result.track.name}`, { fontFamily: THEME.fontFamily, fontSize: '24px', color: THEME.gold, fontStyle: 'bold' });
    const pe = this.result.finishingOrder.find((e) => e.rider.isPlayer)!;
    sound.playCheckeredFlag();
    const champPos = getStandings(this.season).findIndex((r) => r.isPlayer) + 1;
    const racesLeft = this.season.calendar.length - this.season.currentRaceIndex;
    this.add.text(40, 54, resultHeadline(pe.position, pe.crashed, champPos, racesLeft), { fontFamily: THEME.fontFamily, fontSize: '18px', color: THEME.cyan });

    this.drawPanel(32, 84, 620, 260);
    this.result.finishingOrder.forEach((e, i) => {
      const y = 104 + i * 24;
      const isPlayer = e.rider.isPlayer;
      const bg = e.crashed ? 0x4a0e16 : i % 2 === 0 ? 0x1e2a45 : 0x16213e;
      const g = this.add.graphics();
      g.fillStyle(bg, e.crashed ? 0.5 : 0.8);
      g.fillRect(36, y - 2, 612, 22);
      if (i < 3) {
        g.fillStyle(MEDAL_COLOR[i], 1);
        g.fillCircle(54, y + 9, 8);
      }
      const tag = isPlayer ? '>' : ' ';
      const crash = e.crashed ? ' DNF' : '    ';
      const line = `${tag}${String(e.position).padStart(2)}. ${e.rider.name.padEnd(16)} ${SETUP_SHORT[e.setup]}/${RISK_SHORT[e.risk]} ${String(e.pointsAwarded).padStart(3)}${crash}`;
      this.add.text(70, y, line, { fontFamily: 'monospace', fontSize: '14px', color: isPlayer ? THEME.gold : THEME.text, fontStyle: isPlayer ? 'bold' : 'normal' });
    });

    const levels = this.playerSummary.pilotLevels;
    const msg = levels.length ? `Pilot improved: ${levels.map((l) => `+1 ${l}`).join(', ')}.   ` : '';
    this.add.text(40, 360, `${msg}Earned ${this.playerSummary.rndEarned} development points.`, { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.green });

    this.drawPanel(672, 24, 320, 380);
    this.add.text(688, 40, 'Standings', { fontFamily: THEME.fontFamily, fontSize: '18px', color: THEME.gold, fontStyle: 'bold' });
    this.renderStandingsWithArrows(688, 68);

    new Button(this, { x: 512, y: 680, width: 280, height: 56, label: 'NEXT RACE', onClick: () => {
      if (this.career) this.scene.start('SeasonScene', { season: this.season, career: this.career });
      else this.scene.start('SeasonScene', { season: this.season });
     } });
  }

  private drawPanel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(THEME.panelStyle.bgNum, 0.85);
    g.fillRoundedRect(x, y, w, h, THEME.panelStyle.radius);
    g.lineStyle(2, THEME.panelStyle.borderNum, 1);
    g.strokeRoundedRect(x, y, w, h, THEME.panelStyle.radius);
    return g;
  }

  // Championship standings with ▲/▼/— vs the order before this race.
  private renderStandingsWithArrows(x: number, y: number): void {
    const standings = getStandings(this.season);
    const leaderPoints = standings[0]?.points ?? 0;
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
      const gap = i === 0 ? '' : `+${leaderPoints - r.points}`;
      return `${tag}${String(cur).padStart(2)} ${arrow} ${r.name.slice(0, 16).padEnd(16)} ${String(r.points).padStart(3)}  ${gap.padStart(4)}`;
    });
    this.add.text(x, y, lines.join('\n'), { fontFamily: 'monospace', fontSize: '14px', color: '#e0e0e0' });
  }

  private renderSeasonEnd(sound: SoundEngine): void {
    const standings = getStandings(this.season);
    const champ = getChampion(this.season);
    const pos = standings.findIndex((r) => r.isPlayer) + 1;
    const p = this.season.playerRider;
    const dnfs = this.season.raceResults.filter((r) => r.finishingOrder.find((e) => e.rider.isPlayer)?.crashed).length;

    // Dramatic title banner.
    const banner = this.add.graphics();
    banner.fillGradientStyle(0x0f3460, 0x0f3460, 0x1a1a2e, 0x1a1a2e, 1);
    banner.fillRoundedRect(212, 24, 600, 72, 12);
    banner.lineStyle(3, THEME.goldNum, 0.6);
    banner.strokeRoundedRect(212, 24, 600, 72, 12);
    const title = this.add.text(512, 60, 'SEASON COMPLETE', { fontFamily: THEME.fontFamily, fontSize: '42px', color: THEME.gold, fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: title, scaleX: 1.05, scaleY: 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(512, 112, `Champion: ${champ.name} — ${champ.points} pts`, { fontFamily: THEME.fontFamily, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(512, 140, `You finished P${pos} — ${p.points} pts | Wins ${p.positionCounts[0]} | Podiums ${p.positionCounts[0] + p.positionCounts[1] + p.positionCounts[2]} | DNFs ${dnfs}`, { fontFamily: THEME.fontFamily, fontSize: '15px', color: '#e0e0e0' }).setOrigin(0.5);
    if (pos <= 3) sound.playPodium();

    this.drawPodium(standings);

    this.drawPanel(360, 378, 304, 280);
    this.add.text(512, 396, 'Final Standings', { fontFamily: THEME.fontFamily, fontSize: '18px', color: THEME.gold, fontStyle: 'bold' }).setOrigin(0.5);
    renderStandings(this, 380, 420, standings, { showGap: true });
    new Button(this, { x: 512, y: 712, width: 280, height: 52, label: 'GO TO OFF-SEASON', onClick: () => {
      if (this.career) {
        const rng = new RNG((Date.now() ^ this.season.currentRaceIndex * 2654435761) >>> 0);
        const report = runOffSeason(this.career, rng);
        this.scene.start('OffSeasonScene', { career: this.career, report: report as never } as never);
        } else {
        this.scene.start('MainMenuScene');
        }
      } });
  }

  // Top-3 podium: 1st tallest (centre), 2nd left, 3rd right; medal-colored blocks with
  // each rider's name + brand-colored marker above.
  private drawPodium(standings: Rider[]): void {
    const blocks = [
      { rider: standings[1], x: 392, h: 78, color: 0xc0c8d0, place: 2 },
      { rider: standings[0], x: 512, h: 112, color: 0xf5c518, place: 1 },
      { rider: standings[2], x: 632, h: 54, color: 0xcd7f32, place: 3 },
    ];
    const baseY = 344, w = 110;
    for (const b of blocks) {
      if (!b.rider) continue;
      const top = baseY - b.h;
      const block = this.add.rectangle(b.x, baseY - b.h / 2, w, b.h, b.color).setStrokeStyle(2, 0x1a1a2e);
      this.add.text(b.x, baseY - b.h / 2, String(b.place), { fontFamily: THEME.fontFamily, fontSize: '26px', color: '#0b0b14', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.circle(b.x - 52, top - 30, 6, BRAND_COLORS[b.rider.brandId] ?? 0x4fc3f7);
      const you = b.rider.isPlayer ? ' (YOU)' : '';
      this.add.text(b.x, top - 30, `${b.rider.name}${you}`, { fontFamily: THEME.fontFamily, fontSize: '13px', color: b.rider.isPlayer ? '#f5c518' : '#e0e0e0' }).setOrigin(0.5);
      this.add.text(b.x, top - 14, `${b.rider.points} pts`, { fontFamily: THEME.fontFamily, fontSize: '12px', color: '#94a3b8' }).setOrigin(0.5);
      this.tweens.add({ targets: block, scaleY: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
}
