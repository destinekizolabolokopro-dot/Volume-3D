import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diagnostiquer } from '../lib/pannes.ts';

/**
 * Le champ qui compte ici n'est pas le message mais `reessayable` : il décide
 * si l'écran propose un bouton. En proposer un qui ne peut pas marcher fait
 * cliquer quelqu'un dix fois sur une porte fermée ; ne pas en proposer là où
 * il marcherait fait retaper la question.
 */

test('une surcharge du service se réessaie', () => {
  const panne = diagnostiquer({ status: 529 });
  assert.equal(panne.reessayable, true);
  assert.match(panne.message, /saturé/);
});

test('une cadence dépassée se réessaie', () => {
  assert.equal(diagnostiquer({ status: 429 }).reessayable, true);
});

test('une clé refusée ne se réessaie pas', () => {
  const panne = diagnostiquer({ status: 401 });
  assert.equal(panne.reessayable, false);
  /* Et le message ne parle pas de clé d'API : ce n'est pas l'affaire de la
     personne qui pose une question sur son bail. */
  assert.ok(!/clé|API|token/i.test(panne.message));
});

test('une requête refusée ne se réessaie pas telle quelle', () => {
  const panne = diagnostiquer({ status: 400 });
  assert.equal(panne.reessayable, false);
  assert.match(panne.message, /Reformulez/);
});

test('une coupure réseau se reconnaît sans code', () => {
  const panne = diagnostiquer(new Error('fetch failed: ECONNRESET'));
  assert.equal(panne.reessayable, true);
  assert.match(panne.message, /conservée/);
});

test('un délai dépassé se reconnaît au nom de l’erreur', () => {
  const erreur = new Error('Request timed out.');
  erreur.name = 'APIConnectionTimeoutError';
  assert.equal(diagnostiquer(erreur).reessayable, true);
});

test('une panne serveur se réessaie', () => {
  assert.equal(diagnostiquer({ status: 502 }).reessayable, true);
});

test('une erreur inconnue se réessaie plutôt que de perdre la question', () => {
  const panne = diagnostiquer(undefined);
  assert.equal(panne.reessayable, true);
  assert.match(panne.message, /conservée/);
});

test('tous les messages proposent un geste et restent en français simple', () => {
  for (const cause of [{ status: 529 }, { status: 429 }, { status: 401 }, { status: 400 }, {}]) {
    const { message } = diagnostiquer(cause);
    assert.ok(message.length > 40, message);
    assert.ok(!/[Ee]rror|null|undefined|HTTP/.test(message), message);
  }
});
