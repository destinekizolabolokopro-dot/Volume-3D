/**
 * La page ORIEL, photographiée section par section.
 *
 * Le bâtiment de cette page n'existe qu'à l'écran : rien dans le code source ne
 * dit à quoi il ressemble, et on ne juge pas un cadrage sur des degrés
 * d'azimut. Ce script ouvre la page dans un vrai navigateur, la fait défiler
 * jusqu'à chaque section, **attend que la caméra amortie ait rattrapé son
 * retard**, puis photographie.
 *
 * Cette attente-là est tout le script. Sans elle, on photographie le plan
 * précédent : l'amortissement met plus d'une seconde à converger, et une
 * capture prise trop tôt montre une caméra en route vers nulle part.
 *
 *   npm run residence
 *   W=390 H=844 SORTIE=captures/tel npm run residence
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pw from 'playwright';
import sharp from 'sharp';

const { chromium } = pw;
const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTE = process.env.ROUTE || '/residence';
const WIDTH = Number(process.env.W || 1440);
const HEIGHT = Number(process.env.H || 900);
const SORTIE = process.env.SORTIE || 'captures/residence';

/** Les sept sections, plus les trois plans de la galerie. */
const ARRETS = [
  ['1-entree', '#top', 0],
  ['2-sejour', '#sejour', 0],
  ['3-cuisine', '#cuisine', 0],
  ['4-galerie-i', '#galerie', 0],
  ['4-galerie-ii', '#galerie', 1],
  ['4-galerie-iii', '#galerie', 2],
  ['5-chambre', '#chambre', 0],
  ['6-bains', '#bains', 0],
  ['7-terrasse', '#terrasse', 0],
  ['8-adresse', '#contact', 0],
];

/* On peut n'en refaire qu'une : `ARRETS=8-adresse npm run residence`. Une
   capture coûte une minute sous rendu logiciel, et on ne règle jamais un
   cadrage du premier coup. */
const CHOIX = (process.env.ARRETS || '').split(',').map((s) => s.trim()).filter(Boolean);
const A_FAIRE = CHOIX.length ? ARRETS.filter(([nom]) => CHOIX.includes(nom)) : ARRETS;

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

mkdirSync(SORTIE, { recursive: true });

const browser = await chromium.launch({
  executablePath: navigateur(),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

const erreurs = [];
page.on('console', (message) => {
  if (message.type() === 'error') erreurs.push(message.text());
});
page.on('pageerror', (error) => erreurs.push(String(error)));

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


/**
 * Laisse la caméra rattraper son retard.
 *
 * On ne peut pas attendre que l'image « cesse de bouger » : elle ne cesse
 * jamais. Une orbite lente de deux degrés tourne en permanence par-dessus le
 * défilement, donc deux captures successives ne sont jamais identiques, et une
 * comparaison octet à octet ne convergerait pas — c'est la première version de
 * ce script, et elle annonçait huit fois « jamais stable » sur des images
 * parfaitement posées.
 *
 * Ce qu'on attend, c'est la convergence de **l'amortissement**, et celle-là se
 * calcule : le facteur est normalisé sur le temps écoulé, la constante vaut
 * 0,0022 par seconde, donc l'écart au plan visé est divisé par cent en moins
 * d'une seconde de temps réel — quelle que soit la cadence, y compris sous le
 * rendu logiciel de ce script. Deux secondes et demie laissent une marge
 * confortable.
 */
async function poser() {
  /* D'abord les animations de la page. Sous rendu logiciel, la première image
     de la scène bloque le fil principal plusieurs secondes : les observateurs
     d'intersection ne se déclenchent qu'après, et une attente de durée fixe
     photographie un premier écran dont le titre n'a pas encore commencé à
     monter. On attend donc l'état, pas le temps. */
  await page.waitForFunction(
    () => {
      /* Tout ce qui est à l'écran doit avoir été vu par son observateur. Sous
         rendu logiciel, une image de la scène peut coûter plusieurs centaines
         de millisecondes : les rappels d'intersection attendent leur tour, et
         une capture prise à l'heure dite trouve une section vide. */
      const dedans = [...document.querySelectorAll('[data-facon], [data-vu]')].filter((n) => {
        const r = n.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight && r.height > 0;
      });
      if (dedans.some((n) => n.dataset.vu !== '1')) return false;
      return document.getAnimations().every((a) => a.playState !== 'running');
    },
    undefined,
    { timeout: 60000 },
  ).catch(async () => {
    /* On ne fait pas échouer la prise de vue pour cela : une capture imparfaite
       avec la liste de ce qui n'était pas prêt vaut mieux qu'une exception qui
       n'apprend rien. */
    const retard = await page.evaluate(() =>
      [...document.querySelectorAll('[data-facon]')]
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && r.height > 0 && n.dataset.vu !== '1';
        })
        .map((n) => n.className.split(' ').pop()),
    );
    console.log(`  ⚠ pas révélé : ${retard.join(', ') || '(rien — animations en cours)'}`);
  });
  // Puis la caméra, dont l'amortissement converge en moins d'une seconde.
  await page.waitForTimeout(2500);
}

/*
 * Le contraste, mesuré sur les pixels et non sur la feuille de style.
 *
 * C'est la seule façon honnête de le faire ici. Ailleurs sur le site, un texte
 * est posé sur un fond dont la couleur est écrite quelque part et se lit dans
 * la feuille ; sur cette page-ci, le fond est **un bâtiment qui tourne**. La
 * même ligne blanche passe au fil du défilement sur du béton au soleil, sur du
 * vitrage sombre et sur du ciel. Aucune valeur du CSS ne dit ce qui se trouve
 * réellement derrière elle.
 *
 * On procède donc en deux prises : la page telle quelle, puis la même image
 * avec le texte rendu invisible — invisible, pas retiré, pour que rien ne
 * bouge dans la mise en page. On lit alors le fond à l'emplacement exact des
 * mots, et on retient le **pixel le plus clair** : contre un texte clair,
 * c'est lui le cas défavorable, et c'est celui-là qu'il faut faire passer.
 */
const TEXTES = [
  ['titre du hero', '.rz-titre', '#f4f6f7'],
  ['chapô du hero', '.rz-chapo', 'rgba(238,242,244,0.84)'],
  ['légende de galerie', '.rz-plaque .rz-p', 'rgba(238,242,244,0.84)'],
  ['titre de section', '.rz-titraille .rz-h2', '#f4f6f7'],
  ['chapeau de section', '.rz-titraille .rz-p', 'rgba(238,242,244,0.84)'],
  ['valeur de fiche', '.rz-fiche dd', '#f4f6f7'],
  ['clé de fiche', '.rz-fiche dt', 'rgba(226,232,236,0.72)'],
  ['libellé de chiffre', '.rz-libelle', '#f4f6f7'],
];

const canal = (v) => {
  const u = v / 255;
  return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
};
const clarte = (r, g, b) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const ecart = (a, b) => {
  const [x, y] = a > b ? [a, b] : [b, a];
  return (x + 0.05) / (y + 0.05);
};

/** L'encre du texte, aplatie sur le fond le plus clair qu'il rencontre. */
function encre(couleur, fond) {
  const m = couleur.match(/[\d.]+/g).map(Number);
  const alpha = couleur.startsWith('rgba') ? m[3] : 1;
  if (couleur.startsWith('#')) {
    const n = parseInt(couleur.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return [0, 1, 2].map((i) => m[i] * alpha + fond[i] * (1 - alpha));
}

const mesures = [];

async function contraste(nom) {
  const boites = await page.evaluate(
    (liste) =>
      liste
        .map(([label, selecteur]) => {
          const n = document.querySelector(selecteur);
          if (!n) return null;
          const r = n.getBoundingClientRect();
          if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= window.innerHeight) return null;
          return [
            label,
            selecteur,
            Math.max(0, Math.round(r.left)),
            Math.max(0, Math.round(r.top)),
            Math.round(Math.min(r.width, window.innerWidth - r.left)),
            Math.round(Math.min(r.height, window.innerHeight - r.top)),
          ];
        })
        .filter(Boolean),
    TEXTES.map(([label, selecteur]) => [label, selecteur]),
  );
  if (boites.length === 0) return;
  if (process.env.BOITES) console.log('   boîtes :', JSON.stringify(boites));

  await page.evaluate(
    (sels) => sels.forEach((s) => document.querySelectorAll(s).forEach((n) => (n.style.visibility = 'hidden'))),
    boites.map((b) => b[1]),
  );
  /* Une minute et non trente secondes. Sous rendu logiciel, une image de cette
     scène coûte deux secondes et demie, et la capture attend une image propre :
     le délai par défaut de playwright a fini par être dépassé le jour où les
     matières et un soleil plus fort ont alourdi le rendu. Le script échouait
     alors sur un décompte, pas sur un défaut de la page. */
  const nu = await page.screenshot({ timeout: 90000 });
  await page.evaluate(
    (sels) => sels.forEach((s) => document.querySelectorAll(s).forEach((n) => (n.style.visibility = ''))),
    boites.map((b) => b[1]),
  );

  for (const [label, selecteur, x, y, w, h] of boites) {
    const brut = await sharp(nu)
      .extract({ left: x, top: y, width: Math.max(1, w), height: Math.max(1, h) })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let pire = -1;
    let fond = [0, 0, 0];
    let ou = [0, 0];
    const pas = brut.info.channels;
    for (let i = 0; i < brut.data.length; i += pas) {
      const l = clarte(brut.data[i], brut.data[i + 1], brut.data[i + 2]);
      if (l > pire) {
        pire = l;
        fond = [brut.data[i], brut.data[i + 1], brut.data[i + 2]];
        /* On note **où**. Un rapport qui annonce « 1,08:1 » sans dire à quel
           endroit de l'écran envoie chercher la faute dans tout le cadre ; avec
           les coordonnées, on ouvre la capture et on voit tout de suite si
           c'est un mur au soleil, un luminaire ou une arête de cloison. */
        const j = i / pas;
        ou = [x + (j % brut.info.width), y + Math.floor(j / brut.info.width)];
      }
    }
    const couleur = TEXTES.find(([nomTexte]) => nomTexte === label)[2];
    const [r, g, b] = encre(couleur, fond);
    mesures.push({ vue: nom, label, ratio: ecart(clarte(r, g, b), pire), ou, fond });
  }
}

/*
 * Ce qui remplit le cadre, par matériau.
 *
 * Une capture se juge à l'œil, et l'œil se trompe sur les proportions : la
 * salle de bains paraissait « sombre » alors qu'elle est mesurée plus claire
 * que le séjour, et son vrai défaut — plus de la moitié du cadre en plâtre nu
 * — ne se voyait pas. Une grille de lancers de rayon le chiffre.
 *
 * Elle tourne **ici** et non dans un script à part, et c'est le résultat d'un
 * échec : un sondage isolé qui vise l'ancre lui-même place la caméra ailleurs
 * dans le vol, parce que les sections se révèlent au défilement et que la page
 * n'a pas encore sa hauteur définitive. Trois tentatives ont chiffré trois
 * cadres qui n'étaient pas celui qu'on photographiait. Le seul endroit où la
 * caméra est sûrement au bon point est celui d'où l'on prend la photo.
 *
 *   CADRE=1 ARRETS=6-bains npm run residence
 */
const CADRE = process.env.CADRE === '1';

/*
 * Ce qu'il y a en un point de l'écran.
 *
 * En coordonnées normalisées, séparées par des point-virgules :
 *
 *   POINT='-0.85,0.56' ARRETS=6-bains npm run residence
 *
 * Sert à nommer ce qu'on voit. Une tache claire en haut d'un cadre peut être
 * un luminaire, un reflet ou une faute d'éclairage, et on ne le devine pas :
 * trois hypothèses fausses se sont déjà succédé avant qu'un lancer de rayon ne
 * réponde en une seconde.
 */
const POINTS = (process.env.POINT || '')
  .split(';')
  .map((p) => p.split(',').map(Number))
  .filter((p) => p.length === 2 && p.every(Number.isFinite));

async function composition(nom) {
  const r = await page.evaluate(() => {
    const oeil = window.oriel.camera.position;
    const compte = new Map();
    const PAS_X = 32;
    const PAS_Y = 24;
    for (let iy = 0; iy < PAS_Y; iy += 1)
      for (let ix = 0; ix < PAS_X; ix += 1) {
        const t = window.oriel.sonder(((ix + 0.5) / PAS_X) * 2 - 1, 1 - ((iy + 0.5) / PAS_Y) * 2);
        const cle = t ? `${t.couleur} r=${t.rugosite === null ? '—' : t.rugosite.toFixed(2)}` : 'ciel';
        compte.set(cle, (compte.get(cle) || 0) + 1);
      }
    return {
      oeil: [oeil.x, oeil.y, oeil.z].map((v) => Math.round(v * 100) / 100),
      compte: [...compte].sort((a, b) => b[1] - a[1]),
      total: PAS_X * PAS_Y,
    };
  });
  /* La position de la caméra est imprimée avec le résultat : un sondage qui ne
     dit pas d'où il regarde ne prouve rien, et c'est très exactement l'erreur
     qui a coûté trois relevés. */
  console.log(`\n  ${nom} — cadre depuis ${r.oeil.join(', ')}`);
  for (const [cle, n] of r.compte) {
    if (n / r.total < 0.005) continue;
    console.log(`    ${((100 * n) / r.total).toFixed(1).padStart(5)} %  ${cle}`);
  }
  console.log('');
}

/*
 * Rien de trop près de l'œil.
 *
 * Une étape posée dans un meuble ne se rattrape pas au montage : le plan avant
 * de la caméra est à vingt centimètres, donc tout ce qui est plus proche est
 * traversé et l'on en voit l'intérieur. C'est arrivé sur « le coin salon », où
 * la plante du séjour se trouvait à quatorze centimètres du point de vue : son
 * feuillage barrait le cadre entier d'une diagonale vert sombre, et rien dans
 * le code ne pouvait le dire — deux coordonnées écrites à deux endroits
 * différents, à des semaines d'intervalle.
 *
 * Un éventail de rayons suffit à le voir, et il coûte vingt-cinq lancers.
 */
const TROP_PRES = 0.35;

async function proximite(nom) {
  const r = await page.evaluate(() => {
    let min = Infinity;
    let quoi = null;
    for (let iy = 0; iy < 5; iy += 1)
      for (let ix = 0; ix < 5; ix += 1) {
        const t = window.oriel.sonder((ix / 4) * 1.8 - 0.9, 0.9 - (iy / 4) * 1.8);
        if (t && t.distance < min) {
          min = t.distance;
          quoi = t;
        }
      }
    return quoi ? { distance: min, couleur: quoi.couleur, point: quoi.point } : null;
  });
  if (r && r.distance < TROP_PRES) {
    console.log(
      `  ⚠ ${nom} : ${r.couleur} à ${r.distance.toFixed(2)} m de l'œil ` +
        `(${r.point.join(', ')}) — la caméra est dans un objet`,
    );
    return false;
  }
  return true;
}

async function pointer(nom) {
  const r = await page.evaluate((pts) => pts.map(([x, y]) => [x, y, window.oriel.sonder(x, y)]), POINTS);
  for (const [x, y, t] of r) {
    console.log(
      `  ${nom} @ ${x}, ${y} : ` +
        (t ? `${t.couleur} r=${t.rugosite ?? '—'} à ${t.distance} m, en ${t.point.join(', ')}` : 'ciel'),
    );
  }
}

/** Faux dès qu'une étape a un objet collé à l'œil. */
let dedans = true;

for (const [nom, ancre, plan] of A_FAIRE) {
  await page.evaluate(
    ([ancre, plan]) => {
      const cible = document.querySelector(ancre);
      if (!cible) throw new Error(`ancre absente : ${ancre}`);
      const haut = cible.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: haut + plan * window.innerHeight, behavior: 'instant' });
    },
    [ancre, plan],
  );
  await poser();
  await page.screenshot({ path: join(SORTIE, `${nom}.png`), timeout: 90000 });
  await contraste(nom);
  if (!(await proximite(nom))) dedans = false;
  if (CADRE) await composition(nom);
  if (POINTS.length) await pointer(nom);
  console.log(`${nom.padEnd(16)} ok`);
}

/* Le seuil est celui de la WCAG pour le texte courant. Les grands titres
   s'en tirent à 3:1, mais on ne fait pas cette faveur : un titre illisible
   sur une façade au soleil l'est pour tout le monde. */
const SEUIL = 4.5;
console.log('\nContraste mesuré sur les pixels, au pire fond rencontré :\n');
const pires = new Map();
for (const m of mesures) {
  const connu = pires.get(m.label);
  if (!connu || m.ratio < connu.ratio) pires.set(m.label, m);
}
let recale = 0;
for (const m of [...pires.values()].sort((a, b) => a.ratio - b.ratio)) {
  const ok = m.ratio >= SEUIL;
  if (!ok) recale += 1;
  const situe = ok ? '' : `  ← pire pixel en ${m.ou[0]},${m.ou[1]} (#${m.fond.map((v) => v.toString(16).padStart(2, '0')).join('')})`;
  console.log(
    `  ${(ok ? 'ok  ' : 'FAIBLE').padEnd(7)} ${m.label.padEnd(22)} ${m.ratio.toFixed(2)}:1  (${m.vue})${situe}`,
  );
}
if (recale > 0) console.log(`\n  ${recale} texte(s) sous ${SEUIL}:1.`);

if (erreurs.length > 0) {
  console.log('\nErreurs de console :');
  for (const erreur of erreurs) console.log('  · ' + erreur);
} else {
  console.log('\nAucune erreur de console.');
}

if (!dedans) console.log('\n⚠ Une étape au moins a un objet collé à l’œil (voir ci-dessus).');

await browser.close();
process.exit(dedans && recale === 0 ? 0 : 1);
