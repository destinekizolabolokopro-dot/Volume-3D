import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acoustiqueDe, createAmbience } from '../lib/ambience.ts';

/*
 * Le son de la visite, contrôlé là où il est contrôlable.
 *
 * On ne vérifie pas ici qu'un pas ressemble à un pas — aucun test ne le fera,
 * et c'est l'oreille qui tranche. On vérifie les deux choses qui, elles, se
 * cassent en silence : que le module ne fabrique rien avant qu'on le lui
 * demande, et qu'il n'explose pas là où il n'y a pas de son du tout.
 */

test('rien ne sonne, et rien ne casse, tant qu’on n’a rien demandé', () => {
  const ambience = createAmbience();
  /* Ces trois appels sont ceux que la boucle de rendu fait soixante fois par
     seconde, dès la première image et donc bien avant tout clic. S'ils
     supposaient un `AudioContext`, la visite entière tomberait — c'est le
     genre de dépendance qui ne se voit qu'en production. */
  ambience.moved(1.4, 'sejour');
  ambience.door(0.4);
  ambience.disable();
  ambience.dispose();
});

/**
 * Le rendu côté serveur.
 *
 * `EntranceTour` est un composant client, mais Next le rend d'abord sur le
 * serveur — où `window` n'existe pas. Un module audio qui va chercher
 * `window.AudioContext` au chargement casse la page entière, et il la casse au
 * premier rendu, c'est-à-dire avant que quoi que ce soit ne s'affiche.
 *
 * Ce test tourne dans Node, donc sans `window` : il *est* la situation qu'on
 * veut vérifier.
 */
test('activer le son sans navigateur ne lève rien', async () => {
  const ambience = createAmbience();
  await ambience.enable();
  ambience.moved(2, 'salle-de-bain');
  ambience.dispose();
});

test('une pièce carrelée renvoie plus qu’une chambre', () => {
  const bain = acoustiqueDe('salle-de-bain');
  const chambre = acoustiqueDe('chambre-1');
  const sejour = acoustiqueDe('sejour');

  assert.ok(bain.echo > sejour.echo, 'une salle de bain renvoie plus qu’un séjour');
  assert.ok(sejour.echo > chambre.echo, 'une chambre absorbe plus qu’un séjour');
  // Un sol dur est brillant : c'est la même cause physique que la réverbération.
  assert.ok(bain.brillance > chambre.brillance);

  /* Les identifiants de l'appartement passent par le même test que ceux de la
     maison, et c'est le point : l'acoustique se déduit du nom de la pièce,
     elle n'est déclarée nulle part. Deux endroits qui décriraient la même
     pièce finiraient par diverger. */
  assert.equal(acoustiqueDe('salle-eau').echo, bain.echo);
  assert.equal(acoustiqueDe('chambre').echo, chambre.echo);
  assert.equal(acoustiqueDe('degagement').echo, sejour.echo);
});
