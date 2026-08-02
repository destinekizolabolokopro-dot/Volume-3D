/**
 * Enregistre la vidéo de démonstration de la page d'accueil.
 *
 * On ne filme pas une maquette : le script pilote la visite réelle, celle qui
 * est déjà sur la page d'accueil, avec les mêmes commandes que celles qu'aura
 * le voyageur. Ce qui est montré ne peut donc pas diverger du produit.
 *
 * Le temps de l'enregistrement, une feuille de style masque tout sauf le cadre
 * de la visite et l'étale sur la fenêtre : c'est le seul artifice, et il ne
 * touche pas au code du site.
 *
 * Prérequis :
 *   npx playwright@1.62 install chromium
 *   un serveur lancé sur BASE (par défaut http://localhost:3000)
 * Utilisation :
 *   node scripts/record-demo.mjs
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.DEMO_URL ?? 'http://localhost:3000';
const OUT = fileURLToPath(new URL('../public/demo/', import.meta.url));
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const SIZE = { width: 1280, height: 800 };

/** Masque la page autour de la visite, le temps de la prise de vue. */
const STAGE_CSS = `
  .nav, .nav-sheet, .sec, .cta-band, .foot, .skip-link { display: none !important; }
  .hero { padding: 0 !important; }
  .hero-grid { display: block !important; }
  .hero-grid > div:first-child { display: none !important; }
  .wrap { max-width: none !important; padding: 0 !important; }
  .frame { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
  .frame-bar, .frame-note { display: none !important; }
  .frame-body { aspect-ratio: auto !important; height: 100vh !important; }
  body { overflow: hidden !important; }
`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Glissement lent et régulier : une caméra, pas un coup de souris.
 *
 * La progression est calée sur l'horloge, pas sur un nombre d'étapes : chaque
 * ordre de souris passe par le protocole de débogage, dont la latence varie
 * avec la charge de la machine. Compter les étapes donnerait un mouvement dont
 * la durée dépendrait du matériel.
 */
async function pan(page, dx, dy, ms = 2600) {
  const x = SIZE.width / 2;
  const y = SIZE.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const start = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / ms);
    // Accélération puis décélération, comme un mouvement de tête.
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(x + dx * eased, y + dy * eased);
    if (t >= 1) break;
  }
  await page.mouse.up();
}

const bundled = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch({
  ...(bundled ? { executablePath: bundled } : {}),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

const dir = await mkdtemp(join(tmpdir(), 'volume3d-demo-'));
const context = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  recordVideo: { dir, size: SIZE },
});
// La feuille est posée avant le premier rendu : injectée après coup, elle
// laisserait passer une seconde de page complète au début de l'enregistrement.
await context.addInitScript((css) => {
  const style = document.createElement('style');
  style.textContent = css;
  document.addEventListener('DOMContentLoaded', () => document.head.append(style));
}, STAGE_CSS);

const page = await context.newPage();

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
// Le panorama se charge et son fondu d'apparition se termine.
await page.waitForSelector('canvas');
await wait(2200);

/* -------------------------------------------------------------- scénario --- */

// Salon : on regarde autour de soi, doucement, dans les deux sens.
await pan(page, -560, 0, 5400);
await wait(900);
await pan(page, 320, -60, 3200);
await wait(700);
await pan(page, 260, 50, 2800);
await wait(900);

// On passe dans la chambre, puis dans la salle de bain, par la barre des pièces.
for (const [room, sweep] of [
  ['Chambre', -480],
  ['Salle de bain', 420],
]) {
  const chip = page.locator('[class*="roomChip"]', { hasText: room }).first();
  if (!(await chip.count())) continue;
  await chip.click();
  await wait(2600);
  await pan(page, sweep, 0, 4600);
  await wait(700);
  await pan(page, -sweep * 0.5, 0, 2400);
  await wait(1200);
}

await context.close();
await browser.close();

/* -------------------------------------------------------------- encodage --- */

const [recorded] = (await readdir(dir)).filter((f) => f.endsWith('.webm'));
const source = join(dir, recorded);

// Le tout premier instant de la capture montre encore la page en cours de
// composition : on le coupe.
const LEAD_IN = '1.6';

// MP4 pour Safari et les téléphones, WebM pour le reste. `faststart` place
// l'index en tête du fichier : la lecture démarre sans télécharger le tout.
execFileSync(FFMPEG, [
  '-y', '-ss', LEAD_IN, '-i', source,
  '-vf', 'scale=1280:-2,fps=30',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
  join(OUT, 'visite.mp4'),
], { stdio: 'inherit' });

execFileSync(FFMPEG, [
  '-y', '-ss', LEAD_IN, '-i', source,
  '-vf', 'scale=1280:-2,fps=30',
  '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-an',
  join(OUT, 'visite.webm'),
], { stdio: 'inherit' });

// Vignette : une image nette du salon, prise une fois le fondu terminé.
execFileSync(FFMPEG, [
  '-y', '-ss', '4', '-i', source,
  '-frames:v', '1', '-update', '1', '-vf', 'scale=1280:-2', '-q:v', '4',
  join(OUT, 'poster.jpg'),
], { stdio: 'inherit' });

await rm(dir, { recursive: true, force: true });
console.log('visite.mp4, visite.webm et poster.jpg écrits dans public/demo/');
