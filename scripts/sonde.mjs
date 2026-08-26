/**
 * Ce qu'il y a derrière un pixel.
 *
 * Un rendu ne se débogue pas à l'œil. Quand une image montre quelque chose
 * d'inexplicable — une tache irisée au plafond, un aplat là où l'on avait
 * modélisé un atrium — la seule question utile est « qu'est-ce que la caméra
 * touche, à cet endroit, et à quelle distance ». Ce script la pose.
 *
 * Il ouvre la page, va à la section demandée, attend que la caméra ait posé,
 * puis lance un rayon par point d'une grille et rapporte, pour chacun : le
 * nom de l'objet touché, sa distance, et la couleur du matériau. Une case
 * vide veut dire « rien » — donc le ciel, donc un trou.
 *
 *   npm run sonde
 *   SECTION=#sejour COLONNES=9 LIGNES=7 npm run sonde
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';

const { chromium } = pw;
const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTE = process.env.ROUTE || '/residence';
const SECTION = process.env.SECTION || '#sejour';
const ECRAN = Number(process.env.ECRAN || 0);
const COLONNES = Number(process.env.COLONNES || 9);
const LIGNES = Number(process.env.LIGNES || 7);
const WIDTH = Number(process.env.W || 1440);
const HEIGHT = Number(process.env.H || 900);

function navigateur() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const dossier = readdirSync(racine).filter((n) => n.startsWith('chromium-')).sort().pop();
  if (!dossier) return undefined;
  const binaire = join(racine, dossier, 'chrome-linux', 'chrome');
  return existsSync(binaire) ? binaire : undefined;
}

const browser = await chromium.launch({
  executablePath: navigateur(),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForSelector('.rz-fond canvas', { timeout: 60000 });
await page.evaluate(
  ([sel, ecran]) => {
    const n = document.querySelector(sel);
    window.scrollTo({ top: n.getBoundingClientRect().top + window.scrollY + ecran * window.innerHeight, behavior: 'instant' });
  },
  [SECTION, ECRAN],
);
/* Sous rendu logiciel, une image coûte deux secondes et demie : trois secondes
   d'attente laissent la caméra à mi-chemin, et la sonde répond alors très
   précisément sur le plan précédent. C'est arrivé une fois — la grille de la
   chambre décrivait le séjour — et rien dans le résultat ne le disait. */
await page.waitForTimeout(Number(process.env.POSE || 15000));

const grille = await page.evaluate(
  ([colonnes, lignes]) => {
    const lignesTexte = [];
    for (let j = 0; j < lignes; j += 1) {
      const y = 1 - (2 * (j + 0.5)) / lignes;
      const cases = [];
      for (let i = 0; i < colonnes; i += 1) {
        const x = -1 + (2 * (i + 0.5)) / colonnes;
        const t = window.oriel.sonder(x, y);
        cases.push(t ? `${t.couleur ?? '—'} ${String(t.distance).padStart(6)}m ${t.nom}` : 'ciel');
      }
      lignesTexte.push(cases);
    }
    return lignesTexte;
  },
  [COLONNES, LIGNES],
);

console.log(`\n  ${ROUTE} ${SECTION} +${ECRAN} — ${COLONNES}x${LIGNES}\n`);
for (const [j, ligne] of grille.entries()) {
  console.log(`  ligne ${j} (haut→bas)`);
  for (const [i, c] of ligne.entries()) console.log(`    col ${i}  ${c}`);
}
console.log();
await browser.close();
