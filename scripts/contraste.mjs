/**
 * L'audit de contraste : `npm run contraste`.
 *
 * Il lit les jetons de couleur dans `app/socle.css` et vérifie, un par un,
 * que chaque texte franchit le seuil sur le fond où il est RÉELLEMENT posé.
 * Pas sur du blanc par principe : `--ink-faint` passait AA sur blanc et
 * échouait sur le fond alterné, ce qui ne se voit qu'en mesurant la bonne
 * paire.
 *
 * Il sort en code 1 si quelque chose échoue, pour pouvoir servir de garde-fou
 * avant de pousser une palette. Il ne demande ni serveur ni navigateur : les
 * couleurs sont dans la feuille, et le contraste est une formule.
 *
 * Les seuils viennent de WCAG 2.1 : 4,5 pour du texte courant, 3,0 pour du
 * grand texte et pour la bordure d'un composant d'interface — un champ dont
 * on ne distingue pas le bord n'est pas un champ.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrast, hueGap, parseColor, toLch } from '../lib/color.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Les jetons, lus dans la feuille plutôt que recopiés ici. */
function jetons() {
  const css = readFileSync(join(RACINE, 'app/socle.css'), 'utf8');
  const bloc = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  const trouves = {};
  for (const [, nom, valeur] of bloc.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    trouves[nom] = valeur;
  }
  return trouves;
}

const T = jetons();
const j = (nom) => {
  if (!T[nom]) throw new Error(`jeton --${nom} introuvable dans app/socle.css`);
  return T[nom];
};

/* Chaque ligne est une paire qui existe VRAIMENT à l'écran. En ajouter une qui
   n'existe pas ferait échouer l'audit sur un cas que personne ne voit ; en
   oublier une laisserait passer le seul défaut qui compte. */
const PAIRES = [
  ['texte courant sur blanc', 'ink', 'bg', 4.5],
  ['titres sur blanc', 'ink-strong', 'bg', 4.5],
  ['texte atténué sur blanc', 'ink-muted', 'bg', 4.5],
  ['texte doux sur blanc', 'ink-soft', 'bg', 4.5],
  ['mentions sur blanc', 'ink-faint', 'bg', 4.5],
  ['mentions sur le fond alterné', 'ink-faint', 'bg-alt', 4.5],
  ['texte doux sur le fond alterné', 'ink-soft', 'bg-alt', 4.5],
  ['texte courant sur le fond creusé', 'ink', 'bg-sunk', 4.5],

  /* Le pied de page et la section de preuve sont posés sur le fond creusé :
     tout ce qui s'y écrit doit être mesuré là, pas sur du blanc. */
  ['texte atténué sur le fond creusé', 'ink-muted', 'bg-sunk', 4.5],
  ['texte doux sur le fond creusé', 'ink-soft', 'bg-sunk', 4.5],
  ['mentions sur le fond creusé', 'ink-faint', 'bg-sunk', 4.5],
  ['accent sur le fond creusé (lien de pied)', 'accent', 'bg-sunk', 4.5],

  ['accent sur blanc (lien)', 'accent', 'bg', 4.5],
  ['accent sur le fond alterné', 'accent', 'bg-alt', 4.5],
  ['blanc sur l’accent (bouton plein)', 'accent-ink', 'accent', 4.5],
  ['blanc sur l’accent au survol', 'accent-ink', 'accent-strong', 4.5],
  ['accent foncé sur son lavis', 'accent-strong', 'accent-wash', 4.5],
  /* La pastille « bientôt » d'un onglet de branche, et le bandeau qui demande
     de confirmer son adresse : deux textes posés sur un lavis, mesurés là. */
  ['accent sur son lavis (pastille)', 'accent', 'accent-wash', 4.5],
  ['texte courant sur le lavis d’alerte', 'ink', 'warning-wash', 4.5],
  /* L'appel de fin de page : un aplat d'accent, un titre blanc, un texte
     d'accompagnement plus doux, et un bouton blanc dessus. */
  ['texte doux sur l’aplat d’accent', 'ink-on-accent-soft', 'accent', 4.5],
  ['accent foncé sur le bouton blanc', 'accent-strong', 'accent-ink', 4.5],
  ['texte courant sur le lavis d’accent', 'ink', 'accent-wash', 4.5],

  ['texte clair sur fond sombre', 'ink-on-dark', 'dark', 4.5],
  ['texte clair doux sur fond sombre', 'ink-on-dark-soft', 'dark', 4.5],
  ['texte clair sur fond sombre alterné', 'ink-on-dark', 'dark-alt', 4.5],
  ['accent clair sur fond sombre', 'accent-on-dark', 'dark', 4.5],

  ['erreur sur son lavis', 'danger', 'danger-wash', 4.5],
  ['alerte sur son lavis', 'warning', 'warning-wash', 4.5],
  ['succès sur son lavis', 'positive', 'positive-wash', 4.5],
  ['erreur sur blanc', 'danger', 'bg', 4.5],

  /* Bordures : 3,0 suffit, mais il faut le franchir. Un champ dont on ne
     distingue pas le bord du fond n'est pas un champ. */
  ['bordure de contrôle sur blanc', 'line-strong', 'bg', 3],
  ['bordure de contrôle sur le fond alterné', 'line-strong', 'bg-alt', 3],
];

/* Les neutres et l'accent doivent rester de familles différentes : quand ils
   partagent la même teinte, rien ne se détache de rien. */
const ECART_MINIMAL = 60;
const FAMILLES = [
  ['fond alterné', 'bg-alt'],
  ['fond creusé', 'bg-sunk'],
  ['traits', 'line'],
];

let echecs = 0;
console.log('\nContraste — chaque texte sur le fond où il est posé\n');
for (const [libelle, texte, fond, seuil] of PAIRES) {
  const mesure = contrast(parseColor(j(texte)), parseColor(j(fond)));
  const passe = mesure >= seuil;
  if (!passe) echecs += 1;
  console.log(
    `  ${passe ? '·' : '✗'} ${libelle.padEnd(42)} ${mesure.toFixed(2).padStart(6)}  (seuil ${seuil})`,
  );
}

const accent = parseColor(j('accent'));
const teinte = toLch(accent);
console.log(`\nFamilles — l'accent est à ${Math.round(teinte.h)}° (L ${teinte.l.toFixed(1)}, C ${teinte.c.toFixed(1)})\n`);
for (const [libelle, jeton] of FAMILLES) {
  const ecart = hueGap(parseColor(j(jeton)), accent);
  const passe = ecart >= ECART_MINIMAL;
  if (!passe) echecs += 1;
  console.log(`  ${passe ? '·' : '✗'} ${libelle.padEnd(42)} ${Math.round(ecart).toString().padStart(4)}°  (minimum ${ECART_MINIMAL}°)`);
}

if (echecs > 0) {
  console.error(`\n${echecs} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('\nTout passe.\n');
