/**
 * Les matières, vues de près.
 *
 * On ne juge pas une texture dans une scène : à trois mètres, sous une lumière
 * rasante, derrière une profondeur de champ, tout se ressemble. Les réglages
 * des matières ont été faits ainsi pendant deux passes, et cela se voyait —
 * un parquet dont les lames ne s'arrêtaient jamais, un marbre dont les veines
 * étaient des taches, un béton lisse comme du papier.
 *
 * Ce script sort une planche contact : chaque famille, ses trois cartes côte à
 * côte, à leur taille réelle. Les canevas d'origine sont accessibles par la
 * poignée de scène — une `CanvasTexture` garde son canevas dans `image` — donc
 * il n'y a rien à recalculer : on regarde exactement ce que la carte graphique
 * reçoit.
 *
 *   npm run matieres
 */

import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pw from 'playwright';

const { chromium } = pw;
const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTE = process.env.ROUTE || '/residence';
const SORTIE = process.env.SORTIE || 'captures/matieres.png';

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
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForSelector('.rz-fond canvas', { timeout: 60000 });
/* La planche contact ne vaut que sur des cartes finies : depuis que la
   construction est étalée sur les images, elles arrivent en deux secondes. */
await page.evaluate(() => window.oriel?.finir?.());
await page.waitForTimeout(Number(process.env.POSE || 12000));

const resultat = await page.evaluate(() => {
  const scene = window.oriel?.scene;
  if (!scene) return { erreur: 'pas de poignée de scène' };

  /* On collecte par matériau, pas par maillage : la scène est fusionnée, donc
     un matériau apparaît une fois et porte ses trois cartes. */
  const vues = new Map();
  scene.traverse((noeud) => {
    const m = noeud.material;
    if (!m) return;
    for (const materiau of Array.isArray(m) ? m : [m]) {
      if (!materiau.map || !materiau.map.image) continue;
      if (vues.has(materiau.uuid)) continue;
      vues.set(materiau.uuid, {
        couleur: materiau.color ? '#' + materiau.color.getHexString() : '—',
        rugosite: materiau.roughness ?? null,
        tuile: materiau.userData?.tuile ?? null,
        cartes: [materiau.map, materiau.roughnessMap, materiau.normalMap].filter(Boolean),
      });
    }
  });

  const familles = [...vues.values()];
  if (familles.length === 0) return { erreur: 'aucune matière trouvée' };

  const VIGNETTE = 220;
  const MARGE = 12;
  const LIGNE = VIGNETTE + MARGE * 2 + 22;
  const planche = document.createElement('canvas');
  planche.width = MARGE + 3 * (VIGNETTE + MARGE) + 200;
  planche.height = familles.length * LIGNE + MARGE;
  const ctx = planche.getContext('2d');
  ctx.fillStyle = '#14171b';
  ctx.fillRect(0, 0, planche.width, planche.height);
  ctx.font = '13px monospace';
  ctx.textBaseline = 'top';

  familles.forEach((f, i) => {
    const y = MARGE + i * LIGNE;
    f.cartes.forEach((carte, j) => {
      const x = MARGE + j * (VIGNETTE + MARGE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(carte.image, x, y, VIGNETTE, VIGNETTE);
      ctx.strokeStyle = '#3a4048';
      ctx.strokeRect(x + 0.5, y + 0.5, VIGNETTE, VIGNETTE);
      ctx.fillStyle = '#8b949e';
      ctx.fillText(['couleur', 'rugosité', 'relief'][j] ?? '', x, y + VIGNETTE + 4);
    });
    const x = MARGE + 3 * (VIGNETTE + MARGE);
    ctx.fillStyle = '#e6edf3';
    ctx.fillText(f.couleur, x, y + 4);
    ctx.fillStyle = '#8b949e';
    ctx.fillText(`rugosité ${f.rugosite?.toFixed(2)}`, x, y + 24);
    ctx.fillText(`${f.tuile} rép./m`, x, y + 44);
    ctx.fillText(`soit ${(1 / f.tuile).toFixed(2)} m par tuile`, x, y + 64);
    ctx.fillText(`${f.cartes[0].image.width} px`, x, y + 84);
  });

  return { image: planche.toDataURL('image/png'), combien: familles.length };
});

await browser.close();

if (resultat.erreur) {
  console.log(`\n  ${resultat.erreur}\n`);
  process.exit(1);
}
mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, Buffer.from(resultat.image.split(',')[1], 'base64'));
console.log(`\n  ${resultat.combien} matières → ${SORTIE}\n`);
