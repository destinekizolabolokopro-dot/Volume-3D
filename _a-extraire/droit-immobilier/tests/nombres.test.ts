import assert from 'node:assert/strict';
import test from 'node:test';
import { dateLisible, nombreLisible } from '../lib/nombres.ts';

test('une date de fonds s’écrit en toutes lettres', () => {
  assert.equal(dateLisible('2026-09-08'), '8 septembre 2026');
  assert.equal(dateLisible('2025-12-31'), '31 décembre 2025');
});

test('le premier du mois prend son ordinal', () => {
  /* « 1 janvier » ne s'écrit pas en français, et c'est le seul jour du mois
     où la règle change. */
  assert.equal(dateLisible('2026-01-01'), '1ᵉʳ janvier 2026');
  assert.equal(dateLisible('2026-08-01'), '1ᵉʳ août 2026');
  assert.equal(dateLisible('2026-08-02'), '2 août 2026');
});

test('une date illisible est rendue telle quelle plutôt que devinée', () => {
  assert.equal(dateLisible(''), '');
  assert.equal(dateLisible('jamais'), 'jamais');
  assert.equal(dateLisible('2026-00-08'), '2026-00-08');
});

test('les milliers prennent l’espace fine insécable', () => {
  /* U+202F, et pas une espace ordinaire : sans elle, « 2 133 » peut se couper
     en fin de ligne et le nombre se lit en deux morceaux. */
  assert.equal(nombreLisible(2133), '2 133');
  assert.equal(nombreLisible(1000000), '1 000 000');
  assert.equal(nombreLisible(423), '423');
});

test('aucune espace ordinaire ne subsiste dans un nombre', () => {
  for (const valeur of [1234, 12345, 123456, 1234567]) {
    assert.ok(!nombreLisible(valeur).includes(' '), `espace ordinaire dans ${valeur}`);
  }
});
