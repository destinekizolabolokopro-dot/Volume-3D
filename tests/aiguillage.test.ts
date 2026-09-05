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
  ['mon locataire est parti en laissant deux mois de loyer impayé', 'bail-habitation'],
  ['puis-je retenir le dépôt de garantie après l’état des lieux de sortie', 'bail-habitation'],
  ['j’ai oublié la révision annuelle du loyer, puis-je la rattraper', 'bail-habitation'],
  ['ma ville impose un numéro d’enregistrement pour louer sur airbnb', 'courte-duree'],
  ['un voyageur a cassé du mobilier pendant son séjour', 'courte-duree'],
  ['combien de jours puis-je louer ma résidence principale en meublé de tourisme', 'courte-duree'],
  ['l’assemblée générale a voté un ravalement que je conteste', 'copropriete'],
  ['le syndic ne répond plus et les charges augmentent', 'copropriete'],
  ['l’acquéreur refuse de signer l’acte alors que le compromis est signé', 'achat-vente'],
  ['une infiltration a été découverte après la vente, vice caché ou pas', 'achat-vente'],
  ['mon acheteur n’a pas notifié son refus de prêt dans le délai', 'achat-vente'],
  ['des fissures sont apparues deux ans après la réception des travaux', 'travaux'],
  ['l’artisan a encaissé l’acompte et a abandonné le chantier', 'travaux'],
  ['mon entreprise n’avait pas d’assurance décennale', 'travaux'],
  ['la mairie a refusé mon permis de construire pour une extension', 'urbanisme'],
  ['un voisin attaque mon permis, mon affichage était-il valable', 'urbanisme'],
  ['puis-je transformer mon garage en studio, changement de destination', 'urbanisme'],
  ['les arbres du voisin dépassent sur mon terrain, puis-je élaguer', 'voisinage'],
  ['il conteste la limite entre nos terrains, comment faire borner', 'voisinage'],
  ['micro bic ou régime réel pour un meublé qui rapporte 18000 euros', 'fiscalite'],
  ['comment est calculée la plus value sur un bien détenu depuis douze ans', 'fiscalite'],
  ['j’ai reçu une proposition de rectification sur mes revenus fonciers', 'fiscalite'],
  ['un dégât des eaux venu du dessus a abîmé mon plafond', 'sinistres'],
  ['mon assureur refuse d’indemniser le dégât des eaux', 'sinistres'],
  ['l’expert propose 2000 euros, je veux une contre expertise', 'sinistres'],
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
  const avec = aiguiller('L’assemblée générale a voté sans respecter la convocation à 21 jours.');
  const sans = aiguiller('l assemblee generale a vote sans respecter la convocation a 21 jours');
  assert.equal(avec.domaine, sans.domaine);
  assert.equal(avec.domaine, 'copropriete');
});

test('le pluriel est toléré dans les deux sens', () => {
  assert.equal(aiguiller('mes tantièmes de charges de copropriété ont changé').domaine, 'copropriete');
  assert.equal(aiguiller('question sur les baux et les quittances').domaine, 'bail-habitation');
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
 * Le cas qui justifie l'arbitrage par le modèle. Une fuite causée par un
 * locataire relève autant du bail que de l'assurance, et les mots-clés le
 * disent honnêtement : deux scores égaux. L'aiguillage propose alors les deux
 * au lieu de trancher sur l'ordre du catalogue.
 */
test('deux spécialités également plausibles produisent une hésitation', () => {
  const resultat = aiguiller('une fuite chez mon locataire a abîmé l’appartement du dessous');
  assert.equal(resultat.certitude, 'hesitante');
  const proposes = resultat.pistes.map((piste) => piste.id);
  assert.ok(proposes.includes('sinistres'));
  assert.ok(proposes.includes('bail-habitation'));
});

test('les indices renvoyés sont ceux qui ont réellement décidé', () => {
  const resultat = aiguiller('je rends le dépôt de garantie après l’état des lieux de sortie');
  assert.equal(resultat.domaine, 'bail-habitation');
  assert.ok(resultat.pistes[0].indices.includes('depot de garantie'));
  assert.ok(resultat.pistes[0].indices.includes('etat des lieux'));
});

test('le résultat est stable : deux appels donnent le même classement', () => {
  const question = 'litige avec mon voisin sur la clôture mitoyenne du terrain';
  assert.deepEqual(aiguiller(question), aiguiller(question));
});

test('mots normalise ce qui lui est donné', () => {
  assert.deepEqual(mots('L’état des lieux, reçu hier !'), ['l', 'etat', 'des', 'lieux', 'recu', 'hier']);
  assert.deepEqual(mots('   '), []);
});
