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

/*
 * LE CLASSEMENT PAR QUALITÉ.
 *
 * Les voix locales passaient devant, au motif qu'une voix distante s'arrête
 * quand le réseau hésite. Le raisonnement était juste, la conséquence
 * mauvaise : les voix locales sont exactement les anciennes — eSpeak, Hortense,
 * les « Compact » d'Apple —, si bien que le réglage par défaut choisissait à
 * tous les coups la plus robotique installée sur la machine.
 *
 * Ces tests tiennent la nouvelle règle. Sans eux, le prochain qui lira le
 * commentaire d'origine — qui n'était pas faux — remettra les locales devant.
 */

test('un moteur moderne passe devant un moteur ancien', () => {
  const ordre = classerVoix([
    { name: 'eSpeak French', lang: 'fr-FR', localService: true, default: true },
    { name: 'Microsoft Denise Online (Natural) - French (France)', lang: 'fr-FR' },
  ]).map((v) => v.nom);

  assert.equal(ordre[0], 'Microsoft Denise Online (Natural) - French (France)');
});

test('les moteurs des années 2000 ferment la marche, même déclarés par défaut', () => {
  const ordre = classerVoix([
    { name: 'Thomas (Compact)', lang: 'fr-FR', localService: true, default: true },
    { name: 'Microsoft Hortense - French (France)', lang: 'fr-FR', localService: true },
    { name: 'Thomas', lang: 'fr-FR', localService: true },
  ]).map((v) => v.nom);

  assert.equal(ordre[0], 'Thomas');
  assert.ok(ordre.indexOf('Thomas (Compact)') > 0);
  assert.ok(ordre.indexOf('Microsoft Hortense - French (France)') > 0);
});

test('à qualité égale, la voix qui ne dépend de rien gagne', () => {
  /* La crainte d'origine reste traitée — mais en dernier recours, pas en
     premier, et le découpage sous 200 caractères fait le reste. */
  const ordre = classerVoix([
    { name: 'Aurélie distante', lang: 'fr-FR', localService: false },
    { name: 'Aurélie locale', lang: 'fr-FR', localService: true },
  ]).map((v) => v.nom);

  assert.equal(ordre[0], 'Aurélie locale');
});

test('la meilleure voix se signale dans la liste', () => {
  const [premiere] = classerVoix([
    { name: 'Microsoft Denise Online (Natural) - French (France)', lang: 'fr-FR' },
    { name: 'eSpeak French', lang: 'fr-FR', localService: true },
  ]);
  assert.equal(premiere.moderne, true);
  assert.match(premiere.libelle, /la plus naturelle/);
});

test('une voix ordinaire ne se vante de rien', () => {
  const [thomas] = classerVoix([{ name: 'Thomas', lang: 'fr-FR', localService: true }]);
  assert.equal(thomas.moderne, false);
  assert.doesNotMatch(thomas.libelle, /naturelle/);
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


/* ------------------------------------------------- ce qui ne se dit pas --- */

test('le détail juridique n’est pas lu à voix haute', () => {
  const dit = pourLaVoix(
    [
      'En clair :',
      'Vous avez un mois.',
      '',
      'Le détail juridique :',
      'L’article 22 de la loi n° 89-462 du 6 juillet 1989 dispose que…',
    ].join('\n'),
  );

  assert.match(dit, /Vous avez un mois/);
  /* Sans quoi la synthèse épelle « quatre-vingt-neuf tiret quatre cent
     soixante-deux » pendant une minute, à quelqu’un qui a les mains prises. */
  assert.doesNotMatch(dit, /89-462/);
  assert.doesNotMatch(dit, /détail juridique/i);
});

test('une réponse sans détail est dite en entier', () => {
  const dit = pourLaVoix('Le délai :\nUn mois à compter de la remise des clés.');
  assert.match(dit, /Un mois à compter de la remise des clés/);
  assert.match(dit, /^Le délai\./);
});
