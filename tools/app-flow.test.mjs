// End-to-end app flow test + screenshot capture via Playwright.
//
// Launches the Vite dev server (or reuses a running one), drives the real UI
// click-by-click through MainMenu -> Season -> Race -> (skip) -> Results,
// captures a screenshot of each scene into /tmp/app-flow-*.png, and asserts
// that each scene transition actually happens (via the Phaser scene stack on
// window.__game). Any browser console errors / page errors are collected and
// fail the run.
//
// Usage:
//   node tools/app-flow.test.mjs             # auto-detects port (5173, then 5174)
//   node tools/app-flow.test.mjs 5174        # explicit port
//   npm run dev  # in another terminal first
//
// Requires: `npx playwright install chromium` once.

import { chromium } from 'playwright';

const argPort = process.argv[2] ? Number(process.argv[2]) : null;

async function findPort() {
  if (argPort) return argPort;
  for (const p of [5173, 5174, 5175]) {
    try {
      const res = await fetch(`http://localhost:${p}/`, { method: 'GET' });
      if (res.ok) return p;
    } catch { /* try next */ }
  }
  throw new Error('No Vite dev server found on ports 5173-5175. Run `npm run dev` first.');
}

const PORT = await findPort();
const BASE = `http://localhost:${PORT}/`;
console.log(`Using dev server at ${BASE}`);

/** Current Phaser scene key, read from the running game. */
const currentScene = () =>
  window.__game?.scene ? Object.keys(window.__game.scene.keys)
    .find((k) => window.__game.scene.isActive(k) || window.__game.scene.isVisible(k)) : null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1100 } });

const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));

const shots = [];
async function shot(name) {
  const path = `/tmp/app-flow-${name}.png`;
  await page.locator('#game-container').screenshot({ path });
  shots.push(path);
  console.log(`  📸 ${path}`);
}

const failures = [];
function check(label, cond, detail = '') {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label} ${detail}`); failures.push(`${label} ${detail}`); }
}

// Helper: the scene stack lives on window.__game; we expose the accessor on the page.
await page.addInitScript(() => {
  window.__currentScene = function () {
    const game = window.__game;
    if (!game || !game.scene) return null;
    const keys = Object.keys(game.scene.keys);
    for (const k of keys) {
      const s = game.scene.getScene(k);
      if (s && s.scene && s.scene.isActive() && s.scene.isVisible()) return k;
    }
    return null;
  };
  window.__sceneLog = [];
  window.__captureSceneLog = function () {
    const game = window.__game;
    if (!game) return;
    game.events.on('transitionstart', (from, to) => window.__sceneLog.push(`${from}->${to}`));
  };
});

try {
  console.log('\n[1/5] Load app — should reach MainMenu');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__currentScene() === 'MainMenuScene', null, { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__captureSceneLog());
  check('reached MainMenuScene', await page.evaluate(() => window.__currentScene()) === 'MainMenuScene');
  await shot('1-mainmenu');

  console.log('\n[2/5] MainMenu — pick pilot, pick bike, enter team, START SEASON');
  // Select the first pilot card and first bike card by clicking their containers.
  const pilotCards = page.locator('#game-container [style*="cursor: pointer"], #game-container canvas').first();
  // Phaser renders to a canvas; clicks must land on the canvas at the right coords.
  // The canvas is FIT-scaled into #game-container. Compute the scale + offset so we
  // can translate game coordinates (1024x1100) -> screen pixels.
  const geom = await page.evaluate(() => {
    const container = document.getElementById('game-container');
    const canvas = container.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      canvasLeft: rect.left, canvasTop: rect.top,
      canvasWidth: rect.width, canvasHeight: rect.height,
      gameWidth: 1024, gameHeight: 1100,
    };
  });
  const scaleX = geom.canvasWidth / geom.gameWidth;
  const scaleY = geom.canvasHeight / geom.gameHeight;
  const toScreen = (gx, gy) => [geom.canvasLeft + gx * scaleX, geom.canvasTop + gy * scaleY];

  // Pilot grid: first card center ~ (182, 40+118) in game coords (container offset +140 -> world ~ y=298).
  // MainMenu selectionUI container is at y=200 (setY(200)); card y inside container = 40 + row*118.
  // World y of first pilot card = 200 + 40 + 0*118 = 240. x = 182 (left + 0*stride).
  await page.mouse.click(...toScreen(182, 240));
  await page.waitForTimeout(250);
  // Bike grid: first bike card center ~ (182, 675) inside container -> world y = 200 + 675 = 875.
  await page.mouse.click(...toScreen(182, 875));
  await page.waitForTimeout(250);
  // Team box at (180, 92) -> click it to focus, then type.
  await page.mouse.click(...toScreen(180, 92));
  await page.waitForTimeout(150);
  await page.keyboard.type('QA', { delay: 40 });
  await page.waitForTimeout(150);
  // START SEASON button at (512, 1000).
  await page.mouse.click(...toScreen(512, 1000));
  await page.waitForFunction(() => window.__currentScene() === 'SeasonScene', null, { timeout: 8000 });
  await page.waitForTimeout(800);
  check('reached SeasonScene', await page.evaluate(() => window.__currentScene()) === 'SeasonScene');
  await shot('2-season');

  console.log('\n[3/5] Season — click GO TO GRID, expect RaceScene');
  // GO TO GRID button at (354, 560).
  await page.mouse.click(...toScreen(354, 560));
  await page.waitForTimeout(1500);
  const sceneAfterGrid = await page.evaluate(() => window.__currentScene());
  check('reached RaceScene', sceneAfterGrid === 'RaceScene', `(got ${sceneAfterGrid})`);
  await shot('3-race');

  if (sceneAfterGrid === 'RaceScene') {
    console.log('\n[4/5] Race — wait for race to progress, then SKIP to results');
    await page.waitForTimeout(4000);
    await shot('4-race-progress');
    // SKIP button at (930, 700) in RaceScene.
    await page.mouse.click(...toScreen(930, 700));
    await page.waitForFunction(
      () => ['RaceResultScene', 'SeasonScene'].includes(window.__currentScene()),
      null, { timeout: 12000 },
    );
    await page.waitForTimeout(800);
    const afterSkip = await page.evaluate(() => window.__currentScene());
    check('reached RaceResultScene after skip', afterSkip === 'RaceResultScene', `(got ${afterSkip})`);
    await shot('5-results');
  } else {
    console.log('\n[4/5] Race — SKIPPED (did not reach RaceScene)');
    console.log('[5/5] Results — SKIPPED');
  }

  console.log('\n--- scene transition log ---');
  const log = await page.evaluate(() => window.__sceneLog);
  console.log(log.length ? log.join('\n') : '(none captured)');

  if (errors.length) {
    console.log('\n--- browser errors ---');
    for (const e of errors) console.log(e);
  }
} catch (err) {
  failures.push(`exception: ${err.message}`);
  console.log(`\nEXCEPTION: ${err.message}`);
  try { await shot('error'); } catch { /* ignore */ }
} finally {
  await browser.close();
}

console.log(`\n=== ${failures.length === 0 && errors.length === 0 ? 'PASS' : 'FAIL'} ===`);
console.log(`Screenshots: ${shots.join(', ')}`);
if (failures.length) { console.log('Failures:'); for (const f of failures) console.log('  - ' + f); }
if (errors.length) { console.log('Browser errors:'); for (const e of errors) console.log('  - ' + e); }
process.exit(failures.length === 0 && errors.length === 0 ? 0 : 1);
