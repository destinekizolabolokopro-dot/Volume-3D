import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.AUTH_SECRET = 'un-secret-de-test-suffisamment-long';

const { emettreJeton, hashPassword, lireJeton, sessionsConfigurees, verifyPassword } = await import(
  '../lib/sessions.ts'
);

/**
 * La mécanique des sessions, vérifiée là où elle peut casser.
 *
 * L'invariant qui compte est le deuxième test. `AUTH_SECRET` se recopie d'un
 * déploiement à l'autre ; sans la portée dans la signature, un cookie émis par
 * un autre service partageant ce secret aurait exactement la forme d'un cookie
 * d'ici et ouvrirait une session sur le compte du même identifiant.
 */

test('un jeton s’ouvre avec sa propre portée', () => {
  const jeton = emettreJeton('juridique', 'compte-1');
  assert.equal(lireJeton('juridique', jeton), 'compte-1');
});

test('un jeton signé pour un autre service n’ouvre rien ici', () => {
  const ailleurs = emettreJeton('un-autre-service', 'compte-1');
  assert.equal(lireJeton('juridique', ailleurs), null);

  const ici = emettreJeton('juridique', 'compte-1');
  assert.equal(lireJeton('un-autre-service', ici), null);
});

/** Le même identifiant, deux portées : deux jetons qui ne se confondent pas. */
test('la portée change la signature, à identifiant et instant égaux', () => {
  const fige = 1_700_000_000_000;
  assert.notEqual(emettreJeton('un-autre-service', 'x', fige), emettreJeton('juridique', 'x', fige));
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
