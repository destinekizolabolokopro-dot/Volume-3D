import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';
const { chromium } = pw;
const nav = () => {
  const r = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const d = readdirSync(r).filter((n) => n.startsWith('chromium-')).sort().pop();
  const b = join(r, d, 'chrome-linux', 'chrome');
  return existsSync(b) ? b : undefined;
};
const browser = await chromium.launch({ executablePath: nav(), args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(120000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
await page.goto('file:///home/user/Volume-3D/standalone/volume3d.html', { waitUntil: 'load' });
await page.waitForTimeout(4500);
const OUT = '/tmp/claude-0/-home-user-Volume-3D/de07f9b3-8731-5a1c-b481-b9b97a3ae3e7/scratchpad/';
console.log(JSON.stringify(await page.evaluate(() => ({
  ecrans: [...document.querySelectorAll('.v3d-screen')].map((n) => n.id),
  boutons: [...document.querySelectorAll('.v3d-switch button')].map((b) => b.textContent),
  still: document.querySelectorAll('[class*="EntranceTour_still__"]').length,
  tour: document.querySelectorAll('[class*="EntranceTour_tour"]').length,
  morts: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
}))));
await page.evaluate(() => document.querySelector('.v3d-switch button[data-screen="villa"]').click());
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + 'sa-villa-haut.png' });
await page.evaluate(() => window.scrollTo(0, 1700));
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + 'sa-villa.png' });
if (errs.length) console.log('ERREURS', errs.slice(0, 4).join(' | '));
await browser.close();
