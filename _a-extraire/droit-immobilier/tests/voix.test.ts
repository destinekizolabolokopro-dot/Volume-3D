import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LONGUEUR_MAX, classerVoix, decouperPourLaVoix, pourLaVoix } from '../lib/voix.ts';

/**
 * La voix vient du navigateur, mais trois décisions se prennent sur du texte
 * et se testent donc ici — c'est la seule partie qu'on peut vérifier sans
 * dépendre des voix installées sur la machine de quelqu'un d'autre.
 */

const SYSTEME = [
  { name: 'Thomas', lang: 'fr-FR', default: true, localService: true },
  { name: 'Amélie', lang: 'fr-CA', localService: true },
  { name: 'Google français', lang: 'fr-FR', localService: false },
  { name: 'Thomas', lang: 'fr-FR', localService: true },
  { name: 'Daniel', lang: 'en-GB', localService: true },
  { name: 'Alice', lang: 'it-IT', localService: true },
];

test('seules les voix françaises sont proposées', () => {
  const noms = classerVoix(SYSTEME).map((v) => v.nom);
  assert.ok(!noms.includes('Daniel'));
  assert.ok(!noms.includes('Alice'));
  assert.deepEqual(new Set(noms), new Set(['Thomas', 'Amélie', 'Google français']));
});

/** Le même moteur déclaré deux fois donnait deux entrées indiscernables. */
test('une voix déclarée deux fois n’apparaît qu’une', () => {
  assert.equal(classerVoix(SYSTEME).filter((v) => v.nom === 'Thomas').length, 1);
});

/** Une voix distante s’interrompt quand le réseau hésite — au milieu d’un délai. */
test('les voix locales passent devant les voix distantes', () => {
  const ordre = classerVoix(SYSTEME).map((v) => v.nom);
  assert.ok(ordre.indexOf('Google français') === ordre.length - 1);
});

test('la région est nommée quand elle est connue', () => {
  const amelie = classerVoix(SYSTEME).find((v) => v.nom === 'Amélie');
  assert.equal(amelie?.libelle, 'Amélie — Canada');
});

test('aucune voix française installée : une liste vide, pas une erreur', () => {
  assert.deepEqual(classerVoix([{ name: 'Daniel', lang: 'en-GB' }]), []);
  assert.deepEqual(classerVoix([]), []);
});

/* ---------------------------------------------------------------- lecture --- */

const REPONSE = [
  'Le délai :',
  'Six mois avant l’échéance.',
  '',
  'Ce que je ferais à votre place :',
  '— compter six mois pleins depuis la date du contrat ;',
  '— faire délivrer le congé par commissaire de justice.',
].join('\n');

test('les deux-points d’intertitre deviennent un point, pas un mot', () => {
  const dit = pourLaVoix(REPONSE);
  assert.ok(dit.startsWith('Le délai. Six mois'));
  assert.ok(!dit.includes(':'));
});

test('le tiret d’énumération disparaît mais la pause reste', () => {
  const dit = pourLaVoix(REPONSE);
  assert.ok(!dit.includes('—'));
  assert.ok(dit.includes('commissaire de justice.'));
});

test('un texte vide ne produit rien à dire', () => {
  assert.equal(pourLaVoix(''), '');
  assert.deepEqual(decouperPourLaVoix(''), []);
  assert.deepEqual(decouperPourLaVoix('   \n  \n'), []);
});

/* ------------------------------------------------------------- découpage --- */

test('chaque morceau tient sous la limite du navigateur', () => {
  const long = 'Le bailleur doit respecter un préavis de six mois. '.repeat(40);
  for (const morceau of decouperPourLaVoix(long)) {
    assert.ok(morceau.length <= LONGUEUR_MAX, `${morceau.length} caractères`);
  }
});

/** Une synthèse qui reprend au milieu d’un mot est incompréhensible. */
test('une phrase interminable est coupée à un espace, jamais dans un mot', () => {
  const sansPonctuation = 'mot '.repeat(300).trim();
  const morceaux = decouperPourLaVoix(sansPonctuation);
  assert.ok(morceaux.length > 1);
  for (const morceau of morceaux) {
    assert.ok(morceau.length <= LONGUEUR_MAX);
    assert.ok(!morceau.startsWith(' ') && !morceau.endsWith(' '));
  }
  assert.equal(morceaux.join(' ').replace(/\s+/g, ' '), sansPonctuation);
});

test('rien n’est perdu entre le texte et ce qui est dit', () => {
  const morceaux = decouperPourLaVoix(REPONSE);
  assert.equal(morceaux.join(' '), pourLaVoix(REPONSE));
});
