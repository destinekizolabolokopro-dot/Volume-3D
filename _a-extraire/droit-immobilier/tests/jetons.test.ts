import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DUREE_MINUTES,
  empreinteDuJeton,
  etatDuJeton,
  expirationDepuis,
  fabriquerJeton,
  memeEmpreinte,
} from '../lib/jetons.ts';

test('un jeton est imprévisible et passe dans une adresse', () => {
  const tires = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    const jeton = fabriquerJeton();
    /* 32 octets en base64url : 43 caractères, aucun qui demande un encodage
       supplémentaire dans une URL. */
    assert.match(jeton, /^[A-Za-z0-9_-]{43}$/);
    tires.add(jeton);
  }
  assert.equal(tires.size, 500, 'deux tirages identiques');
});

test('l’empreinte est stable et ne rend pas le jeton', () => {
  const jeton = fabriquerJeton();
  const empreinte = empreinteDuJeton(jeton);
  assert.equal(empreinte, empreinteDuJeton(jeton));
  assert.match(empreinte, /^[0-9a-f]{64}$/);
  assert.ok(!empreinte.includes(jeton));
});

test('deux jetons différents n’ont pas la même empreinte', () => {
  assert.notEqual(empreinteDuJeton('a'), empreinteDuJeton('b'));
});

test('la comparaison d’empreintes reconnaît l’égalité et rien d’autre', () => {
  const a = empreinteDuJeton('jeton');
  assert.ok(memeEmpreinte(a, empreinteDuJeton('jeton')));
  assert.ok(!memeEmpreinte(a, empreinteDuJeton('autre')));
  /* Longueurs différentes : refus, sans lever. */
  assert.ok(!memeEmpreinte(a, ''));
  assert.ok(!memeEmpreinte('', a));
});

test('l’expiration tombe une heure plus tard', () => {
  const depart = new Date('2026-09-11T10:00:00.000Z');
  assert.equal(expirationDepuis(depart), '2026-09-11T11:00:00.000Z');
  assert.equal(DUREE_MINUTES, 60);
});

test('un jeton absent est inconnu, pas expiré', () => {
  /* La nuance compte : « inconnu » se dit à quelqu’un dont le lien n’a jamais
     existé, « expiré » à quelqu’un qui a attendu. Les deux écrans diffèrent. */
  assert.equal(etatDuJeton(null), 'inconnu');
});

test('un jeton déjà employé le dit, même s’il a aussi expiré', () => {
  const maintenant = new Date('2026-09-11T12:00:00.000Z');
  const ligne = { expireA: '2026-09-11T11:00:00.000Z', utiliseA: '2026-09-11T10:30:00.000Z' };
  /* L'emploi l'emporte sur l'expiration : un antivirus qui préouvre le lien
     doit s'entendre dire qu'il a déjà servi, ce qui est la vérité utile. */
  assert.equal(etatDuJeton(ligne, maintenant), 'deja-utilise');
});

test('un jeton périmé est expiré, à la seconde près', () => {
  const ligne = { expireA: '2026-09-11T11:00:00.000Z', utiliseA: '' };
  assert.equal(etatDuJeton(ligne, new Date('2026-09-11T10:59:59.000Z')), 'valide');
  /* L'instant exact de l'expiration est déjà trop tard : la comparaison est
     large, sans quoi une seconde de flou existerait dans les deux sens. */
  assert.equal(etatDuJeton(ligne, new Date('2026-09-11T11:00:00.000Z')), 'expire');
  assert.equal(etatDuJeton(ligne, new Date('2026-09-11T11:00:01.000Z')), 'expire');
});

test('un jeton frais et non employé est valide', () => {
  const ligne = { expireA: '2026-09-11T11:00:00.000Z', utiliseA: '' };
  assert.equal(etatDuJeton(ligne, new Date('2026-09-11T10:00:00.000Z')), 'valide');
});
