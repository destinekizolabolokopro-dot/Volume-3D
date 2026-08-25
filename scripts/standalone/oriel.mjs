/**
 * ORIEL en un seul fichier.
 *
 *   npm run oriel
 *
 * Sortie : `standalone/oriel.html`, qui s'ouvre par double-clic. Rien à
 * installer, aucun serveur, aucune requête réseau — la fonte, les feuilles de
 * style, React, three.js et la scène entière sont dans le fichier.
 *
 * Le parti pris tient en une ligne : **on empaquette la page, on ne la
 * réécrit pas.** L'entrée monte `app/residence/page.tsx` telle quelle. Un
 * fichier autonome qui reproduit une page à la main finit toujours par
 * décrire une version antérieure du produit ; celui-ci ne le peut pas.
 */

import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DEST = process.env.DEST || 'standalone/oriel.html';
/*
 * Deux formes pour un même contenu.
 *
 * `fichier` produit un document complet, qui s'ouvre par double-clic depuis le
 * disque. `fragment` produit le même contenu sans `<!doctype>`, `<html>`,
 * `<head>` ni `<body>` : c'est ce qu'attend un hébergeur qui enveloppe
 * lui-même la page. Écrire les deux balises dans un contexte qui en fournit
 * déjà donne un document imbriqué, que les navigateurs réparent en silence et
 * de travers.
 */
const FORME = process.env.FORME || 'fichier';
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'scan@volume3d.fr';

/**
 * Les adresses absolues des ressources publiques.
 *
 * Dans le site, `url('/fonts/inter-400-latin.woff2')` est servi par le
 * serveur. Ici il n'y en a pas : on intercepte ces chemins-là, on les fait
 * pointer vers `public/`, et le chargeur `dataurl` met le fichier dans la
 * feuille de style. C'est ce qui permet à la page de garder sa typographie
 * hors ligne — et la typographie est la moitié de cette page.
 */
const ressourcesPubliques = {
  name: 'ressources-publiques',
  setup(assemblage) {
    assemblage.onResolve({ filter: /^\/(fonts|icon)/ }, (args) => ({
      path: join(process.cwd(), 'public', args.path),
    }));
  },
};

const resultat = await build({
  entryPoints: ['scripts/standalone/oriel/entree.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  tsconfig: 'tsconfig.json',
  platform: 'browser',
  write: false,
  /* Rien n'est écrit sur le disque — mais esbuild exige quand même un chemin
     de sortie dès qu'un paquet contient du CSS, puisqu'il doit décider du nom
     du fichier de style qu'il produit. On lui en donne un, qui ne servira
     jamais : les deux sorties partent directement dans le HTML. */
  outdir: '.oriel-build',
  loader: { '.woff2': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl' },
  plugins: [ressourcesPubliques],
  /*
   * `process` n'existe pas dans un navigateur, et les valeurs remplacées une
   * par une ne suffisent pas : il suffit qu'un module lise une variable qu'on
   * n'a pas listée pour que la page entière meure sur un
   * « process is not defined » — ce qui est arrivé, et pour une variable qui
   * ne sert même pas ici (`NEXT_PUBLIC_PRICE`, lue par `lib/content.ts`).
   *
   * On remplace donc `process.env` en entier par un objet figé. Les valeurs
   * qui comptent y sont, les autres retombent sur les défauts que le code
   * prévoit déjà, et aucune lecture ne peut plus faire tomber la page.
   */
  define: {
    'process.env': JSON.stringify({
      NODE_ENV: 'production',
      NEXT_PUBLIC_CONTACT_EMAIL: CONTACT,
      NEXT_PUBLIC_SITE_URL: 'https://volume3d.fr',
    }),
  },
  logLevel: 'warning',
});

const sortie = (fin) => {
  const fichier = resultat.outputFiles.find((f) => f.path.endsWith(fin));
  return fichier ? fichier.text : '';
};

const script = sortie('.js');
const style = sortie('.css');
if (!script) throw new Error('esbuild n’a rien produit');

/*
 * La fonte, en deux visages et non en huit.
 *
 * `app/fonts.css` déclare quatre graisses par sous-ensemble, toutes servies
 * par le même fichier — c'est le bon choix quand un serveur les distribue,
 * puisqu'il ne l'envoie qu'une fois. Ici, chaque `url()` devient le contenu du
 * fichier : huit déclarations font huit copies, et la feuille de style pesait
 * sept cent quinze kilo-octets pour deux fontes de cinquante.
 *
 * Inter est variable : un seul visage par sous-ensemble, annoncé de 100 à 900,
 * couvre exactement les mêmes graisses. C'est ce que le site aurait pu faire
 * depuis le début ; c'est ce que le fichier unique fait.
 */
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
  'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_ETENDU =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,' +
  'U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const visage = (fichier, plage) => {
  const octets = readFileSync(join('public/fonts', fichier));
  return `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;` +
    `src:url(data:font/woff2;base64,${octets.toString('base64')}) format('woff2');` +
    `unicode-range:${plage}}`;
};
const fontes = visage('inter-400-latin.woff2', LATIN) + visage('inter-400-latin-ext.woff2', LATIN_ETENDU);

/* Le `<script>` est en fin de corps et non dans l'en-tête : le canevas
   s'accroche à un élément qui doit exister, et un module différé aurait
   retardé d'autant la première image — qui est, sur cette page, la seule
   chose que l'on attend. */
const corps = `<div id="racine"></div>
<script>${script}</script>
`;

const html =
  FORME === 'fragment'
    ? `<title>ORIEL Riverside</title>
<style>${fontes}${style}</style>
${corps}`
    : `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ORIEL — Architecture that defines the future</title>
<meta name="description" content="A twelve-storey residence of concrete and glass, modelled and rendered live in the browser by Volume3D.">
<meta name="robots" content="noindex">
<style>${fontes}${style}</style>
</head>
<body>
${corps}</body>
</html>
`;

mkdirSync(dirname(DEST), { recursive: true });
writeFileSync(DEST, html);

const ko = (n) => `${(n / 1024).toFixed(0)} ko`;
console.log(`\n  ${DEST}`);
console.log(`  script   ${ko(Buffer.byteLength(script))}`);
console.log(`  style    ${ko(Buffer.byteLength(style))}`);
console.log(`  fontes   ${ko(Buffer.byteLength(fontes))}`);
console.log(`  total    ${ko(Buffer.byteLength(html))}\n`);
