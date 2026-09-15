import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decouper, separer } from '../lib/mise-en-forme.ts';

/**
 * Ce qui est testé ici, ce n'est pas un rendu : c'est la promesse que rien
 * n'est perdu entre le texte du spécialiste et ce que la personne lit. Un
 * délai avalé par un découpage raté est un délai qui n'a pas été dit.
 */

test('les intertitres deviennent des titres, sans leurs deux points', () => {
  const blocs = decouper('Le délai :\nDouze mois à compter de la notification.');
  assert.deepEqual(blocs, [
    { type: 'titre', texte: 'Le délai' },
    { type: 'paragraphe', texte: 'Douze mois à compter de la notification.' },
  ]);
});

test('une phrase longue terminée par deux points reste un paragraphe', () => {
  const longue =
    'Trois éléments doivent être réunis pour que le licenciement soit régulier, et les voici :';
  const blocs = decouper(longue);
  assert.deepEqual(blocs, [{ type: 'paragraphe', texte: longue }]);
});

test('les tirets forment une énumération, quel que soit le tiret employé', () => {
  const blocs = decouper('— premier point\n- deuxième point\n• troisième point');
  assert.deepEqual(blocs, [
    { type: 'liste', points: ['premier point', 'deuxième point', 'troisième point'] },
  ]);
});

test('un paragraphe reprend après une énumération sans ligne vide', () => {
  const blocs = decouper('Voici les cas :\n— le premier\n— le second\nDans tous les cas, agissez vite.');
  assert.deepEqual(blocs, [
    { type: 'titre', texte: 'Voici les cas' },
    { type: 'liste', points: ['le premier', 'le second'] },
    { type: 'paragraphe', texte: 'Dans tous les cas, agissez vite.' },
  ]);
});

test('les lignes d’un même paragraphe sont recollées en une seule phrase', () => {
  const blocs = decouper('Une phrase coupée\nsur deux lignes.');
  assert.deepEqual(blocs, [{ type: 'paragraphe', texte: 'Une phrase coupée sur deux lignes.' }]);
});

test('aucun bloc vide n’est produit, même sur un texte creux', () => {
  assert.deepEqual(decouper(''), []);
  assert.deepEqual(decouper('\n\n   \n'), []);
  assert.deepEqual(decouper('—\n— \n'), []);
});

test('rien n’est interprété comme du balisage', () => {
  const blocs = decouper('Écrivez <b>ceci</b> et **cela** dans votre courrier.');
  assert.deepEqual(blocs, [
    { type: 'paragraphe', texte: 'Écrivez <b>ceci</b> et **cela** dans votre courrier.' },
  ]);
});

/*
 * La séparation en deux niveaux : ce que tout le monde lit, et ce qui est
 * replié derrière « Voir le détail juridique ».
 *
 * Ce qui est vérifié ici tient en une phrase : rien ne se perd à la coupure, et
 * une réponse sans marqueur reste entièrement visible. Un détail juridique
 * avalé par une séparation ratée serait une réponse amputée sans que personne
 * ne le voie.
 */

test('la réponse se coupe au détail juridique, titre compris', () => {
  const { clair, detail } = separer(
    [
      'En clair :',
      'Vous pouvez garder de quoi couvrir ce qu’il vous doit.',
      '',
      'Le détail juridique :',
      'L’article 22 de la loi de 1989 encadre la restitution.',
    ].join('\n'),
  );

  assert.deepEqual(clair, [
    { type: 'titre', texte: 'En clair' },
    { type: 'paragraphe', texte: 'Vous pouvez garder de quoi couvrir ce qu’il vous doit.' },
  ]);
  /* Le titre part avec le détail : il annonce ce qu'on ouvre. */
  assert.equal(detail[0].type, 'titre');
  assert.deepEqual(detail[0], { type: 'titre', texte: 'Le détail juridique' });
  assert.equal(detail.length, 2);
});

test('sans marqueur, tout reste visible', () => {
  const { clair, detail } = separer('Le délai :\nUn mois à compter de la remise des clés.');
  assert.equal(detail.length, 0);
  assert.equal(clair.length, 2);
});

test('le marqueur est reconnu sans accent et sans casse', () => {
  for (const variante of ['Le détail juridique', 'LE DETAIL JURIDIQUE', 'le detail juridique']) {
    const { detail } = separer(`En clair :\nOui.\n\n${variante} :\nL’article 15.`);
    assert.equal(detail.length, 2, variante);
  }
});

test('rien ne se perd à la coupure', () => {
  const texte = [
    'En clair :',
    'Non, pas sans passer par le juge.',
    '',
    'Ce que je ferais :',
    '— Envoyer une lettre recommandée.',
    '— Compter les jours.',
    '',
    'Le détail juridique :',
    'L’expulsion sans titre est un délit.',
    '— Trois ans d’emprisonnement.',
  ].join('\n');

  const { clair, detail } = separer(texte);
  assert.deepEqual([...clair, ...detail], decouper(texte));
});
