/**
 * Génère les panoramas de démonstration de la page d'accueil.
 *
 * La démonstration publique ne doit dépendre ni de la base de données ni du
 * logement d'un client : ce sont des fichiers fixes, versionnés avec le code,
 * identiques sur toutes les installations.
 *
 * Les images sont des équirectangulaires 2048 × 1024 dessinées au canevas, avec
 * la vraie géométrie d'une pièce parallélépipédique vue depuis son centre :
 * pour un cap donné, on calcule la distance au mur puis la hauteur angulaire du
 * plafond et du sol. Les lignes obtenues ondulent exactement comme sur un vrai
 * panorama, ce qui rend l'illustration crédible une fois plaquée sur la sphère.
 *
 * Prérequis (non installé par défaut, pour ne pas alourdir le déploiement) :
 *   npx playwright@1.62 install chromium
 * Utilisation :
 *   node scripts/generate-demo.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { ROOMS } from './demo-rooms.mjs';

const OUT = new URL('../public/demo/', import.meta.url);

// Le conteneur d'exécution embarque déjà Chromium : on l'utilise s'il est là,
// sinon Playwright prend le sien.
const bundled = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch(bundled ? { executablePath: bundled } : {});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.addScriptTag({ content: `window.__rooms = ${JSON.stringify(ROOMS)};` });
await page.addScriptTag({ path: new URL('./draw-room.js', import.meta.url).pathname });

await mkdir(OUT, { recursive: true });

for (const room of ROOMS) {
  const dataUrl = await page.evaluate((slug) => window.drawRoom(slug), room.slug);
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(new URL(`${room.slug}.jpg`, OUT), bytes);
  console.log(`${room.slug}.jpg — ${Math.round(bytes.length / 1024)} ko`);
}

await browser.close();
