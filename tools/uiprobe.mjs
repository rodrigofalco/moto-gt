// Dev-only UI probe: verifies selection → hub(setup) → interactive race-day → result.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));

await page.mouse.click(160, 225); await page.mouse.click(395, 625);   // pilot + brand
await page.waitForTimeout(120); await page.mouse.click(512, 725);     // START
await page.waitForTimeout(400);
await page.mouse.click(130, 322);                                     // setup: Top Speed
await page.mouse.click(320, 690);                                     // GO TO GRID
await page.waitForTimeout(500);
console.log('after GO TO GRID:', await scenes());

// In the race: issue Attack order, slow to 0.5x, watch.
await page.mouse.click(440, 648);   // Attack
await page.mouse.click(700, 648);   // 0.5x
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/raceday2.png' });

await page.mouse.click(900, 712);   // SKIP
await page.waitForTimeout(600);
console.log('after SKIP:', await scenes());
console.log('PAGE ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
