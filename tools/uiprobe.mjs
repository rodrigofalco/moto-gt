// Dev-only UI probe: verifies the v2 selection → race flow in a real browser.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/v2-1-select.png' });

const menuState = () => page.evaluate(() => {
  const m = window.__game.scene.getScene('MainMenuScene');
  return { pilot: m.pilot?.id ?? null, brand: m.brand?.id ?? null, start: m.startButton?.enabled ?? null };
});
const activeScene = () => page.evaluate(() => window.__game.scene.getScenes(true)[0].scene.key);

// Click pilot card 0 (160,225) and brand card 1 (395,625).
await page.mouse.click(160, 225);
await page.waitForTimeout(150);
await page.mouse.click(395, 625);
await page.waitForTimeout(150);
console.log('after card clicks:', JSON.stringify(await menuState()));

// START (512,725)
await page.mouse.click(512, 725);
await page.waitForTimeout(500);
console.log('after START, scene:', await activeScene());
await page.screenshot({ path: '/tmp/v2-2-hub.png' });

// In hub: pick setup topSpeed (130,308), risk high (530,400), spend an R&D point (40,210), simulate (320,700)
await page.mouse.click(130, 308);
await page.mouse.click(530, 400);
await page.mouse.click(40, 210);
await page.waitForTimeout(100);
await page.mouse.click(320, 700);
await page.waitForTimeout(600);
console.log('after SIMULATE, scene:', await activeScene());
await page.screenshot({ path: '/tmp/v2-3-result.png' });

console.log('PAGE ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
