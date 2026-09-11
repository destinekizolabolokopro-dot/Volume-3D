import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rassemblerLesReferences } from '../lib/juridique/citations.ts';
import { nommerArticle, planDuCorpus, type Corpus } from '../lib/juridique/corpus.ts';

/**
 * Une référence est la seule chose de ce projet qui sera recopiée telle quelle
 * dans un courrier, puis lue par un juge. Ces tests décrivent donc surtout ce
 * qui est REFUSÉ : mieux vaut une réponse sans référence qu'une référence à
 * moitié juste.
 */

const CORPUS: Corpus = {
  domaine: 'bail-habitation',
  arrete: '2026-09-08',
  documents: [
    {
      nom: 'loi du 6 juillet 1989',
      titre: 'Loi n° 89-462 du 6 juillet 1989 tendant à améliorer les rapports locatifs',
      cid: 'JORFTEXT000000509310',
      articles: [
        { num: '15', chemin: ['Titre Ier', 'Chapitre II'], texte: 'Lorsque le bailleur donne congé…' },
        { num: '22', chemin: ['Titre Ier', 'Chapitre II'], texte: 'Le dépôt de garantie…' },
      ],
    },
    {
      nom: 'code civil',
      titre: 'Code civil',
      cid: 'LEGITEXT000006070721',
      articles: [{ num: '1719', chemin: ['Livre III', 'Du louage'], texte: 'Le bailleur est obligé…' }],
    },
  ],
};

const PLAN = planDuCorpus(CORPUS);

test('une citation devient l’article exact, dans le bon texte', () => {
  const references = rassemblerLesReferences(
    [{ document_index: 0, start_block_index: 1, cited_text: 'Le dépôt de garantie…' }],
    PLAN,
  );
  assert.deepEqual(references, [
    {
      source: 'loi du 6 juillet 1989',
      article: 'Article 22',
      extrait: 'Le dépôt de garantie…',
      chemin: ['Titre Ier', 'Chapitre II'],
    },
  ]);
});

test('les documents ne se confondent pas', () => {
  const references = rassemblerLesReferences([{ document_index: 1, start_block_index: 0 }], PLAN);
  assert.equal(references[0]?.source, 'code civil');
  assert.equal(references[0]?.article, 'Article 1719');
});

/**
 * Le cas qui justifie ce fichier. Une pièce jointe déposée par le visiteur est
 * un document elle aussi : elle prend l'indice suivant. Rendue comme un
 * article du corpus, elle produirait une référence à un texte officiel qui ne
 * dit rien de tel.
 */
test('une citation hors corpus est jetée, jamais rapprochée', () => {
  assert.deepEqual(rassemblerLesReferences([{ document_index: 2, start_block_index: 0 }], PLAN), []);
  assert.deepEqual(rassemblerLesReferences([{ document_index: 0, start_block_index: 9 }], PLAN), []);
  assert.deepEqual(rassemblerLesReferences([{ cited_text: 'sans indice' }], PLAN), []);
});

test('le même article cité trois fois ne se lit qu’une', () => {
  const references = rassemblerLesReferences(
    [
      { document_index: 0, start_block_index: 0, cited_text: 'premier extrait' },
      { document_index: 0, start_block_index: 0, cited_text: 'second extrait' },
      { document_index: 0, start_block_index: 0 },
    ],
    PLAN,
  );
  assert.equal(references.length, 1);
  assert.equal(references[0].extrait, 'premier extrait');
});

test('un extrait trop long est coupé, sans couper un mot', () => {
  const long = 'mot '.repeat(200);
  const [reference] = rassemblerLesReferences(
    [{ document_index: 0, start_block_index: 0, cited_text: long }],
    PLAN,
  );
  assert.ok(reference.extrait.length < 420);
  assert.ok(reference.extrait.endsWith('…'));
  assert.ok(!reference.extrait.includes('  '));
});

test('le numéro affiché vient du fonds, pas d’une reformulation', () => {
  assert.equal(nommerArticle('L. 324-1-1'), 'Article L. 324-1-1');
  assert.equal(nommerArticle('Annexe I'), 'Annexe I');
  assert.equal(nommerArticle('Article 3'), 'Article 3');
});

/** Le plan doit suivre l'ordre exact des blocs envoyés, sinon tout glisse. */
test('le plan garde l’ordre des documents et des articles', () => {
  assert.deepEqual(
    PLAN.documents.map((document) => document.articles.map((article) => article.article)),
    [['Article 15', 'Article 22'], ['Article 1719']],
  );
});
