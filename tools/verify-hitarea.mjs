import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
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
const info = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('RaceScene');
  const children = scene.children.list;
  const skip = children.find(c => c.constructor.name === 'Button' && c.list.find?.(o => o.text === 'SKIP'));
  if (!skip) return 'skip not found';
  const input = skip.input;
  return {
    x: skip.x, y: skip.y,
    width: skip.width, height: skip.height,
    hitArea: input ? { x: input.hitArea.x, y: input.hitArea.y, width: input.hitArea.width, height: input.hitArea.height } : null,
    interactive: !!input,
    cursor: input ? input.cursor : null,
  };
});
console.log('Button info:', info);
await browser.close();
