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
const [, , OUT, URL, TS] = process.argv;
const cibles = TS.split(',').map(Number);
const browser = await chromium.launch({
  executablePath: nav(),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(180000);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
let i = 0;
for (const t of cibles) {
  /* On remesure avant chaque saut : la mise en page bouge encore après le
     chargement (apparitions, polices), et une géométrie relevée une fois pour
     toutes envoyait le défilement au-delà de la section — d'où des captures
     entièrement blanches, une fois sur trois, sans rien signaler. */
  const y = await page.evaluate((cible) => {
    const n = document.querySelector('#visite section');
    const top = n.getBoundingClientRect().top + scrollY;
    return Math.round(top + cible * (n.offsetHeight - innerHeight));
  }, t);
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(3000);
  const dedans = await page.evaluate(() => {
    const c = document.querySelector('#visite canvas');
    if (!c) return false;
    const r = c.getBoundingClientRect();
    return r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
  });
  if (!dedans) console.log('ATTENTION t=' + t + ' : le canevas n\'est pas à l\'écran');
  await page.screenshot({ path: OUT.replace('.png', `-${String(i).padStart(2, '0')}.png`) });
  i += 1;
}
await browser.close();
console.log('ok');
