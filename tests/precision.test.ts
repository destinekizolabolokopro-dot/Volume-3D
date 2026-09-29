import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_OPTIONS, lirePrecision, texteDeLaQuestion } from '../lib/juridique/precision.ts';

/**
 * Ce que le modèle renvoie par un outil est déclaré conforme au schéma, mais
 * « conforme » ne veut pas dire « affichable » : une question vide valide le
 * schéma, huit options aussi. Ce module est la porte entre les deux, et ces
 * tests décrivent ce qu'elle laisse passer.
 */

test('une question lisible passe telle quelle', () => {
  const precision = lirePrecision({
    question: 'Le bail est-il vide ou meublé ?',
    pourquoi: 'Le préavis du bailleur est de six mois pour un vide, trois pour un meublé.',
    options: ['Vide', 'Meublé'],
  });
  assert.equal(precision?.question, 'Le bail est-il vide ou meublé ?');
  assert.deepEqual(precision?.options, ['Vide', 'Meublé']);
});

test('une question vide ou absente ne produit pas de bulle muette', () => {
  assert.equal(lirePrecision(null), null);
  assert.equal(lirePrecision({}), null);
  assert.equal(lirePrecision({ question: '  ' }), null);
  assert.equal(lirePrecision({ question: '?' }), null);
  assert.equal(lirePrecision('une chaîne'), null);
});

/** Un seul bouton n'offre aucun choix : mieux vaut laisser écrire. */
test('une option unique est retirée', () => {
  const precision = lirePrecision({ question: 'Quelle commune ?', options: ['Paris'] });
  assert.deepEqual(precision?.options, []);
});

test('les options sont plafonnées, et les vides écartées', () => {
  const precision = lirePrecision({
    question: 'Quel régime ?',
    options: ['a', '', 'b', '   ', 'c', 'd', 'e', 'f', 'g'],
  });
  assert.equal(precision?.options.length, MAX_OPTIONS);
  assert.ok(!precision?.options.includes(''));
});

test('une question sans option reste une question — une date ne se clique pas', () => {
  const precision = lirePrecision({
    question: 'À quelle date les clés ont-elles été rendues ?',
    pourquoi: 'Le délai de restitution court à partir de là.',
    options: [],
  });
  assert.deepEqual(precision?.options, []);
  assert.match(precision?.question ?? '', /clés/);
});

/**
 * Le fil n'enregistre que du texte : c'est ce qui permet de rouvrir une
 * consultation plus tard, et de renvoyer l'historique au modèle sans avoir à
 * reconstituer un appel d'outil resté sans réponse.
 */
test('la question conservée dans le fil porte tout ce qui a été demandé', () => {
  const texte = texteDeLaQuestion({
    question: 'Le bail est-il vide ou meublé ?',
    pourquoi: 'Le préavis change du simple au double.',
    options: ['Vide', 'Meublé'],
  });
  assert.match(texte, /Le bail est-il vide ou meublé/);
  assert.match(texte, /préavis/);
  assert.match(texte, /— Vide/);
  assert.match(texte, /— Meublé/);
});

test('sans option ni explication, le texte reste la seule question', () => {
  assert.equal(texteDeLaQuestion({ question: 'Quelle commune ?', pourquoi: '', options: [] }), 'Quelle commune ?');
});
