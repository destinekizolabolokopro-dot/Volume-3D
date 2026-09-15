import assert from 'node:assert/strict';
import { test } from 'node:test';
import { echapper, nomDeFichier, versRtf } from '../lib/rtf.ts';

/**
 * Un courrier qui s'ouvre vide dans Word ne se remarque pas ici : il se
 * remarque chez la personne qui devait l'envoyer le jour même. Ces tests
 * portent donc sur l'échappement, c'est-à-dire sur ce qui casse le fichier.
 */

test('les trois caractères qui pilotent le format sont neutralisés', () => {
  assert.equal(echapper('a\\b'), 'a\\\\b');
  assert.equal(echapper('SCI {Dupont}'), 'SCI \\{Dupont\\}');
});

/** Sans cela, le courrier part avec des « Ã© » dedans. */
test('les accents deviennent des échappements, pas des octets', () => {
  assert.equal(echapper('é'), '\\u233?');
  assert.equal(echapper('À'), '\\u192?');
  assert.equal(echapper('œ'), '\\u339?');
  assert.ok(!echapper('congé').includes('é'));
});

test('l’ASCII passe tel quel', () => {
  assert.equal(echapper('Monsieur Dupont, 12 rue des Lilas.'), 'Monsieur Dupont, 12 rue des Lilas.');
});

test('un saut de ligne devient un saut de paragraphe', () => {
  assert.ok(echapper('a\nb').includes('\\par'));
});

/** Au-delà de 32767 le point de code doit devenir négatif. */
test('les caractères hauts respectent l’entier signé de seize bits', () => {
  const resultat = echapper('\u{1F600}');
  assert.match(resultat, /\\u-?\d+\?\\u-?\d+\?/);
  assert.ok(!resultat.includes('\u{1F600}'));
});

test('le document produit est un RTF complet et équilibré', () => {
  const rtf = versRtf({
    titre: 'Congé pour vendre',
    blocs: [
      { type: 'titre', contenu: 'CONGÉ POUR VENDRE' },
      { type: 'objet', contenu: 'Objet : congé' },
      { type: 'texte', contenu: 'Madame, Monsieur,' },
      { type: 'signature', contenu: 'Signature' },
    ],
  });
  assert.ok(rtf.startsWith('{\\rtf1'));
  assert.ok(rtf.endsWith('}'));
  assert.equal((rtf.match(/{/g) ?? []).length, (rtf.match(/}/g) ?? []).length);
  assert.ok(rtf.includes('\\qc'), 'le titre est centré');
  assert.ok(rtf.includes('\\qr'), 'la signature est à droite');
  assert.ok(rtf.includes('\\qj'), 'le corps est justifié');
});

test('le nom de fichier survit aux accents et à la ponctuation', () => {
  assert.equal(nomDeFichier('Congé pour vendre — bail d’habitation'), 'conge-pour-vendre-bail-d-habitation.rtf');
  assert.equal(nomDeFichier('///'), 'document.rtf');
  assert.ok(!nomDeFichier('a'.repeat(200)).includes('/'));
  assert.ok(nomDeFichier('a'.repeat(200)).length <= 64);
});
