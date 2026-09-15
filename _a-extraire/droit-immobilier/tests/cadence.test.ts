import assert from 'node:assert/strict';
import test from 'node:test';
import { cadence, origine } from '../lib/cadence.ts';

function requete(entetes: Record<string, string>): Request {
  return new Request('https://exemple.fr/api', { headers: entetes });
}

test('l’en-tête posé par l’hébergeur l’emporte sur celui du navigateur', () => {
  const clef = origine(
    requete({
      'x-forwarded-for': '1.1.1.1',
      'x-vercel-forwarded-for': '203.0.113.7',
    }),
  );
  assert.equal(clef, '203.0.113.7');
});

test('sans en-tête de confiance, c’est le DERNIER relais qui fait la clé', () => {
  /* Le premier élément est écrit par l'appelant : le prendre revenait à lui
     laisser choisir son propre quota. Le dernier est ajouté par le relais le
     plus proche, celui qu'on ne peut pas contrefaire depuis un navigateur. */
  const clef = origine(requete({ 'x-forwarded-for': 'inventé, 198.51.100.4' }));
  assert.equal(clef, '198.51.100.4');
});

test('une adresse forgée ne dilue pas le frein', () => {
  const frein = cadence(2, 60_000);
  const entetes = (forge: string) => requete({ 'x-forwarded-for': `${forge}, 198.51.100.4` });

  assert.equal(frein.depasse(origine(entetes('1.2.3.4'))), false);
  assert.equal(frein.depasse(origine(entetes('5.6.7.8'))), false);
  /* Trois requêtes, trois adresses annoncées différentes, un seul appelant :
     la troisième doit être freinée. */
  assert.equal(frein.depasse(origine(entetes('9.10.11.12'))), true);
});

test('sans aucun en-tête, tout le monde partage la même clé', () => {
  assert.equal(origine(requete({})), 'inconnu');
  assert.equal(origine(requete({ 'x-forwarded-for': '   ' })), 'inconnu');
});

test('le frein laisse passer jusqu’à la limite, puis freine', () => {
  const frein = cadence(3, 1000);
  assert.equal(frein.depasse('a', 0), false);
  assert.equal(frein.depasse('a', 10), false);
  assert.equal(frein.depasse('a', 20), false);
  assert.equal(frein.depasse('a', 30), true);
  /* La fenêtre glisse : passé mille millisecondes, les anciens passages ne
     comptent plus. */
  assert.equal(frein.depasse('a', 1500), false);
});

test('deux clés ne se gênent pas', () => {
  const frein = cadence(1, 1000);
  assert.equal(frein.depasse('a', 0), false);
  assert.equal(frein.depasse('b', 0), false);
  assert.equal(frein.depasse('a', 1), true);
});
