import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugify, uniqueSlug, randomId } from '../lib/ids.ts';
import { ValidationError, email, httpUrl, number, oneOf, text } from '../lib/validation.ts';
import { resolveLocalFile } from '../lib/paths.ts';

test('slugify nettoie accents, ponctuation et espaces', () => {
  assert.equal(slugify('Appartement lumineux — Le Marais'), 'appartement-lumineux-le-marais');
  assert.equal(slugify('  Studio  Cosy !!  '), 'studio-cosy');
  assert.equal(slugify('Été à Nîmes'), 'ete-a-nimes');
  assert.equal(slugify('///'), 'logement');
});

test('uniqueSlug ne réutilise jamais un slug existant', () => {
  const taken = ['le-marais'];
  const first = uniqueSlug('Le Marais', taken);
  assert.notEqual(first, 'le-marais');
  assert.ok(first.startsWith('le-marais-'));
  assert.equal(uniqueSlug('Le Marais', []), 'le-marais');
});

test('randomId produit des identifiants distincts de la bonne longueur', () => {
  const ids = new Set(Array.from({ length: 200 }, () => randomId(12)));
  assert.equal(ids.size, 200);
  assert.equal(randomId(22).length, 22);
});

test('text applique obligation et longueur maximale', () => {
  assert.equal(text('  Salon  ', 'pièce'), 'Salon');
  assert.equal(text('', 'note', { required: false }), '');
  assert.throws(() => text('', 'nom'), ValidationError);
  assert.throws(() => text('x'.repeat(50), 'nom', { max: 10 }), ValidationError);
});

test('email accepte les adresses courantes et rejette les formes cassées', () => {
  assert.equal(email('Contact@Volume3D.fr'), 'Contact@Volume3D.fr');
  assert.throws(() => email('pas-une-adresse'), ValidationError);
  assert.throws(() => email('a@b'), ValidationError);
});

test('httpUrl rejette les schémas dangereux', () => {
  assert.equal(httpUrl('https://my.matterport.com/show/?m=abc', 'lien'), 'https://my.matterport.com/show/?m=abc');
  assert.throws(() => httpUrl('javascript:alert(1)', 'lien'), ValidationError);
  assert.throws(() => httpUrl('data:text/html,<script>', 'lien'), ValidationError);
  assert.equal(httpUrl('', 'lien', { required: false }), '');
});

test('number borne les valeurs hors limites', () => {
  assert.equal(number('42', 'yaw', { min: -180, max: 180 }), 42);
  assert.equal(number(500, 'yaw', { min: -180, max: 180 }), 180);
  assert.throws(() => number('abc', 'yaw'), ValidationError);
});

test('oneOf n’accepte que les valeurs prévues', () => {
  assert.equal(oneOf('pano', ['pano', 'model', 'embed'], 'mode'), 'pano');
  assert.throws(() => oneOf('autre', ['pano', 'model', 'embed'], 'mode'), ValidationError);
});

test('resolveLocalFile bloque la traversée de répertoire', () => {
  assert.ok(resolveLocalFile(['panos', 'abc.jpg'])?.endsWith('/.data/uploads/panos/abc.jpg'));
  assert.equal(resolveLocalFile(['..', '..', 'etc', 'passwd']), null);
  assert.equal(resolveLocalFile(['panos', '..', '..', '..', '.env.local']), null);
});
