// Dev-only UI probe: verifies the v2 selection → race-day → result flow.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const activeScene = () => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));

// Select pilot 0 + brand 1, start.
await page.mouse.click(160, 225);
await page.mouse.click(395, 625);
await page.waitForTimeout(150);
await page.mouse.click(512, 725);
await page.waitForTimeout(500);
console.log('after START:', await activeScene());

// Hub: setup top speed, risk high, simulate.
await page.mouse.click(130, 308);
await page.mouse.click(530, 400);
await page.mouse.click(320, 700);
await page.waitForTimeout(600);
console.log('after SIMULATE:', await activeScene());
await page.waitForTimeout(2500);          // watch some laps
await page.screenshot({ path: '/tmp/raceday.png' });

// Skip to result.
await page.mouse.click(880, 700);
await page.waitForTimeout(600);
console.log('after SKIP:', await activeScene());

console.log('PAGE ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
