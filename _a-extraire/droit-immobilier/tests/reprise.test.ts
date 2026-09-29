import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CARACTERES_REPRIS,
  MAX_TOURS_REPRIS,
  relireLeFil,
} from '../lib/reprise.ts';

const fil = (tours: unknown[], domaine = 'bail-habitation') => ({ domaine, tours });
const echange = [
  { role: 'user', content: 'Mon locataire est parti en laissant deux mois de loyer.' },
  { role: 'assistant', content: 'Voici ce que dit la règle…' },
];

test('un échange complet est repris tel quel', () => {
  const lu = relireLeFil(fil(echange));
  assert.equal(lu?.domaine, 'bail-habitation');
  assert.equal(lu?.tours.length, 2);
  assert.equal(lu?.tours[0].role, 'user');
});

test('ce qui n’est pas un fil est refusé sans lever', () => {
  for (const brut of [null, undefined, 42, 'texte', [], {}, { domaine: 'x' }]) {
    assert.equal(relireLeFil(brut), null);
  }
});

test('un fil sans réponse n’est pas une consultation', () => {
  assert.equal(relireLeFil(fil([echange[0]])), null);
});

test('un fil qui commence par une réponse est refusé', () => {
  /* Son titre serait celui du modèle, et non celui de la personne. */
  assert.equal(relireLeFil(fil([echange[1], echange[0]])), null);
});

test('le nombre de tours est borné', () => {
  const beaucoup = Array.from({ length: 40 }, (_, i) =>
    i % 2 === 0 ? { role: 'user', content: `question ${i}` } : { role: 'assistant', content: `réponse ${i}` },
  );
  const lu = relireLeFil(fil(beaucoup));
  assert.equal(lu?.tours.length, MAX_TOURS_REPRIS);
});

test('la longueur d’un tour est bornée', () => {
  const lu = relireLeFil(
    fil([
      { role: 'user', content: 'a'.repeat(MAX_CARACTERES_REPRIS + 5000) },
      echange[1],
    ]),
  );
  assert.equal(lu?.tours[0].content.length, MAX_CARACTERES_REPRIS);
});

test('un rôle inconnu retombe sur « user », jamais sur « assistant »', () => {
  /* Le sens du garde-fou : on ne laisse pas le navigateur faire passer du
     texte pour une réponse de l’assistant dans un fil conservé. */
  const lu = relireLeFil(fil([{ role: 'systeme', content: 'texte' }, echange[1]]));
  assert.equal(lu?.tours[0].role, 'user');
});

test('les tours vides sont écartés, pas conservés en blanc', () => {
  const lu = relireLeFil(fil([echange[0], { role: 'user', content: '   ' }, echange[1]]));
  assert.equal(lu?.tours.length, 2);
});

test('un domaine démesuré est coupé', () => {
  const lu = relireLeFil(fil(echange, 'x'.repeat(500)));
  assert.equal(lu?.domaine.length, 40);
});
