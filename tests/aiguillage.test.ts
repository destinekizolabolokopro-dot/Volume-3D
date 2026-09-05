import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiguiller, mots } from '../lib/aiguillage.ts';
import type { DomaineId } from '../lib/domaines.ts';

/**
 * L'aiguillage se juge sur des questions écrites comme on les écrit vraiment :
 * en minuscules, avec des fautes d'accent, sans vocabulaire juridique. Le
 * corpus ci-dessous est là pour ça — chaque ligne est une phrase qu'on peut
 * lire sur un forum d'entraide, pas un énoncé d'examen.
 */
const CORPUS: [string, DomaineId][] = [
  ['mon propriétaire refuse de me rendre le dépôt de garantie', 'immobilier'],
  ['le syndic a fait voter des travaux en assemblée générale, je conteste', 'immobilier'],
  ['j’ai été licencié pour faute grave sans entretien préalable', 'travail'],
  ['mon employeur ne paye pas mes heures supplémentaires', 'travail'],
  ['je veux divorcer, on a deux enfants en garde alternée', 'famille'],
  ['mon ex ne verse plus la pension alimentaire depuis six mois', 'famille'],
  ['mon lave-linge est tombé en panne après 15 mois, le vendeur refuse', 'consommation'],
  ['un demarcheur m’a fait signer pour des panneaux solaires', 'consommation'],
  ['la caf me réclame un trop perçu de 4000 euros', 'social'],
  ['france travail m’a radié sans prévenir', 'social'],
  ['ma plainte pour escroquerie a été classée sans suite', 'penal'],
  ['je suis convoqué au commissariat, que faire', 'penal'],
  ['la mairie a refusé mon permis de construire', 'administratif'],
  ['j’ai reçu une oqtf de 30 jours', 'etrangers'],
  ['la préfecture refuse de renouveler mon titre de séjour', 'etrangers'],
  ['mon frère occupe seul la maison dont nous avons hérité', 'succession'],
  ['mon père a fait un testament qui déshérite ma soeur', 'succession'],
  ['un client professionnel ne paye pas ma facture depuis 4 mois', 'affaires'],
  ['mon associé bloque toutes les décisions de la sarl', 'affaires'],
  ['j’ai reçu une proposition de rectification après un controle fiscal', 'fiscal'],
  ['comment contester ma taxe fonciere qui a doublé', 'fiscal'],
  ['mon permis a été invalidé pour solde de points nul', 'routier'],
  ['je conteste un exces de vitesse relevé par un radar', 'routier'],
  ['une photo de moi est publiée sur facebook sans mon accord', 'numerique'],
  ['mon ancien employeur refuse d’effacer mes données, je saisis la cnil', 'numerique'],
];

test('l’aiguillage range correctement les questions du corpus', () => {
  const rates: string[] = [];
  for (const [question, attendu] of CORPUS) {
    const resultat = aiguiller(question);
    if (resultat.domaine !== attendu) {
      rates.push(`« ${question} » → ${resultat.domaine ?? 'aucun'} au lieu de ${attendu}`);
    }
  }
  assert.deepEqual(rates, []);
});

test('les accents et les apostrophes ne changent rien au résultat', () => {
  const avec = aiguiller('J’ai reçu une décision de la préfecture : OQTF sous 30 jours.');
  const sans = aiguiller('j ai recu une decision de la prefecture oqtf sous 30 jours');
  assert.equal(avec.domaine, sans.domaine);
  assert.equal(avec.domaine, 'etrangers');
});

test('le pluriel est toléré dans les deux sens', () => {
  assert.equal(aiguiller('mes impôts ont augmenté après un contrôle fiscal').domaine, 'fiscal');
  assert.equal(aiguiller('question sur les baux et les loyers').domaine, 'immobilier');
});

test('une question sans aucun repère ne prétend pas être rangée', () => {
  const resultat = aiguiller('bonjour, j’aurais une question à vous poser');
  assert.equal(resultat.certitude, 'nulle');
  assert.equal(resultat.domaine, null);
  assert.deepEqual(resultat.pistes, []);
});

test('une question vide ne lève pas', () => {
  assert.equal(aiguiller('').certitude, 'nulle');
  assert.equal(aiguiller('   ').domaine, null);
});

/**
 * Le cas qui justifie l'arbitrage par le modèle : deux domaines nommés dans
 * la même phrase, avec des poids comparables. L'aiguillage doit alors dire
 * qu'il hésite, et proposer les deux — pas trancher sur un point d'écart.
 */
test('deux spécialités également plausibles produisent une hésitation', () => {
  const resultat = aiguiller(
    'j’ai un litige avec mon syndic, et mon employeur ne me verse plus mon salaire',
  );
  assert.equal(resultat.certitude, 'hesitante');
  const proposes = resultat.pistes.map((piste) => piste.id);
  assert.ok(proposes.includes('travail'));
  assert.ok(proposes.includes('immobilier'));
});

test('les indices renvoyés sont ceux qui ont réellement décidé', () => {
  const resultat = aiguiller('mon propriétaire garde le dépôt de garantie après l’état des lieux');
  assert.equal(resultat.domaine, 'immobilier');
  assert.ok(resultat.pistes[0].indices.includes('depot de garantie'));
  assert.ok(resultat.pistes[0].indices.includes('etat des lieux'));
});

test('le résultat est stable : deux appels donnent le même classement', () => {
  const question = 'litige avec mon voisin sur la clôture mitoyenne du terrain';
  assert.deepEqual(aiguiller(question), aiguiller(question));
});

test('mots normalise ce qui lui est donné', () => {
  assert.deepEqual(mots('L’OQTF, reçue hier !'), ['l', 'oqtf', 'recue', 'hier']);
  assert.deepEqual(mots('   '), []);
});
