import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mots } from '../lib/aiguillage.ts';
import { DOMAINES, domaine, domaineOuNull, estDomaineId } from '../lib/domaines.ts';
import { ACCUEIL, DOSSIERS, LIMITES, ORIENTATION, SPECIALISTE } from '../lib/juridique-copie.ts';

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
  assert.equal(domaineOuNull('copropriete')?.id, 'copropriete');
});

/**
 * La ponctuation double française prend une espace AVANT, et cette espace est
 * insécable. Sans elle, le navigateur coupe où il veut : le titre de l'accueil
 * commençait une ligne par « ? Elle ira au bon spécialiste ».
 *
 * La règle est déjà celle du reste du site (voir `tests/residence.test.ts`) ;
 * elle s'applique ici à la copie du catalogue, qui est lue à l'écran autant
 * qu'envoyée au modèle. Les commentaires du code n'y sont pas soumis.
 */
test('la copie du catalogue porte ses espaces insécables', () => {
  const fautes: string[] = [];
  const verifier = (ou: string, texte: string) => {
    if (/ [?!;:]/.test(texte)) fautes.push(`${ou} — « ${texte} »`);
  };

  for (const fiche of DOMAINES) {
    verifier(`${fiche.id} · label`, fiche.label);
    verifier(`${fiche.id} · resume`, fiche.resume);
    fiche.matieres.forEach((t, i) => verifier(`${fiche.id} · matiere ${i}`, t));
    fiche.renvois.forEach((r, i) => verifier(`${fiche.id} · renvoi ${i}`, r.quand));
    fiche.sources.forEach((t, i) => verifier(`${fiche.id} · source ${i}`, t));
    fiche.delais.forEach((t, i) => verifier(`${fiche.id} · delai ${i}`, t));
    fiche.exemples.forEach((t, i) => verifier(`${fiche.id} · exemple ${i}`, t));
  }

  /* La copie des pages obéit à la même règle, et pour la même raison : elle a
     été sortie du JSX précisément parce que le JSX ramenait l'espace fine à
     une espace ordinaire. Si elle y retournait, ce test le dirait. */
  for (const [nom, bloc] of Object.entries({ ACCUEIL, SPECIALISTE, DOSSIERS, ORIENTATION })) {
    for (const [cle, texte] of Object.entries(bloc)) verifier(`${nom}.${cle}`, texte);
  }
  LIMITES.forEach((limite, i) => {
    verifier(`LIMITES ${i} · amorce`, limite.amorce);
    verifier(`LIMITES ${i} · suite`, limite.suite);
  });

  assert.deepEqual(fautes, []);
});
