/**
 * Une image par légende, pour juger le cadrage sur pièces.
 *
 * Le troisième outil de mesure du dépôt, après `contraste.mjs` et
 * `budget.mjs`, et il répond à la seule question que les deux autres ne posent
 * pas : **qu'est-ce qu'on voit, exactement, pendant qu'on lit ?**
 *
 * Une légende tient l'écran pendant un dixième du défilement, image arrêtée.
 * C'est donc la seule image du décor que le visiteur regarde vraiment, et la
 * seule qu'il faut juger. Photographier « à mi-hauteur de la page » ne dit
 * rien : on tombe entre deux pièces. On calcule donc le curseur au milieu de
 * chaque légende — `buildJourney` le donne — et on va exactement là.
 *
 * Deux pièges, tous deux rencontrés :
 *
 *  · **la mise en page bouge encore après le chargement** (apparitions,
 *    polices). Une géométrie relevée une fois pour toutes envoyait le
 *    défilement au-delà de la section, et la capture sortait entièrement
 *    blanche sans que rien ne le signale. On remesure avant chaque saut.
 *  · **la caméra suit le défilement avec amortissement.** Elle met plusieurs
 *    images à rattraper sa cible, et sous un rendu logiciel une image de la
 *    villa prend plusieurs secondes : un délai fixe photographiait le début de
 *    la visite en croyant photographier son milieu. On attend que la barre de
 *    progression — qui porte le curseur amorti — cesse de bouger.
 *
 *   node scripts/vues.mjs sortie.png http://localhost:3000/villa 0.17,0.30
 */
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
  /* La caméra suit le défilement avec amortissement : elle met plusieurs
     images à rattraper la cible, et sous un rendu logiciel une image de la
     villa prend plusieurs secondes. Un délai fixe photographiait donc le début
     de la visite en croyant photographier son milieu. On attend que la barre
     de progression — qui porte le curseur amorti — cesse de bouger. */
  let precedent = '';
  let stable = 0;
  const limite = Date.now() + 120000;
  while (Date.now() < limite && stable < 4) {
    await page.waitForTimeout(1500);
    const courant = await page.evaluate(() => {
      const bar = document.querySelector('[class*="bar"]');
      return bar ? getComputedStyle(bar).transform : '';
    });
    if (courant === precedent) stable += 1;
    else { stable = 0; precedent = courant; }
  }
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
