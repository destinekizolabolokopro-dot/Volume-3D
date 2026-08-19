/**
 * Le contraste des légendes de la visite, mesuré au pixel.
 *
 * Le texte de la visite est blanc, et ce qu'il y a derrière change à chaque
 * image : un mur en plein soleil, le ciel dans une fenêtre, un parquet à
 * l'ombre. Le voile est là pour garantir la lisibilité, mais « garantir » se
 * vérifie — et la moyenne ne suffit pas. Une légende dont le fond tient dix pour
 * un en moyenne peut avoir, sur cinq pour cent de sa surface, du blanc pur : la
 * phrase s'y coupe en deux, et c'est exactement ce que faisait la première
 * version.
 *
 * On mesure donc trois chiffres par légende, contre du blanc pur :
 * le pire pixel, le cinquième centile, la moyenne. Le seuil est le 4,5:1 de la
 * WCAG 2.1 sur le cinquième centile — les quelques pixels les plus clairs
 * peuvent tomber sous le seuil sans que la lettre disparaisse, cinq pour cent
 * de la surface, non.
 *
 * Le texte est masqué pendant la mesure, mais le voile et l'écran restent :
 * c'est ce qui se trouve *derrière* la lettre qu'on veut connaître. Masquer la
 * légende entière masquerait aussi son écran, et le premier jet de ce script
 * faisait précisément cette erreur — il mesurait un fond que personne ne voit,
 * et concluait à un défaut qui n'existait pas.
 *
 *   npm run contraste            # sur http://localhost:3000
 *   BASE=http://localhost:8983 npm run contraste
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';

const { chromium } = pw;

/**
 * Le navigateur à lancer.
 *
 * Playwright cherche une révision précise dans son propre cache. Sur une machine
 * où Chromium est déjà installé — un conteneur d'intégration, par exemple — la
 * révision ne correspond pas et Playwright réclame un téléchargement dont on n'a
 * pas besoin. On lui indique alors le binaire présent.
 */
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
const BASE = process.env.BASE || 'http://localhost:3000';
const WIDTH = Number(process.env.W || 1280);
const HEIGHT = Number(process.env.H || 800);
const SEUIL = 4.5;
const PAS = Number(process.env.PAS || 24);

/**
 * Le temps maximal accordé à la caméra pour rejoindre sa cible.
 *
 * Elle suit le défilement avec amortissement. Un délai fixe ne convient pas :
 * l'amortissement est normalisé sur le temps écoulé, donc sur une machine qui
 * rend à trois images par seconde — un rendu logiciel d'intégration, par
 * exemple — la convergence prend plusieurs secondes au lieu d'une fraction. Les
 * premières versions de ce script mesuraient donc des images de transition, et
 * deux exécutions ne donnaient jamais le même résultat.
 *
 * On attend maintenant la convergence elle-même : la barre de progression porte
 * le curseur amorti, il suffit de la regarder s'immobiliser.
 */
const REPOS_MAX = 20000;

/** Luminance relative WCAG 2.1 d'un canal sRGB 0..255. */
const canal = (value) => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const browser = await chromium.launch({
  executablePath: navigateur(),
  /* Rendu logiciel : la mesure doit tourner sans carte graphique. */
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const section = await page.evaluate(() => {
  const node = document.querySelector('#visite section') || document.querySelector('#visite');
  if (!node) return null;
  return { top: node.getBoundingClientRect().top + scrollY, height: node.offsetHeight, vh: innerHeight };
});
if (!section) {
  console.error('Aucune section de visite sur la page : le serveur tourne-t-il sur ' + BASE + ' ?');
  await browser.close();
  process.exit(1);
}

/**
 * Attend que la caméra ait rejoint sa cible.
 *
 * La barre de progression est mise à l'échelle du curseur amorti à chaque
 * image : quand sa transformation cesse de bouger, la caméra est arrivée. C'est
 * un signal que le produit affiche déjà, donc rien à instrumenter.
 */
async function reposer() {
  /*
   * Le sondage doit être plus lent que l'intervalle entre deux images.
   *
   * Sinon « immobile » ne veut pas dire « arrivé » : sous un rendu logiciel à
   * une image et demie par seconde, trois sondages à cent vingt millisecondes
   * tombent tous dans la même image, la valeur ne bouge pas, et on conclut à
   * une convergence qui n'a pas commencé. La première version de ce script
   * mesurait ainsi le tout début de la visite en croyant mesurer son milieu.
   */
  const PAUSE = 250;
  const IDENTIQUES = 8;
  const debut = Date.now();
  let precedent = '';
  let stable = 0;
  while (Date.now() - debut < REPOS_MAX) {
    await page.waitForTimeout(PAUSE);
    const courant = await page.evaluate(() => {
      const bar = document.querySelector('[class*="bar"]');
      return bar ? getComputedStyle(bar).transform : '';
    });
    if (courant === precedent) {
      stable += 1;
      if (stable >= IDENTIQUES) return;
    } else {
      stable = 0;
      precedent = courant;
    }
  }
}

/** La légende visible, son cadre, et ce qu'il y a derrière elle. */
async function mesure() {
  const cadre = await page.evaluate(() => {
    let node = null;
    let best = -1;
    for (const candidate of document.querySelectorAll('[class*="caption"]')) {
      const value = Number(getComputedStyle(candidate).opacity);
      if (value > best) {
        best = value;
        node = candidate;
      }
    }
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, w: box.width, h: box.height, opacity: best };
  });
  if (!cadre || cadre.opacity < 0.85 || cadre.w < 4 || cadre.h < 4) return null;

  const cacher = (value) =>
    page.evaluate((v) => {
      for (const node of document.querySelectorAll('[class*="caption"] figcaption')) {
        node.style.visibility = v;
      }
    }, value);

  await cacher('hidden');
  const shot = await page.screenshot({
    type: 'png',
    clip: { x: cadre.x, y: cadre.y, width: cadre.w, height: cadre.h },
  });
  await cacher('');

  const pixels = await page.evaluate(async (data) => {
    const image = new Image();
    await new Promise((ok, ko) => {
      image.onload = ok;
      image.onerror = ko;
      image.src = 'data:image/png;base64,' + data;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, image.width, image.height).data);
  }, shot.toString('base64'));

  const ratios = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const L =
      0.2126 * canal(pixels[index]) +
      0.7152 * canal(pixels[index + 1]) +
      0.0722 * canal(pixels[index + 2]);
    ratios.push(1.05 / (L + 0.05));
  }
  ratios.sort((a, b) => a - b);
  return {
    pire: ratios[0],
    centile: ratios[Math.floor(0.05 * ratios.length)],
    moyen: ratios.reduce((a, b) => a + b, 0) / ratios.length,
  };
}

const brut = [];
for (let index = 0; index <= PAS; index += 1) {
  const t = index / PAS;
  const y = Math.round(section.top + t * (section.height - section.vh));
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
  await reposer();
  const found = await mesure();
  if (found) brut.push({ t, ...found });
}

// Une ligne par légende : le pire moment de chaque plateau.
const legendes = [];
for (const point of brut) {
  const last = legendes[legendes.length - 1];
  if (last && point.t - last.t <= 0.04) {
    if (point.centile < last.centile) Object.assign(last, point);
  } else {
    legendes.push({ ...point });
  }
}

const vert = (text) => `\x1b[32m${text}\x1b[0m`;
const rouge = (text) => `\x1b[31m${text}\x1b[0m`;
const pale = (text) => `\x1b[2m${text}\x1b[0m`;

console.log(`\nContraste des légendes contre du blanc — ${WIDTH}×${HEIGHT}\n`);
console.log(pale('  curseur   pire   5e centile   moyen'));
for (const entry of legendes) {
  const ok = entry.centile >= SEUIL;
  console.log(
    `  ${entry.t.toFixed(2).padStart(7)}  ${entry.pire.toFixed(1).padStart(5)}  ` +
      `${(ok ? vert : rouge)(entry.centile.toFixed(1).padStart(11))}  ` +
      `${entry.moyen.toFixed(1).padStart(6)}`,
  );
}

const ratees = legendes.filter((entry) => entry.centile < SEUIL);
console.log('');
if (legendes.length === 0) {
  console.log(rouge('Aucune légende mesurée : la visite s’est-elle chargée ?'));
} else if (ratees.length > 0) {
  console.log(rouge(`${ratees.length} légende(s) sous ${SEUIL}:1 sur plus de 5 % de leur fond.`));
} else {
  console.log(vert(`Les ${legendes.length} légendes tiennent ${SEUIL}:1 sur 95 % de leur fond.`));
}

await browser.close();
process.exit(ratees.length > 0 || legendes.length === 0 ? 1 : 0);
