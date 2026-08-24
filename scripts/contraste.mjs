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
/* La page à mesurer. Deux décors, deux fonds : les légendes de la maison se
   détachent sur un couloir clair et un jardin, celles de l'appartement sur des
   murs de pierre. Mesurer l'un ne dit rien de l'autre.
   `ROUTE=/maison npm run contraste`. */
const ROUTE = process.env.ROUTE || '/';
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
/*
 * Trente secondes ne suffisent plus.
 *
 * C'est le délai par défaut de Playwright, et il a tenu tant que la mesure ne
 * portait que sur l'appartement : quarante-neuf appels de dessin, une image
 * toutes les sept dixièmes de seconde en rendu logiciel. La maison en demande le
 * double et rend une image toutes les quatre secondes et demie — une capture,
 * qui attend une image stable, y dépasse la minute. L'outil s'arrêtait alors sur
 * un dépassement de délai, c'est-à-dire sur ce qui ressemble à une panne et n'en
 * est pas une.
 *
 * Le délai est donc dimensionné sur la scène la plus lourde, et réglable pour
 * une machine plus lente encore.
 */
page.setDefaultTimeout(Number(process.env.DELAI || 180000));
await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
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
   *
   * Le même piège s'est refermé une deuxième fois, et autrement : en ajoutant
   * la mesure de la barre de navigation, chaque pas s'est mis à prendre six
   * captures d'écran de plus. Une capture bloque la boucle de rendu, donc
   * l'intervalle entre deux images a grandi — et deux cent cinquante
   * millisecondes sont redevenues plus rapides qu'une image. Le relevé donnait
   * alors des légendes à 2,2:1 qui, une fois la page réellement stabilisée,
   * n'étaient pas affichées du tout. Deux exécutions ne donnaient pas le même
   * tableau, ce qui est la signature d'une mesure et non d'un défaut.
   *
   * On regarde donc **deux** signaux, et l'un d'eux est ce qu'on mesure : le
   * curseur amorti que porte la barre de progression, et l'opacité de la
   * légende la plus visible. Tant que le fondu court, la seconde bouge encore,
   * même quand la première est arrivée — et c'est exactement l'instant qu'il ne
   * faut pas photographier.
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
      let forte = 0;
      for (const node of document.querySelectorAll('[class*="caption"]')) {
        const value = Number(getComputedStyle(node).opacity);
        if (value > forte) forte = value;
      }
      return `${bar ? getComputedStyle(bar).transform : ''}|${forte.toFixed(4)}`;
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

/**
 * Les pixels d'une zone de l'écran, en RGB.
 *
 * Passer par le navigateur plutôt que par une bibliothèque d'images : la page
 * sait déjà décoder un PNG, et le script n'a pas à dépendre d'un décodeur de
 * plus.
 */
async function pixelsDe(clip) {
  const shot = await page.screenshot({ type: 'png', clip });
  return page.evaluate(async (data) => {
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
}

/** Luminance relative d'un pixel RGB. */
const luminance = (r, g, b) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);

/**
 * Le contraste de la barre de navigation, quand elle passe sur la visite.
 *
 * Elle change d'habit au-dessus de la scène : fond sombre en dégradé, libellés
 * en blanc à quatre-vingt-deux pour cent. Ce blanc-là n'est pas mesurable comme
 * celui des légendes, parce qu'il n'est pas opaque — la couleur réellement
 * affichée dépend de ce qu'il y a dessous, donc de la scène, donc de l'endroit
 * de la visite. Un mur en plein soleil derrière un voile à demi transparent
 * peut ramener l'écart sous le seuil sans que rien ne le signale.
 *
 * On compose donc soi-même : pour chaque pixel du fond, la couleur du texte est
 * `α × blanc + (1 − α) × fond`, et on compare les deux luminances. C'est ce que
 * fait le navigateur, à ceci près qu'on peut le mesurer. `α` doit suivre la
 * feuille de style : le premier relevé s'est fait à 0,82, et c'est justement ce
 * relevé qui a fait passer les libellés au blanc franc.
 */
const ALPHA_LIBELLE = 1;

async function mesureBarre() {
  const etat = await page.evaluate(() => {
    const nav = document.querySelector('.nav');
    if (!nav || nav.getAttribute('data-dark') !== '1') return null;
    const cibles = [...nav.querySelectorAll('.nav-links a, .nav-side .sign-in, .brand-name')];
    return cibles
      .map((node) => {
        const box = node.getBoundingClientRect();
        return { texte: (node.textContent || '').trim().slice(0, 20), x: box.x, y: box.y, w: box.width, h: box.height };
      })
      .filter((box) => box.w > 4 && box.h > 4);
  });
  if (!etat || etat.length === 0) return null;

  const cacher = (value) =>
    page.evaluate((v) => {
      for (const node of document.querySelectorAll('.nav-links a, .nav-side .sign-in, .brand-name')) {
        node.style.color = v || '';
      }
    }, value);

  await cacher('transparent');
  const lots = [];
  for (const box of etat) {
    lots.push({ texte: box.texte, pixels: await pixelsDe({ x: box.x, y: box.y, width: box.w, height: box.h }) });
  }
  await cacher('');

  let pire = { texte: '', ratio: Infinity };
  for (const lot of lots) {
    const ratios = [];
    for (let i = 0; i < lot.pixels.length; i += 4) {
      const r = lot.pixels[i];
      const g = lot.pixels[i + 1];
      const b = lot.pixels[i + 2];
      const fond = luminance(r, g, b);
      const texte = luminance(
        ALPHA_LIBELLE * 255 + (1 - ALPHA_LIBELLE) * r,
        ALPHA_LIBELLE * 255 + (1 - ALPHA_LIBELLE) * g,
        ALPHA_LIBELLE * 255 + (1 - ALPHA_LIBELLE) * b,
      );
      ratios.push((Math.max(fond, texte) + 0.05) / (Math.min(fond, texte) + 0.05));
    }
    ratios.sort((a, b) => a - b);
    const centile = ratios[Math.floor(0.05 * ratios.length)];
    if (centile < pire.ratio) pire = { texte: lot.texte, ratio: centile };
  }
  return pire;
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
  const pixels = await pixelsDe({ x: cadre.x, y: cadre.y, width: cadre.w, height: cadre.h });
  await cacher('');

  /*
   * On relit l'opacité après la capture, et on jette l'échantillon si elle a
   * bougé.
   *
   * Entre le moment où l'on décide qu'une légende est lisible et celui où la
   * capture est prise, la page continue de s'animer. Sous un rendu logiciel une
   * seule image peut faire passer une légende de quatre-vingt-dix pour cent à
   * zéro — et le voile la suit, puisqu'il ne sert qu'à elle. La capture montre
   * alors un fond nu, la mesure annonce deux virgule trois, et le tableau
   * accuse un défaut qui n'existe pas : la vérification manuelle montrait
   * qu'aucune légende n'était affichée à cet instant-là.
   *
   * Attendre plus longtemps ne suffit pas — c'est ce qu'on a essayé d'abord, en
   * ajoutant l'opacité aux signaux de convergence, et une exécution sur deux
   * passait encore. La mesure doit se valider elle-même : ce qu'on a
   * photographié doit être ce qu'on avait décidé de photographier.
   */
  const apres = await page.evaluate(() => {
    let value = 0;
    for (const node of document.querySelectorAll('[class*="caption"]')) {
      value = Math.max(value, Number(getComputedStyle(node).opacity));
    }
    return value;
  });
  if (Math.abs(apres - cadre.opacity) > 0.01) return null;

  const ratios = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const L = luminance(pixels[index], pixels[index + 1], pixels[index + 2]);
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
const barres = [];
for (let index = 0; index <= PAS; index += 1) {
  const t = index / PAS;
  const y = Math.round(section.top + t * (section.height - section.vh));
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
  await reposer();
  /*
   * On réessaie plutôt que de jeter.
   *
   * `mesure` refuse un échantillon dont l'opacité a bougé entre la décision et
   * la capture — c'est ce qui a supprimé les fausses alertes. Mais refuser sans
   * réessayer fait tomber la couverture : sur onze positions, trois légendes
   * seulement étaient mesurées, et une mesure qui ne regarde que la moitié de
   * ce qu'elle doit surveiller rassure à tort. Trois tentatives suffisent ; si
   * la page bouge encore après, c'est qu'il n'y a rien de stable à photographier
   * à cet endroit-là.
   */
  let found = null;
  for (let essai = 0; essai < 3 && !found; essai += 1) {
    if (essai > 0) await reposer();
    found = await mesure();
  }
  if (found) brut.push({ t, ...found });
  /* La barre coûte six captures par position, et c'est ce coût qui avait
     ralenti la boucle au point de fausser la convergence. Une position sur deux
     suffit : ce qu'on cherche est le pire fond rencontré, et deux positions
     voisines de la visite montrent presque la même chose. */
  if (index % 2 === 0) {
    const barre = await mesureBarre();
    if (barre) barres.push({ t, ...barre });
  }
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

if (barres.length > 0) {
  const pireBarre = barres.reduce((a, b) => (a.ratio < b.ratio ? a : b));
  const ok = pireBarre.ratio >= SEUIL;
  console.log(`\nBarre de navigation sur la visite — ${barres.length} relevés`);
  console.log(
    `  pire libellé : ${(ok ? vert : rouge)(pireBarre.ratio.toFixed(1))} ` +
      pale(`(« ${pireBarre.texte} » à t=${pireBarre.t.toFixed(2)}, 5e centile)`),
  );
}

const ratees = legendes
  .filter((entry) => entry.centile < SEUIL)
  .concat(barres.filter((entry) => entry.ratio < SEUIL));
console.log('');
if (legendes.length === 0) {
  console.log(rouge('Aucune légende mesurée : la visite s’est-elle chargée ?'));
} else if (ratees.length > 0) {
  const legendesRatees = ratees.filter((entry) => entry.centile !== undefined).length;
  const barresRatees = ratees.length - legendesRatees;
  const morceaux = [];
  if (legendesRatees > 0) morceaux.push(`${legendesRatees} légende(s)`);
  if (barresRatees > 0) morceaux.push(`${barresRatees} relevé(s) de barre`);
  console.log(rouge(`${morceaux.join(' et ')} sous ${SEUIL}:1 sur plus de 5 % du fond.`));
} else {
  console.log(vert(`Les ${legendes.length} légendes tiennent ${SEUIL}:1 sur 95 % de leur fond.`));
}

await browser.close();
process.exit(ratees.length > 0 || legendes.length === 0 ? 1 : 0);
