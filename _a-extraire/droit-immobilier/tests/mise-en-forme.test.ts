import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decouper } from '../lib/mise-en-forme.ts';

/**
 * Ce qui est testé ici, ce n'est pas un rendu : c'est la promesse que rien
 * n'est perdu entre le texte du spécialiste et ce que la personne lit. Un
 * délai avalé par un découpage raté est un délai qui n'a pas été dit.
 */

test('les intertitres deviennent des titres, sans leurs deux points', () => {
  const blocs = decouper('Le délai :\nDouze mois à compter de la notification.');
  assert.deepEqual(blocs, [
    { type: 'titre', texte: 'Le délai' },
    { type: 'paragraphe', texte: 'Douze mois à compter de la notification.' },
  ]);
});

test('une phrase longue terminée par deux points reste un paragraphe', () => {
  const longue =
    'Trois éléments doivent être réunis pour que le licenciement soit régulier, et les voici :';
  const blocs = decouper(longue);
  assert.deepEqual(blocs, [{ type: 'paragraphe', texte: longue }]);
});

test('les tirets forment une énumération, quel que soit le tiret employé', () => {
  const blocs = decouper('— premier point\n- deuxième point\n• troisième point');
  assert.deepEqual(blocs, [
    { type: 'liste', points: ['premier point', 'deuxième point', 'troisième point'] },
  ]);
});

test('un paragraphe reprend après une énumération sans ligne vide', () => {
  const blocs = decouper('Voici les cas :\n— le premier\n— le second\nDans tous les cas, agissez vite.');
  assert.deepEqual(blocs, [
    { type: 'titre', texte: 'Voici les cas' },
    { type: 'liste', points: ['le premier', 'le second'] },
    { type: 'paragraphe', texte: 'Dans tous les cas, agissez vite.' },
  ]);
});

test('les lignes d’un même paragraphe sont recollées en une seule phrase', () => {
  const blocs = decouper('Une phrase coupée\nsur deux lignes.');
  assert.deepEqual(blocs, [{ type: 'paragraphe', texte: 'Une phrase coupée sur deux lignes.' }]);
});

test('aucun bloc vide n’est produit, même sur un texte creux', () => {
  assert.deepEqual(decouper(''), []);
  assert.deepEqual(decouper('\n\n   \n'), []);
  assert.deepEqual(decouper('—\n— \n'), []);
});

test('rien n’est interprété comme du balisage', () => {
  const blocs = decouper('Écrivez <b>ceci</b> et **cela** dans votre courrier.');
  assert.deepEqual(blocs, [
    { type: 'paragraphe', texte: 'Écrivez <b>ceci</b> et **cela** dans votre courrier.' },
  ]);
});
