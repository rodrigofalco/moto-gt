import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
const logs = [];
page.on('console', (msg) => logs.push(msg.text()));
page.on('pageerror', (err) => logs.push('PAGEERROR: ' + err.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  if (!window.__game.__soundEngine) {
    window.__game.__soundEngine = {
      isMuted: () => false, toggleMute: () => {}, playClick: () => {}, playCrash: () => {},
      playOvertake: () => {}, playPodium: () => {}, playCheckeredFlag: () => {},
      playEngine: () => {}, stopEngine: () => {},
    };
  }
});
await page.evaluate(async () => {
  const { createSeason } = await import('/src/core/factories/SeasonFactory.ts');
  const { createRace } = await import('/src/core/RaceEngine.ts');
  const { runQualifying } = await import('/src/core/Qualifying.ts');
  const { PILOT_ROSTER } = await import('/src/data/pilots.ts');
  const { BRAND_ROSTER } = await import('/src/data/brands.ts');
  const { RNG } = await import('/src/core/RNG.ts');
  const rng = new RNG(12345);
  const season = createSeason('QA Team', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
  const field = [season.playerRider, ...season.aiRiders];
  const qualifying = runQualifying(field, season.calendar[season.currentRaceIndex], rng);
  const run = createRace(season, 'topSpeed', rng, qualifying.gridOrder);
  window.__game.scene.start('RaceScene', { season, run, grid: qualifying.gridOrder });
});
await page.waitForTimeout(1500);
const before = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('RaceScene');
  return scene ? { key: scene.scene.key, lapsDone: scene.lapsDone } : 'no scene';
});
console.log('before click:', before);
// Click the SKIP button (visual center roughly at viewport coords ~1110, 800)
await page.click('#game-container canvas', { position: { x: 1110, y: 800 } });
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('RaceScene');
  return scene ? { key: scene.scene.key, lapsDone: scene.lapsDone, done: scene.done } : 'no scene';
});
console.log('after click:', after);
console.log('logs:', logs.slice(0, 20));
await browser.close();
