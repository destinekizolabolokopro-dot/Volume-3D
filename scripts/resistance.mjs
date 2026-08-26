/**
 * Ce qui arrive quand la machine lâche.
 *
 * Une page en trois dimensions se juge aussi sur ses mauvais jours. Ce script
 * ne mesure pas la beauté : il provoque les deux pannes qui transforment une
 * visite en page morte, et vérifie qu'elles n'y arrivent pas.
 *
 *  1. **La perte du contexte graphique.** Le pilote reprend la carte — veille,
 *     bascule entre deux processeurs graphiques sur un portable, plantage du
 *     processus, onglet oublié en arrière-plan. Sans écoute, le canevas reste
 *     vide pour toujours. On la déclenche pour de vrai, par l'extension
 *     `WEBGL_lose_context`, et on regarde la page se rendre à nouveau.
 *
 *  2. **La machine trop lente.** On force le palier le plus bas — sans éclat,
 *     sans profondeur de champ, sans ombres portées — et on vérifie qu'il
 *     reste une image, et une image juste : ni noire, ni blanche, ni figée.
 *
 * Ces deux-là ne se voient jamais en développement, sur une machine de
 * développement. C'est précisément pour cela qu'elles ont leur script.
 *
 *   npm run resistance
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';
import sharp from 'sharp';

const { chromium } = pw;
const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTE = process.env.ROUTE || '/residence';
const WIDTH = Number(process.env.W || 1280);
const HEIGHT = Number(process.env.H || 800);
const VERT = '\x1b[32m';
const ROUGE = '\x1b[31m';
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
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') erreurs.push(m.text());
});

await page.goto(BASE + ROUTE, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForSelector('.rz-fond canvas', { timeout: 60000 });
/*
 * La scène finit sa construction d'un coup.
 *
 * Depuis que les matières et les sondes sont étalées sur les images pour ne
 * plus figer la page, une capture prise « quand le canevas est là » photographie
 * une scène encore uniforme — et sous rendu logiciel, où une image coûte des
 * secondes, la file ne se viderait jamais. `finir()` la vide en une fois.
 */
await page.evaluate(() => (window.oriel)?.finir?.());
await page.waitForSelector('.rz-fond [data-pret="1"]', { timeout: 60000 }).catch(() => {});

/* Le premier rendu est lancé par le défilement ou au bout d'une seconde et
   demie ; sous rendu logiciel il faut compter large. */
await page.waitForTimeout(Number(process.env.POSE || 14000));

const ennuis = [];
const dire = (ok, texte) => {
  console.log(`  ${ok ? VERT + 'ok  ' + FIN : ROUGE + 'NON ' + FIN} ${texte}`);
  if (!ok) ennuis.push(texte);
};

/*
 * L'image a-t-elle du contenu ?
 *
 * Pas en relisant le canevas : un contexte WebGL créé sans
 * `preserveDrawingBuffer` — et il ne faut surtout pas l'activer, cela coûte une
 * copie par image — a son tampon vidé dès qu'il est composé à l'écran. Un
 * `drawImage` du canevas rend alors du noir uniforme, et le script annonce une
 * page morte sur une page parfaitement vivante. C'est arrivé, et cinq lignes
 * de conclusions fausses en sont sorties.
 *
 * On passe donc par la capture du navigateur, qui, elle, lit ce qui est
 * réellement affiché.
 */
async function vivante() {
  const image = await page.locator('.rz-fond').screenshot({ type: 'png', timeout: 90000 });
  const { data, info } = await sharp(image)
    .resize(160, 100, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let somme = 0;
  let carre = 0;
  const vus = new Set();
  const n = info.width * info.height;
  for (let i = 0; i < n; i += 1) {
    const r = data[i * 3];
    const v = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const l = 0.2126 * r + 0.7152 * v + 0.0722 * b;
    somme += l;
    carre += l * l;
    vus.add((r >> 3) * 1024 + (v >> 3) * 32 + (b >> 3));
  }
  const moyenne = somme / n;
  return {
    present: true,
    lisible: true,
    moyenne,
    ecart: Math.sqrt(Math.max(0, carre / n - moyenne * moyenne)),
    teintes: vus.size,
  };
}

console.log(`\n  ${ROUTE} — résistance\n`);

const depart = await vivante();
dire(depart.present && depart.lisible, 'le canevas rend une image au départ');
dire((depart.ecart ?? 0) > 6, `l'image a du contenu (écart-type ${(depart.ecart ?? 0).toFixed(1)})`);
dire((depart.teintes ?? 0) > 40, `l'image a des couleurs (${depart.teintes} teintes distinctes)`);

/* ------------------------------------------------ 1. perte du contexte --- */

const perte = await page.evaluate(() => {
  const canvas = document.querySelector('.rz-fond canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const ext = gl && gl.getExtension('WEBGL_lose_context');
  if (!ext) return 'sans extension';
  /*
   * Un mouchard, posé après les écoutes de la page.
   *
   * Il vérifie la seule chose que la suite du test ne peut pas vérifier : que
   * l'événement de perte est bien **neutralisé**. C'est cet appel, et lui
   * seul, qui autorise le navigateur à rendre le contexte de lui-même après
   * une veille ou une bascule de carte ; le reste du script, lui, provoque la
   * restauration à la main et passerait donc tout aussi bien sans.
   *
   * Une précision honnête, mesurée en retirant la ligne : c'est three.js qui
   * appelle `preventDefault`, dans sa propre écoute, avant la nôtre. Ce
   * contrôle ne prouve donc pas que *notre* code le fait — il prouve que la
   * page, telle qu'elle est livrée, laisse au navigateur le droit de
   * restaurer. C'est ce qui compte pour le visiteur, et c'est ce qui casserait
   * si l'on changeait un jour de bibliothèque de rendu.
   */
  window.__empeche = null;
  canvas.addEventListener('webglcontextlost', (evenement) => {
    window.__empeche = evenement.defaultPrevented;
  });
  ext.loseContext();
  window.__rendreLeContexte = () => ext.restoreContext();
  return 'perdu';
});

if (perte === 'sans extension') {
  dire(false, 'le navigateur de test ne sait pas simuler la perte de contexte');
} else {
  await page.waitForTimeout(1500);
  const empeche = await page.evaluate(() => window.__empeche);
  dire(
    empeche === true,
    'l’événement de perte est neutralisé — sans quoi le navigateur ne restaure jamais',
  );
  const etat = await page.getAttribute('.rz-fond > div', 'data-etat').catch(() => null);
  dire(
    etat === 'sansGL',
    `à la perte du contexte, la scène repasse au dégradé (data-etat = ${etat})`,
  );

  await page.evaluate(() => window.__rendreLeContexte());
  /* La reconstruction refait la scène entière : géométrie, carte
     d'environnement, cibles de rendu. Sous rendu logiciel, c'est long. */
  await page.waitForTimeout(Number(process.env.REPRISE || 22000));
  const apres = await vivante();
  const etat2 = await page.getAttribute('.rz-fond > div', 'data-etat').catch(() => null);
  dire(etat2 === 'vivant', `au retour du contexte, la scène se reconstruit (data-etat = ${etat2})`);
  dire((apres.ecart ?? 0) > 6, `et elle rend à nouveau (écart-type ${(apres.ecart ?? 0).toFixed(1)})`);
}

/* ------------------------------------------------------ 2. palier bas --- */

const bas = await page.evaluate(() => {
  const o = window.oriel;
  if (!o || !o.forcerPalier) return false;
  o.forcerPalier(3);
  return true;
});
if (!bas) {
  dire(false, 'la poignée `oriel.forcerPalier` manque : le palier bas n\'est pas testable');
} else {
  await page.waitForTimeout(8000);
  const plancher = await vivante();
  dire(
    (plancher.ecart ?? 0) > 6,
    `au palier le plus bas, il reste une image (écart-type ${(plancher.ecart ?? 0).toFixed(1)})`,
  );
  dire(
    (plancher.moyenne ?? 0) > 8 && (plancher.moyenne ?? 255) < 247,
    `et elle est exposée (luminance moyenne ${(plancher.moyenne ?? 0).toFixed(0)})`,
  );
}

console.log('');
if (erreurs.length) {
  console.log('  Erreurs de console :');
  for (const e of erreurs.slice(0, 8)) console.log(`    ${e}`);
  ennuis.push('des erreurs de console');
} else {
  console.log('  Aucune erreur de console.');
}

await browser.close();
console.log('');
if (ennuis.length) {
  console.log(`${ROUGE}${ennuis.length} point(s) à reprendre.${FIN}\n`);
  process.exit(1);
}
console.log(`${VERT}La page tient sur ses mauvais jours.${FIN}\n`);
