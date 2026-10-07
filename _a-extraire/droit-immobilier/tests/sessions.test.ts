import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.AUTH_SECRET = 'un-secret-de-test-suffisamment-long';

const {
  emettreJeton,
  empreinteDuMotDePasse,
  hashPassword,
  identifiantNonVerifie,
  lireJeton,
  sessionsConfigurees,
  verifyPassword,
} = await import('../lib/sessions.ts');

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

/* ================================= le jeton meurt avec le mot de passe === */

/**
 * LE TEST QUI COMPTE LE PLUS DE CE FICHIER.
 *
 * Quelqu'un dont le compte vient d'être pris fait exactement le bon geste : il
 * change son mot de passe. Avant, cela ne faisait rien aux sessions déjà
 * ouvertes — celui qui était entré gardait son accès trente jours, sur un
 * service où l'on dépose des baux et où l'on raconte des litiges.
 */
test('changer de mot de passe ferme les sessions ouvertes', async () => {
  const avant = await hashPassword('ancien-mot-de-passe');
  const apres = await hashPassword('nouveau-mot-de-passe');

  const porteeAvant = `juridique.${empreinteDuMotDePasse(avant)}`;
  const porteeApres = `juridique.${empreinteDuMotDePasse(apres)}`;

  const cookie = emettreJeton(porteeAvant, 'compte-1');

  assert.equal(lireJeton(porteeAvant, cookie), 'compte-1', 'le jeton valait avant');
  assert.equal(lireJeton(porteeApres, cookie), null, 'il vaut encore après le changement');
});

test('deux mots de passe différents donnent deux empreintes différentes', async () => {
  const a = empreinteDuMotDePasse(await hashPassword('motdepasse-un'));
  const b = empreinteDuMotDePasse(await hashPassword('motdepasse-deux'));
  assert.notEqual(a, b);
});

test('la même empreinte stockée donne toujours la même portée', async () => {
  /* Sans cela, chaque lecture invaliderait la session précédente et personne
     ne resterait connecté plus d'une requête. */
  const empreinte = await hashPassword('stable');
  assert.equal(empreinteDuMotDePasse(empreinte), empreinteDuMotDePasse(empreinte));
});

test('l’empreinte ne laisse rien filtrer du hachage', async () => {
  const stocke = await hashPassword('motdepasse');
  const empreinte = empreinteDuMotDePasse(stocke);
  assert.equal(empreinte.length, 12);
  assert.ok(!stocke.includes(empreinte), 'l’empreinte est un morceau du hachage');
});

/* ========================== l'identifiant lu avant vérification === */

test('l’identifiant non vérifié se lit, et n’ouvre rien par lui-même', () => {
  const jeton = emettreJeton('juridique.abc', 'compte-7');
  assert.equal(identifiantNonVerifie(jeton), 'compte-7');
  /* Il sert à savoir quelle ligne charger, pas à autoriser : la signature
     reste à vérifier, et avec la bonne portée. */
  assert.equal(lireJeton('juridique.autre', jeton), null);
});

test('un jeton fabriqué de toutes pièces annonce un identifiant mais ne vaut rien', () => {
  const faux = `compte-7.${Date.now() + 100000}.signaturebidon`;
  assert.equal(identifiantNonVerifie(faux), 'compte-7');
  assert.equal(lireJeton('juridique.abc', faux), null);
});

test('une forme inattendue ne donne aucun identifiant', () => {
  for (const jeton of ['', 'deux.parts', 'a.b.c.d', '.expire.signature']) {
    assert.equal(identifiantNonVerifie(jeton), null, JSON.stringify(jeton));
  }
  assert.equal(identifiantNonVerifie(undefined), null);
});
