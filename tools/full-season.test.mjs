// Full-season end-to-end probe: drives the real UI through an ENTIRE 6-race season
// (career mode), the season-end podium, the off-season report, and into season 2.
// Captures screenshots along the way and fails on any browser console/page error.
//
// Usage:
//   npm run dev            # in another terminal (or already running)
//   node tools/full-season.test.mjs [port]
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1100 } });

const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));

const shots = [];
async function shot(name) {
  const path = `/tmp/full-season-${name}.png`;
  await page.locator('#game-container').screenshot({ path });
  shots.push(path);
  console.log(`  📸 ${path}`);
}

const failures = [];
function check(label, cond, detail = '') {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label} ${detail}`); failures.push(`${label} ${detail}`); }
}

await page.addInitScript(() => {
  window.__currentScene = function () {
    const game = window.__game;
    if (!game || !game.scene) return null;
    for (const k of Object.keys(game.scene.keys)) {
      const s = game.scene.getScene(k);
      if (s && s.scene && s.scene.isActive() && s.scene.isVisible()) return k;
    }
    return null;
  };
});

const waitScene = (name, timeout = 15000) =>
  page.waitForFunction((n) => window.__currentScene() === n, name, { timeout });

try {
  console.log('\n[1] Boot -> MainMenu -> new career');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitScene('MainMenuScene');
  await page.waitForTimeout(800);

  const geom = await page.evaluate(() => {
    const canvas = document.getElementById('game-container').querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, w: rect.width, h: rect.height };
  });
  const toScreen = (gx, gy) => [geom.left + gx * (geom.w / 1024), geom.top + gy * (geom.h / 1100)];

  await page.mouse.click(...toScreen(182, 240));  // first pilot card
  await page.waitForTimeout(250);
  await page.mouse.click(...toScreen(182, 875));  // first bike card
  await page.waitForTimeout(250);
  await page.mouse.click(...toScreen(512, 1000)); // START SEASON
  await waitScene('SeasonScene');
  await page.waitForTimeout(600);
  check('reached SeasonScene', true);

  let wetShot = false;
  for (let race = 1; race <= 6; race++) {
    console.log(`\n[race ${race}/6]`);
    if (race === 1) await shot('season-hub');
    await page.mouse.click(...toScreen(354, 560)); // GO TO GRID
    await waitScene('RaceScene');
    await page.waitForTimeout(2500);               // let a couple of laps animate
    const wet = await page.evaluate(() => {
      const rs = window.__game?.scene?.getScene('RaceScene');
      return rs?.sd?.run?.weather === 'wet';
    });
    if (race === 1) await shot('race-live');
    if (wet && !wetShot) { await shot('race-wet'); wetShot = true; }
    await page.mouse.click(...toScreen(930, 700)); // SKIP
    await waitScene('RaceResultScene');
    await page.waitForTimeout(700);
    check(`race ${race} finished -> RaceResultScene`, true);
    if (race === 1) await shot('race-result');
    if (race < 6) {
      await page.mouse.click(...toScreen(512, 470)); // NEXT RACE
      await waitScene('SeasonScene');
      await page.waitForTimeout(500);
    }
  }

  console.log('\n[season end] podium + off-season');
  await shot('season-end');
  await page.mouse.click(...toScreen(512, 712));   // GO TO OFF-SEASON
  await waitScene('OffSeasonScene');
  await page.waitForTimeout(900);
  check('reached OffSeasonScene', true);
  await shot('offseason');

  await page.mouse.click(...toScreen(512, 640));   // START NEXT SEASON
  await waitScene('SeasonScene');
  await page.waitForTimeout(600);
  const season2 = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('SeasonScene');
    return { races: s?.season?.raceResults?.length ?? -1, seasonNumber: s?.career?.seasonNumber ?? -1 };
  });
  check('season 2 starts fresh (0 results)', season2.races === 0, `(got ${season2.races})`);
  check('career advanced to season 2', season2.seasonNumber === 2, `(got ${season2.seasonNumber})`);
  await shot('season2-hub');
  if (!wetShot) console.log('  (no wet race rolled this season — rain visuals not captured)');

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
