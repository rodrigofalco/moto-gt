import { chromium } from 'playwright';

const scene = process.argv[2] ?? 'mainmenu';
const outPath = `/tmp/shot-${scene}.png`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });

async function screenshot() {
  const game = page.locator('#game-container');
  await game.screenshot({ path: outPath });
  console.log(`Screenshot saved to ${outPath}`);
}

async function gotoAndWait() {
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
}

async function navigateToMainMenu() {
  await gotoAndWait();
}

async function navigateToSeason() {
  await gotoAndWait();
  await page.evaluate(async () => {
    const { createSeason } = await import('/src/core/factories/SeasonFactory.ts');
    const { PILOT_ROSTER } = await import('/src/data/pilots.ts');
    const { BRAND_ROSTER } = await import('/src/data/brands.ts');
    const { RNG } = await import('/src/core/RNG.ts');
    const season = createSeason('QA Team', PILOT_ROSTER[0], BRAND_ROSTER[0], new RNG(12345));
    window.__game.scene.start('SeasonScene', { season });
  });
  await page.waitForTimeout(1500);
}

async function navigateToRace() {
  await gotoAndWait();
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
}

async function navigateToResults() {
  await gotoAndWait();
  await page.evaluate(async () => {
    const { createSeason } = await import('/src/core/factories/SeasonFactory.ts');
    const { createRace, stepLap, finalizeRace } = await import('/src/core/RaceEngine.ts');
    const { runQualifying } = await import('/src/core/Qualifying.ts');
    const { applyProgression } = await import('/src/core/Progression.ts');
    const { applyRaceResult } = await import('/src/core/Championship.ts');
    const { PILOT_ROSTER } = await import('/src/data/pilots.ts');
    const { BRAND_ROSTER } = await import('/src/data/brands.ts');
    const { RNG } = await import('/src/core/RNG.ts');
    const rng = new RNG(12345);
    const season = createSeason('QA Team', PILOT_ROSTER[0], BRAND_ROSTER[0], rng);
    const field = [season.playerRider, ...season.aiRiders];
    const qualifying = runQualifying(field, season.calendar[season.currentRaceIndex], rng);
    const run = createRace(season, 'topSpeed', rng, qualifying.gridOrder);
    while (run.lap < 8) stepLap(run, 'medium');
    const result = finalizeRace(run, rng);
    const summaries = applyProgression([season.playerRider, ...season.aiRiders], result);
    applyRaceResult(season, result);
    const playerSummary = summaries.find((su) => su.riderId === 'player');
    window.__game.scene.start('RaceResultScene', { season, result, playerSummary });
  });
  await page.waitForTimeout(1500);
}

async function navigateToOffseason() {
  await gotoAndWait();
  await page.evaluate(async () => {
    const { newCareer } = await import('/src/core/CareerStore.ts');
    const { PILOT_ROSTER } = await import('/src/data/pilots.ts');
    const { BRAND_ROSTER } = await import('/src/data/brands.ts');
    const { RNG } = await import('/src/core/RNG.ts');
    const career = newCareer('QA Team', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(12345));
    window.__game.scene.start('OffSeasonScene', { career });
  });
  await page.waitForTimeout(1500);
}

try {
  switch (scene) {
    case 'mainmenu':
      await navigateToMainMenu();
      break;
    case 'season':
      await navigateToSeason();
      break;
    case 'race':
      await navigateToRace();
      break;
    case 'results':
      await navigateToResults();
      break;
    case 'offseason':
      await navigateToOffseason();
      break;
    default:
      console.error(`Unknown scene: ${scene}. Supported: mainmenu, season, race, results, offseason`);
      process.exit(1);
  }
  await screenshot();
} finally {
  await browser.close();
}
