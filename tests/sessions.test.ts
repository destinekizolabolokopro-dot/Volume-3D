import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.AUTH_SECRET = 'un-secret-de-test-suffisamment-long';

const { emettreJeton, hashPassword, lireJeton, sessionsConfigurees, verifyPassword } = await import(
  '../lib/sessions.ts'
);

/**
 * Volume3D et l'assistant juridique sont deux services distincts, et ils
 * partagent une seule chose : cette mécanique. Ce fichier vérifie qu'elle les
 * sépare vraiment.
 *
 * L'invariant qui compte est le troisième test. Les deux cookies sont signés
 * par le même AUTH_SECRET ; sans la portée dans la signature, un jeton émis
 * pour les visites 3D ouvrirait une session juridique, et la séparation ne
 * serait qu'une affaire d'affichage.
 */

test('un jeton s’ouvre avec sa propre portée', () => {
  const jeton = emettreJeton('juridique', 'compte-1');
  assert.equal(lireJeton('juridique', jeton), 'compte-1');
});

test('un jeton d’un service n’ouvre pas de session dans l’autre', () => {
  const cote3d = emettreJeton('v3d', 'compte-1');
  assert.equal(lireJeton('juridique', cote3d), null);

  const coteDroit = emettreJeton('juridique', 'compte-1');
  assert.equal(lireJeton('v3d', coteDroit), null);
});

/** Deux comptes différents portant le même identifiant restent distincts. */
test('un même identifiant des deux côtés donne deux jetons différents', () => {
  const fige = 1_700_000_000_000;
  assert.notEqual(emettreJeton('v3d', 'x', fige), emettreJeton('juridique', 'x', fige));
});

test('un jeton expiré ne vaut rien', () => {
  const jeton = emettreJeton('juridique', 'compte-1', 0);
  assert.equal(lireJeton('juridique', jeton, Date.now()), null);
});

test('un jeton trafiqué est refusé, quel que soit l’endroit', () => {
  const jeton = emettreJeton('juridique', 'compte-1');
  const [id, expiration, signature] = jeton.split('.');
  assert.equal(lireJeton('juridique', `compte-2.${expiration}.${signature}`), null);
  assert.equal(lireJeton('juridique', `${id}.${Number(expiration) + 1}.${signature}`), null);
  assert.equal(lireJeton('juridique', `${id}.${expiration}.${signature.slice(0, -1)}x`), null);
  assert.equal(lireJeton('juridique', 'nimportequoi'), null);
  assert.equal(lireJeton('juridique', undefined), null);
});

test('deux comptes au même mot de passe ont deux empreintes', async () => {
  const a = await hashPassword('correcthorsebatterystaple');
  const b = await hashPassword('correcthorsebatterystaple');
  assert.notEqual(a, b);
  assert.ok(await verifyPassword('correcthorsebatterystaple', a));
  assert.ok(await verifyPassword('correcthorsebatterystaple', b));
  assert.equal(await verifyPassword('autre chose', a), false);
});

test('une empreinte tronquée ne valide rien', async () => {
  assert.equal(await verifyPassword('x', ''), false);
  assert.equal(await verifyPassword('x', 'selsansempreinte'), false);
  assert.equal(await verifyPassword('x', 'sel:trop-court'), false);
});

test('un secret trop court interdit les sessions au lieu de les affaiblir', () => {
  const garde = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'court';
  assert.equal(sessionsConfigurees(), false);
  assert.throws(() => emettreJeton('juridique', 'compte-1'), /AUTH_SECRET/);
  process.env.AUTH_SECRET = garde;
  assert.equal(sessionsConfigurees(), true);
});
