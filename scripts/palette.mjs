/**
 * L'étude de couleur, en une commande : `npm run palette`.
 *
 * Elle répond à trois questions sur des chiffres, pas à l'œil :
 *
 *  1. Chaque texte de l'interface passe-t-il le seuil de contraste sur le fond
 *     où on le pose réellement — y compris quand il est semi-transparent ?
 *  2. Deux surfaces voisines de la scène 3D se distinguent-elles, ou forment-
 *     elles un aplat ? Écart ΔE2000, seuil à 3.
 *  3. Chaque matériau tient-il dans la plage utile d'un moteur de rendu ?
 *
 * Elle sort en code 1 si quelque chose échoue, pour pouvoir servir de garde-fou.
 */

import {
  ALBEDO_CEILING,
  ALBEDO_FLOOR,
  checkAlbedo,
  contrast,
  deltaE,
  hueGap,
  over,
  parseColor,
  toHex,
  toLch,
} from '../lib/color.ts';
import { ADJACENT, MATERIALS, MAX_SUBTLETY, MIN_SEPARATION, SUBTLE } from '../lib/palette.ts';

/* =============================================== la palette de l'interface === */

const UI = {
  bg: '#ffffff',
  'bg-alt': '#f8f7f4',
  'bg-sunk': '#f0eee8',
  dark: '#151f1d',
  'dark-alt': '#1e2b28',
  'ink-strong': '#14120f',
  ink: '#272320',
  'ink-muted': '#544e46',
  'ink-soft': '#655e55',
  'ink-faint': '#726b60',
  'ink-on-dark': '#e9edeb',
  'ink-on-dark-soft': '#a9b6b3',
  accent: '#0e6e66',
  'accent-strong': '#0a564f',
  'accent-wash': '#e2f0ee',
  'accent-on-dark': '#4fb3a6',
  positive: '#1c6b45',
  warning: '#8a5712',
  danger: '#a5382a',
  line: '#e4e1d9',
  'line-strong': '#948d7f',
  'line-soft': '#cfcabe',
};

/**
 * Ce qu'on vérifie, et sur quel fond.
 *
 * Le fond compte : `--ink-soft` passe largement sur blanc et échoue sur
 * `--bg-sunk`. Mesurer une couleur sans son fond ne mesure rien.
 */
const READABILITY = [
  ['texte courant', 'ink', 'bg', 4.5],
  ['texte courant sur fond sourd', 'ink', 'bg-sunk', 4.5],
  ['texte secondaire', 'ink-muted', 'bg', 4.5],
  ['texte secondaire sur carte sourde', 'ink-muted', 'bg-sunk', 4.5],
  ['texte tertiaire', 'ink-soft', 'bg', 4.5],
  ['texte tertiaire sur fond sourd', 'ink-soft', 'bg-sunk', 4.5],
  ['mention discrète', 'ink-faint', 'bg', 4.5],
  ['mention discrète sur fond sourd', 'ink-faint', 'bg-sunk', 4.5],
  ['titre', 'ink-strong', 'bg', 4.5],
  ['lien accentué', 'accent-strong', 'bg', 4.5],
  ['accent sur son lavis', 'accent', 'accent-wash', 4.5],
  ['blanc sur bouton accent', 'bg', 'accent', 4.5],
  ['texte sur fond sombre', 'ink-on-dark', 'dark', 4.5],
  ['texte doux sur fond sombre', 'ink-on-dark-soft', 'dark', 4.5],
  ['accent clair sur fond sombre', 'accent-on-dark', 'dark', 4.5],
  ['succès', 'positive', 'bg', 4.5],
  ['avertissement', 'warning', 'bg', 4.5],
  ['erreur', 'danger', 'bg', 4.5],
  ['bordure de champ', 'line-strong', 'bg', 3],
  ['filet de carte', 'line', 'bg', 1.2],
];

/* ==================================================================== sortie */

const RESET = '[0m';
const RED = '[31m';
const GREEN = '[32m';
const YELLOW = '[33m';
const DIM = '[2m';

let failures = 0;
/**
 * Trois états, dans cet ordre : c'est important.
 *
 * Une première version testait `ok` avant `tiède`, si bien qu'un écart de 2,4 —
 * juste sous le seuil — s'affichait en vert. Un contrôle qui ne signale pas ce
 * qu'il a trouvé ne sert à rien.
 */
const mark = (state) => {
  if (state === 'échec') failures += 1;
  if (state === 'tiède') return `${YELLOW}tiède${RESET}`;
  return state === 'ok' ? `${GREEN}ok   ${RESET}` : `${RED}ÉCHEC${RESET}`;
};
const pass = (ok) => (ok ? 'ok' : 'échec');
const pad = (text, width) => String(text).padEnd(width);

console.log(`\n${DIM}══ Lisibilité de l'interface ══════════════════════════════${RESET}`);
for (const [label, front, back, threshold] of READABILITY) {
  const ratio = contrast(parseColor(UI[front]), parseColor(UI[back]));
  const ok = ratio >= threshold;
  console.log(
    `  ${mark(pass(ok))} ${pad(label, 34)} ${ratio.toFixed(2).padStart(6)} ${DIM}(seuil ${threshold})${RESET}`,
  );
}

console.log(`\n${DIM}══ Textes semi-transparents, composés sur leur fond ═══════${RESET}`);
const VEILED = [
  ['légende sur voile de visite', '#ffffff', '#080c0b', 0.86, '#0d1211', 4.5],
  ['texte doux de la visite libre', '#ffffff', '#080c0b', 0.74, '#131a18', 4.5],
  ['mention de démonstration', '#ffffff', '#080c0b', 0.58, '#0d1211', 3],
];
for (const [label, front, mixWith, alpha, back, threshold] of VEILED) {
  const composed = over(parseColor(front), parseColor(mixWith), alpha);
  const ratio = contrast(composed, parseColor(back));
  console.log(
    `  ${mark(pass(ratio >= threshold))} ${pad(label, 34)} ${ratio.toFixed(2).padStart(6)} ${DIM}(seuil ${threshold})${RESET}`,
  );
}

const subtle = new Set(SUBTLE.map(([a, b]) => `${a}|${b}`));

console.log(`\n${DIM}══ Séparation des surfaces qui se touchent ════════════════${RESET}`);
for (const [one, two] of ADJACENT) {
  const delta = deltaE(parseColor(MATERIALS[one]), parseColor(MATERIALS[two]));
  // Deux lames d'un même parquet ne doivent pas se séparer : le seuil s'inverse.
  const nuance = subtle.has(`${one}|${two}`);
  const state = nuance
    ? delta > 1 && delta < MAX_SUBTLETY
      ? 'ok'
      : 'échec'
    : delta >= MIN_SEPARATION
      ? 'ok'
      : delta >= 3
        ? 'tiède'
        : 'échec';
  console.log(
    `  ${mark(state)} ${pad(`${one} / ${two}`, 30)} ΔE ${delta.toFixed(2).padStart(6)}` +
      (nuance ? `  ${DIM}nuance interne, doit rester faible${RESET}` : ''),
  );
}

console.log(`\n${DIM}══ Plage utile des matériaux (${ALBEDO_FLOOR}–${ALBEDO_CEILING} en sRGB) ═══════${RESET}`);
for (const [name, value] of Object.entries(MATERIALS)) {
  const color = parseColor(value);
  const check = checkAlbedo(color);
  console.log(`  ${mark(pass(check.ok))} ${pad(name, 22)} ${toHex(color)}  ${DIM}${check.note}${RESET}`);
}

console.log(`\n${DIM}══ Teintes ═══════════════════════════════════════════════${RESET}`);
const family = {
  'accent marque': UI.accent,
  'note pétrole': MATERIALS.petrole,
  'contre-note terre': MATERIALS.terre,
  mur: MATERIALS.mur,
  menuiserie: MATERIALS.menuiserie,
  chêne: MATERIALS.chene,
};
for (const [name, hex] of Object.entries(family)) {
  const { l, c, h } = toLch(parseColor(hex));
  console.log(
    `  ${DIM}·${RESET} ${pad(name, 12)} clarté ${l.toFixed(1).padStart(5)}  saturation ${c
      .toFixed(1)
      .padStart(5)}  teinte ${h.toFixed(0).padStart(4)}°`,
  );
}
const gap = (a, b) => hueGap(parseColor(a), parseColor(b)).toFixed(0);
console.log(`  ${DIM}·${RESET} accent de marque → note pétrole : ${gap(UI.accent, MATERIALS.petrole)}°  ${DIM}(elle doit rimer)${RESET}`);
console.log(`  ${DIM}·${RESET} note pétrole → contre-note terre : ${gap(MATERIALS.petrole, MATERIALS.terre)}°  ${DIM}(elle doit s'opposer)${RESET}`);
console.log(`  ${DIM}·${RESET} chêne → contre-note terre : ${gap(MATERIALS.chene, MATERIALS.terre)}°  ${DIM}(elle doit appartenir à la pièce)${RESET}`);

console.log(
  failures === 0
    ? `\n${GREEN}Tout passe.${RESET}\n`
    : `\n${RED}${failures} point${failures > 1 ? 's' : ''} à corriger.${RESET}\n`,
);
process.exit(failures === 0 ? 0 : 1);
