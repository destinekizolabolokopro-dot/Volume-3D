/**
 * Ce que coûte la scène, mesuré.
 *
 * Ajouter du détail est facile ; savoir ce qu'on vient de payer l'est moins.
 * Ce script ouvre la visite dans un vrai navigateur et relève trois chiffres :
 *
 *  · les **triangles** et les **appels de dessin**, qui disent la complexité de
 *    la scène — ils ne dépendent ni de la machine ni de la résolution, donc ils
 *    se comparent d'une exécution à l'autre et d'un commit à l'autre ;
 *  · le **temps par image** en régime établi, qui dit ce que ça donne à
 *    l'écran — celui-ci dépend de la machine, et sous un rendu logiciel
 *    (SwiftShader, ici) il n'a de sens qu'en relatif.
 *
 * On regarde donc les deux : les triangles pour juger une modification, le
 * temps pour vérifier qu'on n'a pas franchi un ordre de grandeur.
 *
 *   npm run budget
 *   BASE=http://localhost:8983 npm run budget
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';

const { chromium } = pw;
const BASE = process.env.BASE || 'http://localhost:3000';
/* La page à mesurer. Il y a deux décors, et le second — la maison, avec son
   jardin, sa haie et sa ligne d'arbres — coûte plus cher que l'appartement :
   mesurer l'accueil et en conclure quelque chose sur `/maison` serait mesurer
   la mauvaise scène. `ROUTE=/maison npm run budget`. */
const ROUTE = process.env.ROUTE || '/';
const WIDTH = Number(process.env.W || 1280);
const HEIGHT = Number(process.env.H || 800);
/** Images mesurées une fois le régime établi. */
const IMAGES = Number(process.env.IMAGES || 90);

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

const browser = await chromium.launch({
  executablePath: navigateur(),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

/*
 * Le compteur est posé sur le contexte WebGL, pas sur three.js.
 *
 * `WebGLRenderer.info` porterait déjà les chiffres, mais il faudrait que la
 * page expose son renderer — donc modifier le produit pour le mesurer. En
 * enveloppant `drawElements` et `drawArrays` sur le prototype du contexte, on
 * compte les mêmes appels sans qu'une seule ligne du site ne le sache, et la
 * mesure vaudrait pour n'importe quel moteur.
 */
await page.addInitScript(() => {
  const compteur = { appels: 0, triangles: 0 };
  window.__budget = compteur;
  const proto = WebGLRenderingContext.prototype;
  const proto2 = window.WebGL2RenderingContext ? WebGL2RenderingContext.prototype : null;
  for (const cible of [proto, proto2]) {
    if (!cible) continue;
    const elements = cible.drawElements;
    cible.drawElements = function (mode, count, ...rest) {
      compteur.appels += 1;
      if (mode === this.TRIANGLES) compteur.triangles += count / 3;
      return elements.call(this, mode, count, ...rest);
    };
    const arrays = cible.drawArrays;
    cible.drawArrays = function (mode, first, count, ...rest) {
      compteur.appels += 1;
      if (mode === this.TRIANGLES) compteur.triangles += count / 3;
      return arrays.call(this, mode, first, count, ...rest);
    };
    if (cible.drawElementsInstanced) {
      const instances = cible.drawElementsInstanced;
      cible.drawElementsInstanced = function (mode, count, type, offset, primcount, ...rest) {
        compteur.appels += 1;
        if (mode === this.TRIANGLES) compteur.triangles += (count / 3) * primcount;
        return instances.call(this, mode, count, type, offset, primcount, ...rest);
      };
    }
  }
});

await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 30000 });
// De quoi laisser la scène se construire et le premier rendu passer.
await page.waitForTimeout(5000);

/*
 * On mesure **en défilant**.
 *
 * La boucle de rendu s'arrête quand rien ne bouge — c'est voulu, et c'est bien
 * pour la batterie du visiteur. Mais mesurée à l'arrêt, la scène ne coûte rien
 * et le chiffre ne veut rien dire. On fait donc descendre la page d'un bout à
 * l'autre de la visite pendant la mesure : c'est le coût de l'expérience réelle
 * qu'on relève, celui du moment où la caméra traverse le logement.
 */
const relevé = await page.evaluate(async (images) => {
  const canvas = document.querySelector('canvas');
  const section = document.querySelector('#visite section') || document.querySelector('#visite');
  if (!canvas || !section) return null;
  const haut = section.getBoundingClientRect().top + scrollY;
  const course = section.offsetHeight - innerHeight;

  const compteur = window.__budget;
  const depart = { appels: compteur.appels, triangles: compteur.triangles };
  const temps = [];
  await new Promise((resolve) => {
    let index = 0;
    let precedent = performance.now();
    const tick = () => {
      window.scrollTo({ top: Math.round(haut + (index / images) * course), behavior: 'instant' });
      const now = performance.now();
      if (index > 0) temps.push(now - precedent);
      precedent = now;
      index += 1;
      if (index <= images) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  temps.sort((a, b) => a - b);

  /*
   * Les appels sont comptés sur toute la fenêtre : on les ramène à une image,
   * seule unité comparable d'un commit à l'autre.
   *
   * Une réserve, apprise en croyant à une régression qui n'existait pas : c'est
   * une **moyenne sur le trajet parcouru**, et le trajet dépend de la vitesse à
   * laquelle la machine rend. La caméra est amortie ; à quatre-vingt-dix
   * images, une machine chargée la fait moins avancer, donc la mesure porte sur
   * une autre portion du logement, où le tri par le tronc de vue ne garde pas
   * les mêmes objets. Un relevé pris pendant qu'une autre mesure tournait a
   * ainsi donné cinquante-sept appels au lieu de quarante-neuf, sans qu'une
   * ligne de la scène ait changé.
   *
   * À ne comparer qu'entre relevés pris seuls sur la machine.
   */
  return {
    largeur: canvas.width,
    hauteur: canvas.height,
    // La résolution de rendu s'adapte à la machine : on relève celle qui a
    // effectivement servi, sinon deux mesures ne se comparent pas.
    echelle: canvas.width / (canvas.clientWidth * devicePixelRatio),
    appels: (compteur.appels - depart.appels) / images,
    triangles: (compteur.triangles - depart.triangles) / images,
    median: temps[Math.floor(temps.length / 2)],
    p95: temps[Math.floor(temps.length * 0.95)],
  };
}, IMAGES);

if (!relevé) {
  console.error('Aucun canevas trouvé : le serveur tourne-t-il sur ' + BASE + ROUTE + ' ?');
  await browser.close();
  process.exit(1);
}

const pale = (t) => `\x1b[2m${t}\x1b[0m`;
console.log(`\nBudget de rendu — ${WIDTH}×${HEIGHT}, ${IMAGES} images\n`);
const nombre = (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
console.log(`  canevas          ${relevé.largeur} × ${relevé.hauteur} pixels physiques`);
console.log(`  échelle rendu    ${(relevé.echelle * 100).toFixed(0)} % de ce que l’écran demande`);
console.log(`  appels/image     ${nombre(relevé.appels)}`);
console.log(`  triangles/image  ${nombre(relevé.triangles)}`);
console.log(`  image médiane    ${relevé.median.toFixed(1)} ms`);
console.log(`  image 95e c.     ${relevé.p95.toFixed(1)} ms`);
console.log(pale('\n  Rendu logiciel : ces temps ne valent qu’en relatif, d’un commit à l’autre.'));

await browser.close();
