/**
 * La page ORIEL, photographiée section par section.
 *
 * Le bâtiment de cette page n'existe qu'à l'écran : rien dans le code source ne
 * dit à quoi il ressemble, et on ne juge pas un cadrage sur des degrés
 * d'azimut. Ce script ouvre la page dans un vrai navigateur, la fait défiler
 * jusqu'à chaque section, **attend que la caméra amortie ait rattrapé son
 * retard**, puis photographie.
 *
 * Cette attente-là est tout le script. Sans elle, on photographie le plan
 * précédent : l'amortissement met plus d'une seconde à converger, et une
 * capture prise trop tôt montre une caméra en route vers nulle part.
 *
 *   npm run residence
 *   W=390 H=844 SORTIE=captures/tel npm run residence
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';

const { chromium } = pw;
const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTE = process.env.ROUTE || '/residence';
const WIDTH = Number(process.env.W || 1440);
const HEIGHT = Number(process.env.H || 900);
const SORTIE = process.env.SORTIE || 'captures/residence';

/** Les six sections, plus les trois plans de la galerie. */
const ARRETS = [
  ['1-hero', '#top', 0],
  ['2-projet', '#project', 0],
  ['3-architecture', '#architecture', 0],
  ['4-galerie-i', '#gallery', 0],
  ['4-galerie-ii', '#gallery', 1],
  ['4-galerie-iii', '#gallery', 2],
  ['5-chiffres', '#about', 0],
  ['6-appel', '#contact', 0],
];

function navigateur() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const dossier = readdirSync(racine)
    .filter((name) => name.startsWith('chromium-'))
    .sort()
    .pop();
  if (!dossier) return undefined;
  const binaire = join(racine, dossier, 'chrome-linux', 'chrome');
  return existsSync(binaire) ? binaire : undefined;
}

mkdirSync(SORTIE, { recursive: true });

const browser = await chromium.launch({
  executablePath: navigateur(),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

const erreurs = [];
page.on('console', (message) => {
  if (message.type() === 'error') erreurs.push(message.text());
});
page.on('pageerror', (error) => erreurs.push(String(error)));

await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForSelector('.rz-fond canvas', { timeout: 60000 });

/**
 * Laisse la caméra rattraper son retard.
 *
 * On ne peut pas attendre que l'image « cesse de bouger » : elle ne cesse
 * jamais. Une orbite lente de deux degrés tourne en permanence par-dessus le
 * défilement, donc deux captures successives ne sont jamais identiques, et une
 * comparaison octet à octet ne convergerait pas — c'est la première version de
 * ce script, et elle annonçait huit fois « jamais stable » sur des images
 * parfaitement posées.
 *
 * Ce qu'on attend, c'est la convergence de **l'amortissement**, et celle-là se
 * calcule : le facteur est normalisé sur le temps écoulé, la constante vaut
 * 0,0022 par seconde, donc l'écart au plan visé est divisé par cent en moins
 * d'une seconde de temps réel — quelle que soit la cadence, y compris sous le
 * rendu logiciel de ce script. Deux secondes et demie laissent une marge
 * confortable.
 */
async function poser() {
  /* D'abord les animations de la page. Sous rendu logiciel, la première image
     de la scène bloque le fil principal plusieurs secondes : les observateurs
     d'intersection ne se déclenchent qu'après, et une attente de durée fixe
     photographie un premier écran dont le titre n'a pas encore commencé à
     monter. On attend donc l'état, pas le temps. */
  await page.waitForFunction(
    () => {
      /* Tout ce qui est à l'écran doit avoir été vu par son observateur. Sous
         rendu logiciel, une image de la scène peut coûter plusieurs centaines
         de millisecondes : les rappels d'intersection attendent leur tour, et
         une capture prise à l'heure dite trouve une section vide. */
      const dedans = [...document.querySelectorAll('[data-facon], [data-vu]')].filter((n) => {
        const r = n.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight && r.height > 0;
      });
      if (dedans.some((n) => n.dataset.vu !== '1')) return false;
      return document.getAnimations().every((a) => a.playState !== 'running');
    },
    undefined,
    { timeout: 60000 },
  ).catch(async () => {
    /* On ne fait pas échouer la prise de vue pour cela : une capture imparfaite
       avec la liste de ce qui n'était pas prêt vaut mieux qu'une exception qui
       n'apprend rien. */
    const retard = await page.evaluate(() =>
      [...document.querySelectorAll('[data-facon]')]
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && r.height > 0 && n.dataset.vu !== '1';
        })
        .map((n) => n.className.split(' ').pop()),
    );
    console.log(`  ⚠ pas révélé : ${retard.join(', ') || '(rien — animations en cours)'}`);
  });
  // Puis la caméra, dont l'amortissement converge en moins d'une seconde.
  await page.waitForTimeout(2500);
}

for (const [nom, ancre, plan] of ARRETS) {
  await page.evaluate(
    ([ancre, plan]) => {
      const cible = document.querySelector(ancre);
      if (!cible) throw new Error(`ancre absente : ${ancre}`);
      const haut = cible.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: haut + plan * window.innerHeight, behavior: 'instant' });
    },
    [ancre, plan],
  );
  await poser();
  await page.screenshot({ path: join(SORTIE, `${nom}.png`) });
  console.log(`${nom.padEnd(16)} ok`);
}

if (erreurs.length > 0) {
  console.log('\nErreurs de console :');
  for (const erreur of erreurs) console.log('  · ' + erreur);
} else {
  console.log('\nAucune erreur de console.');
}

await browser.close();
