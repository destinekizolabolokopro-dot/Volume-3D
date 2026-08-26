/**
 * Ce que coûte le démarrage.
 *
 * Le budget par image ne dit rien du chargement, et c'est pourtant là que se
 * joue l'impression de « ça rame » : la scène se construit sur le fil
 * principal, en une fois, et pendant ce temps la page ne répond plus. Rien ne
 * bouge, le premier écran reste figé, et le visiteur en conclut ce qu'il veut.
 *
 * Ce script mesure trois choses :
 *
 *  - **le plus long blocage du fil principal**, relevé par l'observateur de
 *    tâches longues. C'est le chiffre qui compte : au-delà de deux cents
 *    millisecondes, une page cesse de répondre au défilement et à la souris ;
 *  - **le total bloqué** sur toute la construction ;
 *  - **le temps jusqu'à la première image**, et jusqu'à ce que le flou
 *    d'ouverture se lève.
 *
 * On mesure sous rendu logiciel, donc les valeurs absolues ne valent rien —
 * seules comptent les comparaisons d'un commit à l'autre, et le **rapport**
 * entre les postes, qui lui est juste.
 *
 *   npm run demarrage
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';

const { chromium } = pw;
const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTE = process.env.ROUTE || '/residence';
const VERT = '\x1b[32m';
const ROUGE = '\x1b[31m';
const GRIS = '\x1b[2m';
const FIN = '\x1b[0m';

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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

/* L'observateur est posé **avant** la navigation : les tâches longues de la
   construction commencent avant que le premier script de la page ne tourne. */
await page.addInitScript(() => {
  window.__taches = [];
  try {
    new PerformanceObserver((liste) => {
      for (const e of liste.getEntries()) window.__taches.push({ debut: e.startTime, duree: e.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch {}
});

const depart = Date.now();
await page.goto(BASE + ROUTE, { waitUntil: 'commit', timeout: 120000 });
await page.waitForSelector('.rz-fond canvas', { timeout: 90000 });
const versCanevas = Date.now() - depart;
await page.waitForSelector('.rz-fond [data-etat="vivant"]', { timeout: 90000 }).catch(() => {});
const versVivant = Date.now() - depart;
await page.waitForSelector('.rz-fond [data-net="1"]', { timeout: 90000 }).catch(() => {});
const versNet = Date.now() - depart;

/* On laisse la construction finir : sondes d'environnement, carte d'ombre,
   première image. */
await page.waitForTimeout(Number(process.env.POSE || 22000));

const taches = await page.evaluate(() => window.__taches ?? []);
const total = taches.reduce((s, t) => s + t.duree, 0);
const plusLongue = taches.reduce((m, t) => Math.max(m, t.duree), 0);
const grosses = taches.filter((t) => t.duree > 200).sort((a, b) => b.duree - a.duree).slice(0, 6);

console.log(`\n  ${ROUTE} — démarrage\n`);
console.log(`  canevas présent      ${versCanevas} ms`);
console.log(`  scène vivante        ${versVivant} ms`);
console.log(`  flou levé            ${versNet} ms`);
console.log('');
console.log(`  tâches longues       ${taches.length}`);
console.log(`  total bloqué         ${Math.round(total)} ms`);
console.log(`  plus long blocage    ${Math.round(plusLongue)} ms`);
if (grosses.length) {
  console.log(`${GRIS}  les plus longues :${FIN}`);
  for (const t of grosses) console.log(`    ${Math.round(t.duree).toString().padStart(6)} ms  à ${Math.round(t.debut)} ms`);
}
console.log('');
const verdict = plusLongue > 900 ? ROUGE : plusLongue > 400 ? GRIS : VERT;
console.log(
  `${verdict}Le plus long blocage vaut ${Math.round(plusLongue)} ms.${FIN}` +
    `${GRIS}  (sous rendu logiciel — à comparer d'un commit à l'autre)${FIN}\n`,
);

await browser.close();
