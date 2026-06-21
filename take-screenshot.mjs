import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.locator('#game-container').screenshot({ path: '/tmp/menu-screenshot.png' });
console.log('Saved /tmp/menu-screenshot.png');
await browser.close();
