import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CHOIX, PLAFOND_CARACTERES } from '../lib/corpus-choix.ts';
import { nommerArticle, planDuCorpus, type Corpus } from '../lib/corpus.ts';
import { DOMAINES } from '../lib/domaines.ts';

/**
 * Le corpus est produit par un script qui parle à un serveur de l'État ; ces
 * tests ne le rejouent pas. Ils vérifient deux choses qu'on peut vérifier sans
 * réseau : que la déclaration couvre bien les dix spécialités, et que ce qui a
 * été construit tient les promesses affichées à côté.
 *
 * Quand `corpus/` n'existe pas — dépôt fraîchement cloné, avant `npm run
 * corpus` —, la seconde moitié ne s'exécute pas. C'est voulu : l'absence de
 * corpus est un état normal du dépôt, pas un échec. Le site répond alors comme
 * avant, en nommant les textes sans les numéroter.
 */

const RACINE = join(import.meta.dirname, '..');

test('chaque spécialité déclare les textes qu’elle a le droit de citer', () => {
  for (const fiche of DOMAINES) {
    const selections = CHOIX[fiche.id];
    assert.ok(selections && selections.length > 0, `${fiche.id} n’a aucun texte`);
    for (const selection of selections) {
      assert.ok(selection.nom.trim().length > 0, `${fiche.id} : un texte sans nom court`);
      assert.ok(selection.texte.source.length > 3, `${fiche.id} : ${selection.nom} trop vague`);
    }
  }
});

/**
 * Le nom court est ce qui s'affiche sous une citation. Deux textes du même
 * domaine portant le même nom rendraient la référence inutilisable — c'est
 * arrivé avec les deux décrets du 26 août 1987, qui ne se distinguent que par
 * leur objet.
 */
test('deux textes d’un même domaine ne portent pas le même nom', () => {
  for (const [domaineId, selections] of Object.entries(CHOIX)) {
    const noms = selections.map((selection) => selection.nom);
    assert.equal(new Set(noms).size, noms.length, `${domaineId} : deux textes homonymes`);
  }
});

const construits = Object.keys(CHOIX).filter((id) => existsSync(join(RACINE, 'corpus', `${id}.json`)));

test('le corpus construit dit ce qu’il contient', { skip: construits.length === 0 && 'corpus non construit' }, () => {
  for (const id of construits) {
    const corpus = JSON.parse(readFileSync(join(RACINE, 'corpus', `${id}.json`), 'utf8')) as Corpus;
    assert.equal(corpus.domaine, id);
    assert.match(corpus.arrete, /^\d{4}-\d{2}-\d{2}$/);

    assert.equal(
      corpus.documents.length,
      CHOIX[corpus.domaine].length,
      `${id} : autant de documents que de textes déclarés`,
    );

    for (const document of corpus.documents) {
      assert.ok(document.articles.length > 0, `${id} : ${document.nom} sans article`);
      for (const article of document.articles) {
        assert.ok(article.num.trim().length > 0, `${id} : un article sans numéro`);
        assert.ok(article.texte.trim().length > 0, `${id} : ${article.num} sans texte`);
      }
    }

    const taille = corpus.documents.reduce(
      (total, document) => total + document.articles.reduce((n, article) => n + article.texte.length, 0),
      0,
    );
    assert.ok(taille <= PLAFOND_CARACTERES, `${id} : ${taille} caractères, plafond ${PLAFOND_CARACTERES}`);
  }
});

/**
 * Le point sensible : le plan doit décrire EXACTEMENT les blocs envoyés au
 * modèle, sinon chaque citation désigne l'article voisin. Un décalage d'un
 * rang ne se verrait pas à la lecture — il produirait des références
 * plausibles et fausses, ce que ce projet ne peut pas se permettre.
 */
test('le plan compte autant de blocs que le corpus a d’articles', { skip: construits.length === 0 && 'corpus non construit' }, () => {
  for (const id of construits) {
    const corpus = JSON.parse(readFileSync(join(RACINE, 'corpus', `${id}.json`), 'utf8')) as Corpus;
    const plan = planDuCorpus(corpus);

    assert.equal(plan.documents.length, corpus.documents.length);
    corpus.documents.forEach((document, rang) => {
      assert.equal(plan.documents[rang].articles.length, document.articles.length);
      document.articles.forEach((article, place) => {
        assert.equal(plan.documents[rang].articles[place].article, nommerArticle(article.num));
      });
    });
  }
});
