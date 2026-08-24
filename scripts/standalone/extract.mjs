import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Extraction du site rendu vers un fichier unique.
 *
 * On ne réécrit pas le site à la main : on prend le HTML que le serveur produit
 * réellement, la feuille de style qu'il sert, et on remplace chaque adresse de
 * fichier par son contenu. Ce qui sort ne peut donc pas diverger du produit.
 */

const OUT = process.env.V3D_BUILD_DIR || '.standalone-build';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.V3D_BASE || 'http://localhost:3000';
const db = JSON.parse(fs.readFileSync('.data/db.json', 'utf8'));
// Le bien de démonstration : le premier publié.
const pub = db.properties.find((p) => p.status === 'published');

const browser = await chromium.launch({
  // `V3D_CHROMIUM` sert quand le navigateur est déjà installé ailleurs que là
  // où Playwright l'attend — c'est le cas de la plupart des environnements
  // d'intégration continue, qui le fournissent à une autre version.
  executablePath: process.env.V3D_CHROMIUM || undefined,
  // Le rendu WebGL passe par le processeur sur une machine sans carte
  // graphique : le résultat est le même, la vitesse non.
  args: ['--enable-unsafe-swiftshader'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

/** Toutes les adresses de fichiers rencontrées, tous écrans confondus. */
const seen = new Set();
page.on('request', (r) => {
  const u = r.url();
  if (u.startsWith(BASE) && /\.(jpe?g|png|webp|svg|woff2?|mp4|webm)(\?|$)/i.test(u)) {
    seen.add(u.slice(BASE.length));
  }
});

/** Feuilles rencontrées, dans l'ordre, sans doublon. */
const sheets = [];

/** Récupère le HTML du corps après hydratation, scripts retirés. */
async function snapshot(url, prepare) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200);
  if (prepare) await prepare(page);
  // Next découpe la feuille par route : il faut la relever sur chaque écran,
  // sans quoi la page d'accueil arrive sans sa mise en page.
  for (const href of await page.evaluate(() =>
    [...document.styleSheets].map((s) => s.href).filter(Boolean))) {
    if (!sheets.includes(href)) sheets.push(href);
  }
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script, next-route-announcer, [id^="__next"]').forEach((el) => {
      if (el.tagName === 'SCRIPT') el.remove();
    });
    return clone.innerHTML;
  });
}

// --- 1. la page d'accueil ---
const accueil = await snapshot('/');
console.log('accueil', accueil.length);

/* --- 2. l'annonce de démonstration ---
   Elle porte la maison : le plan, la visite au défilement, et surtout tout ce
   qu'une annonce affiche autour — prix, capacité, équipements. C'est la page
   que le lien « Annonce type » de la barre de navigation vise, et sans elle ce
   lien ne mènerait nulle part dans ce fichier. */
const maison = await snapshot('/maison');
console.log('maison', maison.length);

// --- 3. la visite publique ---
const visite = await snapshot(`/v/${pub.slug}`);
console.log('visite', visite.length);

// --- 4. l'espace du propriétaire (connexion préalable) ---
await page.goto(`${BASE}/espace/connexion`, { waitUntil: 'domcontentloaded' });
await page.fill('input[type=email]', process.env.V3D_EMAIL || 'marc@example.fr');
await page.fill('input[type=password]', process.env.V3D_PASSWORD || 'demo1234');
await page.click('button[type=submit]');
await page.waitForTimeout(2000);
const espace = await snapshot(`/espace/biens/${pub.id}`);
console.log('espace', espace.length);
const tableau = await snapshot('/espace');
console.log('tableau', tableau.length);

// --- 5. les feuilles de style servies, tous écrans confondus ---
const hrefs = sheets;
let css = '';
for (const href of hrefs) {
  const res = await page.request.get(href);
  css += '\n/* ' + href.split('/').pop() + ' */\n' + (await res.text());
}
console.log('css', css.length, 'octets depuis', hrefs.length, 'feuilles');

// --- 6. les fichiers ---
// On déclenche le chargement des panoramas restants pour les capturer aussi.
for (const p of ['/demo/salon.jpg', '/demo/chambre.jpg', '/demo/salle-de-bain.jpg', '/demo/poster.jpg', '/demo/visite.webm']) {
  seen.add(p);
}
for (const s of db.scenes) seen.add(s.imageUrl);
for (const ph of db.photos) seen.add(ph.url);
// les polices citées dans la css
for (const m of css.matchAll(/url\((\/[^)"']+\.woff2?)\)/g)) seen.add(m[1]);
for (const m of css.matchAll(/url\(["'](\/[^)"']+)["']\)/g)) seen.add(m[1]);

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const assets = {};
let total = 0;
for (const url of [...seen].sort()) {
  const clean = url.split('?')[0];
  const ext = path.extname(clean).toLowerCase();
  const mime = MIME[ext];
  if (!mime) continue;
  let res;
  try { res = await page.request.get(BASE + clean); } catch { console.log('échec', clean); continue; }
  if (!res.ok()) { console.log('absent', clean, res.status()); continue; }
  let buf = Buffer.from(await res.body());

  // Les panoramas font 4096 px de large : inutile ici, et impossible à embarquer.
  if (/\.(jpe?g|png)$/i.test(clean)) {
    const meta = await sharp(buf).metadata();
    if (meta.width > 2048) {
      buf = await sharp(buf).resize({ width: 2048 }).jpeg({ quality: 74, progressive: true }).toBuffer();
    } else if (buf.length > 120_000) {
      buf = await sharp(buf).jpeg({ quality: 76 }).toBuffer();
    }
  }
  assets[clean] = `data:${mime};base64,${buf.toString('base64')}`;
  total += buf.length;
  console.log(String(Math.round(buf.length / 1024)).padStart(5), 'Ko', clean);
}
console.log('TOTAL fichiers', Math.round(total / 1024), 'Ko');

fs.writeFileSync(
  `${OUT}/extrait.json`,
  JSON.stringify({ css, assets, screens: { accueil, maison, visite, espace, tableau }, slug: pub.slug }),
);
console.log('extrait.json', Math.round(fs.statSync(`${OUT}/extrait.json`).size / 1024), 'Ko');

await browser.close();
