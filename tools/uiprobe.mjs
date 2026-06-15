// Dev-only UI probe: maps the real hit area of the START button via hover color.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const bg = () => page.evaluate(() => window.__game.scene.getScene('MainMenuScene').startButton.list[0].fillColor);
const isHit = async () => (await bg()) === 0xff5f7a;
async function hover(x, y) { await page.mouse.move(0, 0); await page.mouse.move(x, y); await page.waitForTimeout(30); return isHit(); }

// Rendered bounds per earlier measurement: x 352..672, y 612..668.
console.log('=== HORIZONTAL scan @ y=640 (rendered x: 352..672) ===');
let row = [];
for (let x = 344; x <= 680; x += 16) row.push(`${x}:${(await hover(x, 640)) ? 'H' : '.'}`);
console.log(row.join(' '));

console.log('=== VERTICAL scan @ x=512 (rendered y: 612..668) ===');
let col = [];
for (let y = 604; y <= 676; y += 6) col.push(`${y}:${(await hover(512, y)) ? 'H' : '.'}`);
console.log(col.join(' '));

await browser.close();
