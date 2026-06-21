// MotoGT runtime debug probe.
//
// Drives the real UI click-by-click through scene transitions, captures every
// browser console.error and uncaught pageerror, and pinpoints which step
// crashes. Primary signal is the console — see SKILL.md. Does NOT inject fake
// stubs (they mask real bugs).
//
// Usage:
//   node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs
//   node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs --stop season
//   node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs --port 5174
//   node .pi/skills/app-runtime-debug/scripts/debug-probe.mjs --headed
//
// Requires: `npm run dev` running + `npx playwright install chromium`.

import { chromium } from 'playwright';

// ---- CLI args ----
const args = process.argv.slice(2);
const argPort = (() => { const i = args.indexOf('--port'); return i >= 0 ? Number(args[i + 1]) : null; })();
const stopAfter = (() => { const i = args.indexOf('--stop'); return i >= 0 ? args[i + 1] : null; })();
const headed = args.includes('--headed');

async function findPort() {
  if (argPort) return argPort;
  for (const p of [5173, 5174, 5175, 5176]) {
    try { const res = await fetch(`http://localhost:${p}/`, { method: 'GET' }); if (res.ok) return p; }
    catch { /* try next */ }
  }
  throw new Error('No Vite dev server found on ports 5173-5176. Run `npm run dev` first.');
}
const PORT = await findPort();
const BASE = `http://localhost:${PORT}/`;
console.log(`Using dev server at ${BASE}`);

// ---- Flow steps: each click is in GAME coordinates (1024x1100) ----
// Update these if a button moves in scene source. Keep ordered + small.
const STEPS = [
  {
    name: '[1/5] Load app — MainMenu',
    expect: 'MainMenuScene',
    waitFor: 800,
    shots: ['1-mainmenu'],
  },
  {
    name: '[2/5] MainMenu — pick pilot + bike, type team, START SEASON',
    clicks: [{ gx: 182, gy: 240 }, { gx: 182, gy: 875 }, { gx: 180, gy: 92 }],
    type: 'QA',
    thenClick: { gx: 512, gy: 1000 },
    expect: 'SeasonScene',
    waitFor: 800,
    shots: ['2-season'],
  },
  {
    name: '[3/5] Season — GO TO GRID',
    clicks: [{ gx: 354, gy: 560 }],
    expect: 'RaceScene',
    waitFor: 1500,
    shots: ['3-race'],
  },
  {
    name: '[4/5] Race — wait, then SKIP to results',
    preWait: 4000,
    clicks: [{ gx: 930, gy: 670 }],
    expect: 'RaceResultScene',
    expectAny: ['RaceResultScene', 'SeasonScene'],
    waitFor: 800,
    shots: ['4-race-progress', '5-results'],
  },
];

const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ viewport: { width: 1024, height: 1100 } });

const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));

// Expose scene-key accessor on the page (Phaser scene stack lives on window.__game).
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

const failures = [];
const shots = [];
async function shot(name) {
  const path = `/tmp/debug-probe-${name}.png`;
  try { await page.locator('#game-container').screenshot({ path }); shots.push(path); console.log(`  📸 ${path}`); }
  catch (e) { console.log(`  (screenshot failed: ${e.message})`); }
}
function check(label, cond, detail = '') {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label} ${detail}`); failures.push(`${label} ${detail}`); }
}

try {
  // Canvas geometry for game->screen coordinate mapping (computed after load).
  let toScreen = () => [0, 0];
  function recomputeGeom() {
    return page.evaluate(() => {
      const canvas = document.querySelector('#game-container canvas');
      const r = canvas.getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height };
    }).then((g) => {
      const sx = g.w / 1024, sy = g.h / 1100;
      toScreen = (gx, gy) => [g.left + gx * sx, g.top + gy * sy];
    });
  }

  let firstLoad = true;
  for (const step of STEPS) {
    console.log(`\n${step.name}`);
    if (firstLoad) {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await recomputeGeom();
      firstLoad = false;
    }
    if (step.preWait) await page.waitForTimeout(step.preWait);
    for (const c of step.clicks ?? []) { await page.mouse.click(...toScreen(c.gx, c.gy)); await page.waitForTimeout(200); }
    if (step.type) { await page.keyboard.type(step.type, { delay: 40 }); await page.waitForTimeout(150); }
    if (step.thenClick) { await page.mouse.click(...toScreen(step.thenClick.gx, step.thenClick.gy)); }
    if (step.expect) {
      const want = step.expectAny ?? [step.expect];
      await page.waitForFunction(
        (w) => w.includes(window.__currentScene()),
        want, { timeout: 10000 },
      ).catch(() => {});
      const got = await page.evaluate(() => window.__currentScene());
      check(`reached ${step.expect}`, got === step.expect, `(got ${got})`);
    }
    if (step.waitFor) await page.waitForTimeout(step.waitFor);
    for (const s of step.shots ?? []) await shot(s);
    if (step.expect && stopAfter && step.expect.toLowerCase().startsWith(stopAfter.toLowerCase())) {
      console.log(`\n--stop reached (${stopAfter}); halting.`);
      break;
    }
  }

  if (errors.length) {
    console.log('\n--- browser errors ---');
    for (const e of errors) console.log(e);
  }
} catch (err) {
  failures.push(`exception: ${err.message}`);
  console.log(`\nEXCEPTION: ${err.message}`);
  try { await shot('error'); } catch { /* ignore */ }
} finally {
  if (headed) await page.waitForTimeout(3000);
  await browser.close();
}

const ok = failures.length === 0 && errors.length === 0;
console.log(`\n=== ${ok ? 'PASS' : 'FAIL'} === (${errors.length} console errors, ${failures.length} step failures)`);
if (shots.length) console.log(`Screenshots: ${shots.join(', ')}`);
process.exit(ok ? 0 : 1);
