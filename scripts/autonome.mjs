/**
 * Le fichier autonome, éprouvé comme un visiteur l'ouvrirait.
 *
 * `npm run oriel` fabrique le fichier ; rien ne disait qu'il **marche**. Un
 * fichier d'un seul tenant se casse d'une façon qu'un serveur de
 * développement ne montre jamais : ouvert en `file://`, il n'a plus d'origine,
 * donc plus de requête possible — une fonte oubliée, une image restée en lien,
 * un module qui tente un `fetch` relatif, et la page sort blanche chez celui à
 * qui on vient de l'envoyer.
 *
 * On l'ouvre donc par son chemin de fichier, on attend, et on regarde s'il y
 * a une image.
 *
 *   node scripts/autonome.mjs
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pw from 'playwright';
import sharp from 'sharp';

const { chromium } = pw;
const FICHIER = resolve(process.env.FICHIER || 'docs/oriel.html');
const SORTIE = process.env.SORTIE || 'captures/autonome.png';
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

const ennuis = [];
const dire = (ok, texte) => {
  console.log(`  ${ok ? VERT + 'ok  ' + FIN : ROUGE + 'NON ' + FIN} ${texte}`);
  if (!ok) ennuis.push(texte);
};

if (!existsSync(FICHIER)) {
  console.log(`\n  ${ROUGE}${FICHIER} n'existe pas — lancer d'abord npm run oriel.${FIN}\n`);
  process.exit(1);
}

const poids = statSync(FICHIER).size;
console.log(`\n  ${FICHIER}\n  ${(poids / 1024 / 1024).toFixed(2)} Mo\n`);

const browser = await chromium.launch({
  executablePath: navigateur(),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const erreurs = [];
const dehors = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') erreurs.push(m.text());
});
/* La vraie question de ce test : le fichier demande-t-il quoi que ce soit à
   l'extérieur ? En `file://`, toute requête réseau est un défaut de
   fabrication — et c'est exactement ce qu'on veut attraper avant l'envoi. */
page.on('request', (r) => {
  const url = r.url();
  if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:')) {
    dehors.push(url);
  }
});

await page.goto('file://' + FICHIER, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(Number(process.env.POSE || 20000));

dire(dehors.length === 0, `le fichier ne demande rien au réseau (${dehors.length} requête(s) sortante(s))`);
for (const url of dehors.slice(0, 5)) console.log(`         ${url}`);

const canevas = await page.locator('canvas').count();
dire(canevas > 0, `la scène a monté un canevas (${canevas})`);

await page.screenshot({ path: SORTIE, timeout: 90000 });
const { data, info } = await sharp(SORTIE)
  .resize(160, 100, { fit: 'fill' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let somme = 0;
let carre = 0;
const n = info.width * info.height;
for (let i = 0; i < n; i += 1) {
  const l = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
  somme += l;
  carre += l * l;
}
const moyenne = somme / n;
const ecart = Math.sqrt(Math.max(0, carre / n - moyenne * moyenne));
dire(ecart > 6, `l'image a du contenu (écart-type ${ecart.toFixed(1)})`);
dire(moyenne > 8 && moyenne < 247, `et elle est exposée (luminance moyenne ${moyenne.toFixed(0)})`);

/* La fonte : sans elle, la page se rabat sur un sans-sérif du système et le
   titre change de largeur. C'est le premier symptôme d'un fichier mal cousu. */
const fonte = await page.evaluate(() => {
  const titre = document.querySelector('h1, h2');
  return titre ? getComputedStyle(titre).fontFamily : '';
});
dire(/Inter/i.test(fonte), `le titre utilise la fonte embarquée (${fonte || 'aucun titre'})`);

/*
 * Le texte, tel qu'on le copie et tel qu'on l'entend.
 *
 * On relève `innerText` et non le balisage, et on cherche le titre **avec ses
 * espaces**. C'est ce contrôle-là qui a trouvé que les mots des grands titres
 * étaient collés : l'animation mot par mot posait chaque mot dans un
 * `inline-block` et laissait une marge faire l'espace. À l'écran, rien à dire.
 * Au copier-coller, au lecteur d'écran, au moteur de recherche et au
 * traducteur : « Centsoixante-dixmètrescarrés ».
 */
const texte = await page.evaluate(() => document.body.innerText);
dire(/mètres carrés/.test(texte), 'les mots des titres sont séparés par de vraies espaces');
dire(/170,4|m²/.test(texte), 'les chiffres de l’annonce sont là');

console.log('');
if (erreurs.length) {
  console.log('  Erreurs de console :');
  for (const e of erreurs.slice(0, 6)) console.log(`    ${e}`);
  ennuis.push('des erreurs de console');
} else {
  console.log('  Aucune erreur de console.');
}
console.log(`  Capture : ${SORTIE}`);

await browser.close();
console.log('');
if (ennuis.length) {
  console.log(`${ROUGE}${ennuis.length} point(s) à reprendre.${FIN}\n`);
  process.exit(1);
}
console.log(`${VERT}Le fichier se suffit à lui-même.${FIN}\n`);
