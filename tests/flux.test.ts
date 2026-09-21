import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decoupeur, lireEvenement, phraseDAttente } from '../lib/flux.ts';

/**
 * Le découpage d'un flux est le genre de code qui marche toujours en local et
 * casse une fois sur trois en production : les morceaux y arrivent entiers,
 * là-bas ils sont coupés au hasard de la taille des paquets. Ces tests
 * coupent donc exprès aux pires endroits.
 */

test('un morceau qui finit au milieu d’une ligne ne rend rien de tronqué', () => {
  const coupe = decoupeur();
  assert.deepEqual(coupe.avaler('{"t":"mo'), []);
  assert.deepEqual(coupe.avaler('t","d":"En clair"}\n'), ['{"t":"mot","d":"En clair"}']);
});

test('plusieurs lignes dans un seul morceau ressortent toutes', () => {
  const coupe = decoupeur();
  assert.deepEqual(coupe.avaler('{"a":1}\n{"b":2}\n'), ['{"a":1}', '{"b":2}']);
});

test('une coupure en plein milieu d’un caractère de fin se recolle', () => {
  const coupe = decoupeur();
  assert.deepEqual(coupe.avaler('{"a":1}'), []);
  assert.deepEqual(coupe.avaler('\n{"b":2}'), ['{"a":1}']);
  assert.deepEqual(coupe.fin(), ['{"b":2}']);
});

test('un flux fermé sans saut de ligne final ne perd pas sa dernière ligne', () => {
  const coupe = decoupeur();
  coupe.avaler('{"t":"fin"}');
  assert.deepEqual(coupe.fin(), ['{"t":"fin"}']);
});

test('les lignes vides sont ignorées', () => {
  const coupe = decoupeur();
  assert.deepEqual(coupe.avaler('\n\n{"a":1}\n\n'), ['{"a":1}']);
});

test('une ligne illisible est écartée sans faire tomber le reste', () => {
  assert.equal(lireEvenement('pas du json'), null);
  assert.equal(lireEvenement('null'), null);
  assert.equal(lireEvenement('[1,2]'), null);
  assert.equal(lireEvenement('{"t":"inconnu"}'), null);
});

test('un événement connu est rendu tel quel', () => {
  const lu = lireEvenement('{"t":"mot","d":"En clair"}');
  assert.deepEqual(lu, { t: 'mot', d: 'En clair' });
});

/* ------------------------------------------------------------ l'attente --- */

test('sans étape, la phrase dit qu’on prend connaissance', () => {
  assert.match(phraseDAttente('Bail d’habitation', null), /prend connaissance/);
});

test('la recherche dit ce qui est cherché', () => {
  const phrase = phraseDAttente('Bail d’habitation', {
    t: 'etape',
    quoi: 'recherche',
    detail: 'indice de référence des loyers 2026',
  });
  assert.match(phrase, /indice de référence des loyers 2026/);
});

test('une recherche sans détail reste une phrase complète', () => {
  const phrase = phraseDAttente('', { t: 'etape', quoi: 'recherche' });
  assert.match(phrase, /^L’assistant/);
  assert.ok(!phrase.includes('undefined'));
});

test('sans spécialité nommée, la phrase ne laisse pas de trou', () => {
  assert.match(phraseDAttente('', null), /^L’assistant/);
});
