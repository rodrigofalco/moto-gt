import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const game = page.locator('#game-container');
await game.screenshot({ path: '/tmp/current-game-view.png' });
console.log('Screenshot saved to /tmp/current-game-view.png');
await browser.close();
