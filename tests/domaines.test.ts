import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mots } from '../lib/aiguillage.ts';
import { DOMAINES, domaine, domaineOuNull, estDomaineId } from '../lib/domaines.ts';

/**
 * Le catalogue est du contenu, mais il obéit à des règles que rien d'autre ne
 * vérifie : un renvoi vers un domaine supprimé, un mot-clé écrit avec des
 * accents ou une fiche sans délai ne cassent aucune compilation — ils
 * produisent juste un aiguillage qui ne marche pas et un spécialiste muet sur
 * l'essentiel.
 */

test('chaque spécialité a un identifiant unique', () => {
  const ids = DOMAINES.map((fiche) => fiche.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('tous les renvois pointent vers une spécialité qui existe, et jamais vers soi-même', () => {
  for (const fiche of DOMAINES) {
    for (const renvoi of fiche.renvois) {
      assert.ok(estDomaineId(renvoi.vers), `${fiche.id} renvoie vers ${renvoi.vers}, inconnu`);
      assert.notEqual(renvoi.vers, fiche.id, `${fiche.id} se renvoie à lui-même`);
    }
  }
});

test('aucune fiche n’est vide de ce qui la rend utile', () => {
  for (const fiche of DOMAINES) {
    assert.ok(fiche.matieres.length >= 3, `${fiche.id} : trop peu de matières`);
    assert.ok(fiche.delais.length >= 3, `${fiche.id} : les délais sont ce qu'on vient chercher`);
    assert.ok(fiche.sources.length >= 2, `${fiche.id} : pas de texte de référence`);
    assert.ok(fiche.exemples.length >= 3, `${fiche.id} : pas assez d'exemples`);
    assert.ok(fiche.signaux.length >= 10, `${fiche.id} : trop peu de mots décisifs`);
  }
});

/**
 * Les mots-clés sont comparés à un texte déjà normalisé — minuscules, sans
 * accents ni apostrophes. Un mot-clé écrit « propriété » ne serait donc jamais
 * trouvé, et rien ne le signalerait à l'exécution.
 */
test('les mots-clés sont écrits sous la forme normalisée', () => {
  for (const fiche of DOMAINES) {
    for (const expression of [...fiche.signaux, ...fiche.motsCles]) {
      assert.equal(
        mots(expression).join(' '),
        expression,
        `${fiche.id} : « ${expression} » n'est pas sous forme normalisée`,
      );
    }
  }
});

test('aucun mot décisif n’est décisif dans deux spécialités à la fois', () => {
  const vus = new Map<string, string>();
  for (const fiche of DOMAINES) {
    for (const signal of fiche.signaux) {
      const deja = vus.get(signal);
      assert.equal(
        deja,
        undefined,
        `« ${signal} » est décisif pour ${deja} et ${fiche.id} : il ne décide donc rien`,
      );
      vus.set(signal, fiche.id);
    }
  }
});

test('domaine lève sur un identifiant inconnu, domaineOuNull renvoie null', () => {
  assert.throws(() => domaine('inexistant' as never));
  assert.equal(domaineOuNull('inexistant'), null);
  assert.equal(domaineOuNull(42), null);
  assert.equal(domaineOuNull('travail')?.id, 'travail');
});
