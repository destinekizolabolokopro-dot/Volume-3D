import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dateLisible,
  donneAcces,
  etatDuStatut,
  phraseDEtat,
  type EtatAbonnement,
} from '../lib/facturation.ts';

/**
 * Deux erreurs sont possibles ici, et elles ne coûtent pas la même chose.
 *
 * Ouvrir une formule à qui n'a pas payé coûte de l'argent, silencieusement,
 * et personne ne s'en aperçoit. Fermer une formule à qui a payé coûte un
 * client, bruyamment. Ces tests décrivent les deux.
 */

test('les statuts payants ouvrent l’accès', () => {
  assert.equal(donneAcces(etatDuStatut('active')), true);
  assert.equal(donneAcces(etatDuStatut('trialing')), true);
});

test('un paiement en retard ne coupe pas l’accès', () => {
  /* Une carte expirée n'est pas une fraude, et Stripe relance plusieurs
     jours. Couper au premier échec ferait perdre un client qui voulait
     payer, pour une somme qui allait rentrer. */
  assert.equal(etatDuStatut('past_due'), 'retard');
  assert.equal(donneAcces('retard'), true);
});

test('tout le reste ferme', () => {
  for (const statut of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
    assert.equal(etatDuStatut(statut), 'clos', statut);
    assert.equal(donneAcces('clos'), false);
  }
});

test('un statut inconnu ferme, il n’ouvre pas', () => {
  /* Stripe peut en ajouter. Un statut neuf qui ouvrirait par oubli donnerait
     la formule Cabinet à qui n'a rien payé. */
  assert.equal(etatDuStatut('quelque_chose_de_nouveau'), 'clos');
  assert.equal(etatDuStatut(''), 'clos');
});

/* ------------------------------------------------------------- les mots --- */

test('le retard donne le geste, pas un compte à rebours', () => {
  const phrase = phraseDEtat('retard', '');
  assert.match(phrase, /moyen de paiement/);
  assert.ok(!/suspendu|coupé|bloqué/i.test(phrase), phrase);
});

test('une échéance connue est datée', () => {
  assert.match(phraseDEtat('actif', '2026-11-03T00:00:00.000Z'), /3 novembre 2026/);
});

test('sans date, la phrase s’arrête avant la date', () => {
  const phrase = phraseDEtat('actif', '');
  assert.equal(phrase, 'Abonnement actif.');
  assert.ok(!/Invalid|NaN|undefined/.test(phrase));
});

test('une date illisible ne s’affiche pas', () => {
  assert.equal(dateLisible('pas une date'), '');
  assert.equal(dateLisible(''), '');
  assert.ok(!phraseDEtat('essai', 'n’importe quoi').includes('Invalid'));
});

test('chaque état a une phrase, et aucune ne fuit de jargon', () => {
  for (const etat of ['actif', 'essai', 'retard', 'clos'] as EtatAbonnement[]) {
    const phrase = phraseDEtat(etat, '2026-11-03T00:00:00.000Z');
    assert.ok(phrase.length > 15, etat);
    assert.ok(!/stripe|past_due|subscription|status/i.test(phrase), phrase);
  }
});
