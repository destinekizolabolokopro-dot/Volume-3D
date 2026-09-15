import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CALENDRIER_ENERGIE, DIAGNOSTICS, diagnosticsPourLeModele } from '../lib/diagnostics.ts';
import { DOMAINES } from '../lib/domaines.ts';

/**
 * Le tableau des diagnostics est le seul endroit de cette zone où l'on
 * affirme un fait chiffré et vérifiable — « six mois », « dix ans ». C'est
 * précisément ce qu'un modèle invente le plus volontiers, et c'est pourquoi
 * la donnée est écrite ici plutôt que laissée à sa mémoire. Le prix à payer
 * est qu'elle doit être tenue : ces tests vérifient sa forme, pas son
 * exactitude, qui se relit à la main quand la réglementation bouge.
 */

test('chaque diagnostic dit ce qu’il est, quand il est exigé, et combien de temps il vaut', () => {
  assert.ok(DIAGNOSTICS.length >= 10);
  for (const diagnostic of DIAGNOSTICS) {
    assert.ok(diagnostic.nom.length > 3, `nom trop court : ${diagnostic.nom}`);
    assert.ok(diagnostic.quand.length > 20, `« quand » trop vague : ${diagnostic.nom}`);
    assert.ok(diagnostic.validite.length > 5, `validité manquante : ${diagnostic.nom}`);
  }
});

test('aucun diagnostic n’apparaît deux fois', () => {
  const noms = DIAGNOSTICS.map((diagnostic) => diagnostic.nom);
  assert.equal(new Set(noms).size, noms.length);
});

test('la mise à plat pour le modèle porte tout le tableau et sa mise en garde', () => {
  const texte = diagnosticsPourLeModele();
  for (const diagnostic of DIAGNOSTICS) assert.ok(texte.includes(diagnostic.nom), diagnostic.nom);
  for (const etape of CALENDRIER_ENERGIE) assert.ok(texte.includes(etape));
  /* La règle qui rend le tableau utilisable sans être dangereux : c'est le
     rapport de la personne qui fait foi, pas cette page. */
  assert.match(texte, /fait foi/);
  assert.match(texte, /demande-la au lieu de supposer/);
});

test('le tableau n’est donné qu’aux spécialités qui le manipulent', () => {
  const avec = DOMAINES.filter((fiche) => fiche.diagnostics).map((fiche) => fiche.id);
  assert.deepEqual(avec.sort(), ['achat-vente', 'bail-habitation', 'courte-duree', 'profession']);
});

test('la copie du tableau porte ses espaces insécables', () => {
  const fautes: string[] = [];
  const verifier = (ou: string, texte: string) => {
    if (/ [?!;:]/.test(texte)) fautes.push(`${ou} — « ${texte} »`);
  };
  DIAGNOSTICS.forEach((diagnostic, i) => {
    verifier(`diagnostic ${i} · nom`, diagnostic.nom);
    verifier(`diagnostic ${i} · quand`, diagnostic.quand);
    verifier(`diagnostic ${i} · validite`, diagnostic.validite);
  });
  CALENDRIER_ENERGIE.forEach((etape, i) => verifier(`calendrier ${i}`, etape));
  assert.deepEqual(fautes, []);
});
