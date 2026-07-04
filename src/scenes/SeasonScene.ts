import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { renderStandings } from '../ui/StandingsTable';
import { THEME } from '../ui/theme';
import { createRace } from '../core/RaceEngine';
import { runQualifying } from '../core/Qualifying';
import { getStandings } from '../core/Championship';
import { investBikePoint } from '../core/Progression';
import { bikeUpgradeCost, RND_POINT_COST } from '../core/Economy';
import { RNG } from '../core/RNG';
import { SETUPS } from '../core/constants';
import { recommendedSetup } from '../core/Advice';
import { SoundEngine } from '../core/SoundEngine';
import { formatMoney } from '../core/format';
import type { SeasonState, Setup, BikeParams, CareerState, TireCompound } from '../core/types';

const SETUP_LABEL: Record<Setup, string> = { topSpeed: 'Top Speed', handling: 'Handling', acceleration: 'Acceleration' };
const COMPOUND_LABEL: Record<TireCompound, string> = { soft: 'Soft', medium: 'Medium', hard: 'Hard' };
const COMPOUND_COLOR: Record<TireCompound, number> = { soft: 0xff0000, medium: 0xffffff, hard: 0xffaa00 };
type BikeParam = keyof BikeParams;

export class SeasonScene extends Phaser.Scene {
  private season!: SeasonState;
  private career!: CareerState;
  private setup!: Setup;
  private setupBoxes: Record<Setup, Phaser.GameObjects.Rectangle> = {} as never;
  private bikeText!: Phaser.GameObjects.Text;
  private rndText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private bikeButtons: { plus: Phaser.GameObjects.Text; param: BikeParam }[] = [];

  constructor() { super('SeasonScene'); }
  init(data: { season: SeasonState; career?: CareerState }): void {
    this.season = data.season;
    this.career = data.career ?? { player: data.season.playerRider, field: data.season.aiRiders, money: 0 } as CareerState;
    this.bikeButtons = []; // scene objects from a previous visit are destroyed — drop them
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    g.fillRect(0, 0, 1024, 1100);
  }

  create(): void {
    this.drawBackground();
    const sound = (this.game as unknown as { __soundEngine: SoundEngine }).__soundEngine;
    const idx = this.season.currentRaceIndex;
    const track = this.season.calendar[idx];
    this.setup = recommendedSetup(track.weights);
    this.season.lastCompound = this.season.lastCompound ?? 'medium';
    const weather = this.season.weatherByRace?.[idx] ?? 'dry';
    const weatherEmoji = weather === 'wet' ? '🌧️' : '☀️';

    // Race info panel.
    this.drawPanel(24, 16, 660, 128);
    this.add.text(44, 30, `Race ${idx + 1} of ${this.season.calendar.length} - ${track.name} ${weatherEmoji}`, { fontFamily: THEME.fontFamily, fontSize: '24px', color: THEME.gold, fontStyle: 'bold' });
    this.add.text(44, 62, `Track focus   Speed ${track.weights.speed.toFixed(2)}   Cornering ${track.weights.cornering.toFixed(2)}   Accel ${track.weights.acceleration.toFixed(2)}`, { fontFamily: THEME.fontFamily, fontSize: '15px', color: THEME.muted });
    const HINT: Record<Setup, string> = {
      topSpeed: 'Power track -> Top Speed setup favored',
      handling: 'Technical track -> Handling setup favored',
      acceleration: 'Stop-go track -> Acceleration setup favored',
     };
    const wetHint = weather === 'wet' ? ' (Wet conditions — Handling is more valuable)' : '';
    this.add.text(44, 86, HINT[this.setup] + wetHint, { fontFamily: THEME.fontFamily, fontSize: '15px', color: THEME.cyan });
    this.add.text(44, 110, `Races left: ${this.season.calendar.length - this.season.currentRaceIndex}`, { fontFamily: THEME.fontFamily, fontSize: '14px', color: THEME.muted });

    // Your team panel.
    this.drawPanel(24, 156, 660, 160);
    this.add.text(44, 170, 'YOUR TEAM', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    const s = this.season.playerRider.skills;
    this.add.text(44, 196, `Pilot   Pace ${s.pace}   Cornering ${s.cornering}   Consistency ${s.consistency}`, { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.text });
    this.bikeText = this.add.text(44, 222, '', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.text });
    this.moneyText = this.add.text(44, 244, '', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold });
    this.refreshMoney();
    const buyRndBtn = this.add.text(44, 266, `BUY R&D POINT ($${RND_POINT_COST})`, { fontFamily: THEME.fontFamily, fontSize: '14px', color: THEME.green }).setInteractive({ useHandCursor: true });
    buyRndBtn.on('pointerup', () => {
      if (this.career.money >= RND_POINT_COST) {
        this.career.money -= RND_POINT_COST;
        this.season.playerRider.rndPoints += 1;
        sound.playClick();
        this.refreshMoney();
        this.refreshBike();
      }
    });
    this.rndText = this.add.text(300, 266, '', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold });
    (['speed', 'handling', 'acceleration'] as BikeParam[]).forEach((param, i) => {
      const x = 44 + i * 160;
      const cost = bikeUpgradeCost(this.season.playerRider.bike[param]);
      const plus = this.add.text(x, 296, `[+] ${param} (${cost})`, { fontFamily: THEME.fontFamily, fontSize: '15px', color: THEME.green }).setInteractive({ useHandCursor: true });
      this.bikeButtons.push({ plus, param });
      plus.on('pointerup', () => {
        if (investBikePoint(this.season.playerRider, param)) { sound.playClick(); this.refreshBike(); this.refreshBikeButtons(); }
      });
    });
    this.refreshBike();
    this.refreshBikeButtons();

    // Setup panel.
    this.drawPanel(24, 326, 660, 150);
    this.add.text(44, 340, 'SETUP', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    SETUPS.forEach((st, i) => {
      const box = this.add.rectangle(130 + i * 200, 382, 184, 36, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(130 + i * 200, 382, SETUP_LABEL[st], { fontFamily: THEME.fontFamily, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { sound.playClick(); this.setup = st; this.refreshSelectors(); });
      this.setupBoxes[st] = box;
    });
    const recIdx = SETUPS.indexOf(this.setup);
    this.add.text(130 + recIdx * 200, 356, '* Recommended', { fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.gold }).setOrigin(0.5);
    this.refreshSelectors();

    // Tire compound selector.
    this.add.text(44, 412, 'TIRES', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    const compoundBoxes: Record<TireCompound, Phaser.GameObjects.Rectangle> = {} as never;
    (['soft', 'medium', 'hard'] as TireCompound[]).forEach((cp, i) => {
      const box = this.add.rectangle(130 + i * 200, 454, 184, 36, 0x16213e).setStrokeStyle(2, 0x0f3460).setInteractive({ useHandCursor: true });
      this.add.text(130 + i * 200, 454, COMPOUND_LABEL[cp], { fontFamily: THEME.fontFamily, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
      box.on('pointerup', () => { sound.playClick(); this.season.lastCompound = cp; refreshCompounds(); });
      compoundBoxes[cp] = box;
    });
    const refreshCompounds = () => {
      (['soft', 'medium', 'hard'] as TireCompound[]).forEach((cp) => {
        const selected = cp === this.season.lastCompound;
        compoundBoxes[cp].setFillStyle(selected ? 0x0f3460 : 0x16213e).setStrokeStyle(2, selected ? COMPOUND_COLOR[cp] : 0x0f3460);
      });
    };
    refreshCompounds();

    // Championship panel.
    this.drawPanel(688, 16, 320, 480);
    this.add.text(708, 30, 'CHAMPIONSHIP', { fontFamily: THEME.fontFamily, fontSize: '16px', color: THEME.gold, fontStyle: 'bold' });
    renderStandings(this, 696, 58, getStandings(this.season), { showGap: true });
    this.add.text(708, 304, 'Entry List (grid set in qualifying)', { fontFamily: THEME.fontFamily, fontSize: '15px', color: THEME.gold, fontStyle: 'bold' });
    this.showStartingGrid(708, 332);

    new Button(this, { x: 354, y: 560, width: 280, height: 56, label: 'GO TO GRID', onClick: () => { sound.playClick(); this.simulate(); } });
  }

  private drawPanel(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(THEME.panelStyle.bgNum, 0.85);
    g.fillRoundedRect(x, y, w, h, THEME.panelStyle.radius);
    g.lineStyle(2, THEME.panelStyle.borderNum, 1);
    g.strokeRoundedRect(x, y, w, h, THEME.panelStyle.radius);
  }

  private refreshMoney(): void { this.moneyText.setText(`Money: ${formatMoney(this.career.money)}`); }
  private refreshBikeButtons(): void {
    // Unaffordable upgrades gray out (no overlay glyphs — they collided with the labels).
    for (const { plus, param } of this.bikeButtons) {
      const cost = bikeUpgradeCost(this.season.playerRider.bike[param]);
      const affordable = cost <= this.season.playerRider.rndPoints;
      plus.setText(`[+] ${param} (${cost})`);
      plus.setColor(affordable ? THEME.green : THEME.muted).setAlpha(affordable ? 1 : 0.55);
    }
  }
  private refreshBike(): void {
    const b = this.season.playerRider.bike;
    this.bikeText.setText(`Bike    Speed ${b.speed}   Handling ${b.handling}   Acceleration ${b.acceleration}`);
    this.rndText.setText(`Dev points: ${this.season.playerRider.rndPoints}`);
  }
  private refreshSelectors(): void {
    SETUPS.forEach((st) => this.setupBoxes[st].setFillStyle(st === this.setup ? 0x0f3460 : 0x16213e).setStrokeStyle(2, st === this.setup ? THEME.goldNum : 0x0f3460));
  }
   private simulate(): void {
     const rng = new RNG((Date.now() ^ (this.season.currentRaceIndex * 2654435761)) >>> 0);
     const field = [this.season.playerRider, ...this.season.aiRiders];
     const qualifying = runQualifying(field, this.season.calendar[this.season.currentRaceIndex], rng);
     const run = createRace(this.season, this.setup, rng, qualifying.gridOrder);
     this.scene.start('RaceScene', { season: this.season, run, career: this.career, grid: qualifying.gridOrder } as never);
    }

   private showStartingGrid(x: number, y: number): void {
     const field = [this.season.playerRider, ...this.season.aiRiders];
     const lines = field.map((r, i) => {
       const tag = r.isPlayer ? '> ' : '  ';
       return `${tag}${i + 1}. ${r.name}`;
      });
     this.add.text(x, y, lines.join('\n'), { fontFamily: THEME.fontFamily, fontSize: '13px', color: THEME.text });
    }
 }
