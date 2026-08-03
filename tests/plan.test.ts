import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PlanError,
  canStandAt,
  distanceToSegment,
  reachableToward,
  slideMove,
  assertPlanIsUsable,
  containsPoint,
  exitsFrom,
  mergeIntervals,
  pointAt,
  projectOnWall,
  rescaleToArea,
  roomArea,
  roomCenter,
  roomWalls,
  solidSpans,
  totalArea,
} from '../lib/plan.ts';
import type { PlanDoor, PlanRoom } from '../lib/types.ts';

/** Pièce rectangulaire de 4 × 3 m, coin supérieur gauche à l'origine. */
const rectangle = (id: string, x = 0, y = 0, w = 4, h = 3): PlanRoom => ({
  id,
  name: id,
  height: 2.5,
  points: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});

const door = (over: Partial<PlanDoor> = {}): PlanDoor => ({
  id: 'd1',
  planId: 'p1',
  from: 'salon',
  to: 'chambre',
  a: { x: 4, y: 1 },
  b: { x: 4, y: 1.9 },
  kind: 'door',
  height: 2.05,
  sill: 0,
  ...over,
});

test('roomArea applique la formule du lacet quel que soit le sens du polygone', () => {
  const direct = rectangle('salon');
  const reversed: PlanRoom = { ...direct, points: [...direct.points].reverse() };
  assert.equal(roomArea(direct), 12);
  assert.equal(roomArea(reversed), 12);
});

test('roomArea traite une pièce en L', () => {
  // Un carré de 4 × 4 amputé d'un carré de 2 × 2 : 16 − 4 = 12.
  const shape: PlanRoom = {
    id: 'sejour',
    name: 'Séjour',
    height: 2.5,
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ],
  };
  assert.equal(roomArea(shape), 12);
});

test('roomCenter tombe dans la pièce, y compris sur une forme en L', () => {
  const rect = rectangle('salon');
  assert.deepEqual(roomCenter(rect), { x: 2, y: 1.5 });

  // Sur ce L, le centroïde de surface tombe hors du polygone : on veut malgré
  // tout un point d'observation utilisable.
  const shape: PlanRoom = {
    id: 'l',
    name: 'L',
    height: 2.5,
    points: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 6 },
      { x: 0, y: 6 },
    ],
  };
  assert.ok(containsPoint(shape, roomCenter(shape)));
});

test('containsPoint distingue l’intérieur de l’extérieur', () => {
  const rect = rectangle('salon');
  assert.ok(containsPoint(rect, { x: 1, y: 1 }));
  assert.ok(!containsPoint(rect, { x: 5, y: 1 }));
  assert.ok(!containsPoint(rect, { x: 1, y: 4 }));
});

test('roomWalls rend un mur par côté, refermé sur le premier point', () => {
  const walls = roomWalls(rectangle('salon'));
  assert.equal(walls.length, 4);
  assert.deepEqual(walls[3], { a: { x: 0, y: 3 }, b: { x: 0, y: 0 } });
});

test('projectOnWall rattache une ouverture au mur qui la porte', () => {
  const walls = roomWalls(rectangle('salon'));
  // Mur droit : de (4,0) à (4,3). La porte occupe y ∈ [1 ; 1,9].
  const span = projectOnWall(walls[1], { a: { x: 4, y: 1 }, b: { x: 4, y: 1.9 } });
  assert.ok(span);
  assert.ok(Math.abs(span.from - 1 / 3) < 1e-9);
  assert.ok(Math.abs(span.to - 1.9 / 3) < 1e-9);
});

test('projectOnWall ignore une ouverture posée sur un autre mur', () => {
  const walls = roomWalls(rectangle('salon'));
  // La même porte, confrontée au mur du haut : elle en est trop éloignée.
  assert.equal(projectOnWall(walls[0], { a: { x: 4, y: 1 }, b: { x: 4, y: 1.9 } }), null);
});

test('projectOnWall tolère un léger décalage mais pas un mur voisin', () => {
  const wall = { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } };
  assert.ok(projectOnWall(wall, { a: { x: 1, y: 0.1 }, b: { x: 2, y: 0.1 } }));
  assert.equal(projectOnWall(wall, { a: { x: 1, y: 0.6 }, b: { x: 2, y: 0.6 } }), null);
});

test('mergeIntervals fusionne les recouvrements', () => {
  assert.deepEqual(
    mergeIntervals([
      { from: 0.6, to: 0.8 },
      { from: 0.1, to: 0.3 },
      { from: 0.25, to: 0.5 },
    ]),
    [
      { from: 0.1, to: 0.5 },
      { from: 0.6, to: 0.8 },
    ],
  );
});

test('solidSpans rend le complément des ouvertures', () => {
  assert.deepEqual(solidSpans([{ from: 0.25, to: 0.5 }]), [
    { from: 0, to: 0.25 },
    { from: 0.5, to: 1 },
  ]);
  // Un mur entièrement ouvert ne laisse aucun plein.
  assert.deepEqual(solidSpans([{ from: 0, to: 1 }]), []);
  // Un mur sans ouverture reste plein sur toute sa longueur.
  assert.deepEqual(solidSpans([]), [{ from: 0, to: 1 }]);
});

test('pointAt interpole le long du mur', () => {
  assert.deepEqual(pointAt({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }, 0.25), { x: 1, y: 0 });
});

test('exitsFrom rend les passages dans les deux sens, sans les fenêtres', () => {
  const doors: PlanDoor[] = [
    door(),
    door({ id: 'd2', from: 'chambre', to: 'couloir' }),
    door({ id: 'd3', from: 'salon', to: '', kind: 'window' }),
    door({ id: 'd4', from: 'salon', to: '', kind: 'door' }),
  ];
  assert.deepEqual(
    exitsFrom('salon', doors).map((exit) => exit.targetId),
    ['chambre'],
  );
  assert.deepEqual(
    exitsFrom('chambre', doors).map((exit) => exit.targetId),
    ['salon', 'couloir'],
  );
});

test('assertPlanIsUsable accepte un plan cohérent', () => {
  assert.doesNotThrow(() => assertPlanIsUsable([rectangle('salon'), rectangle('chambre', 4)], [door()]));
});

test('assertPlanIsUsable refuse les lectures aberrantes', () => {
  assert.throws(() => assertPlanIsUsable([], []), PlanError);
  assert.throws(() => assertPlanIsUsable([rectangle('salon'), rectangle('salon', 4)], []), PlanError);
  assert.throws(() => assertPlanIsUsable([rectangle('minus', 0, 0, 0.5, 0.5)], []), PlanError);
  assert.throws(() => assertPlanIsUsable([{ ...rectangle('salon'), height: 12 }], []), PlanError);
  // Une ouverture vers une pièce absente rendrait la visite impossible à parcourir.
  assert.throws(() => assertPlanIsUsable([rectangle('salon')], [door({ to: 'grenier' })]), PlanError);
  // Une « porte » de six mètres est une erreur de lecture, pas une baie.
  assert.throws(
    () => assertPlanIsUsable([rectangle('salon'), rectangle('chambre', 4)], [door({ b: { x: 4, y: 9 } })]),
    PlanError,
  );
});

test('rescaleToArea ramène le plan à la surface annoncée', () => {
  const rooms = [rectangle('salon'), rectangle('chambre', 4)];
  assert.equal(totalArea(rooms), 24);

  const scaled = rescaleToArea(rooms, [door()], 48);
  assert.ok(Math.abs(totalArea(scaled.rooms) - 48) < 1e-9);
  assert.ok(Math.abs(scaled.factor - Math.SQRT2) < 1e-9);
  // Les ouvertures suivent le même facteur, sinon les portes ne seraient plus
  // en face des murs.
  assert.ok(Math.abs(scaled.doors[0].a.x - 4 * Math.SQRT2) < 1e-9);
});

test('rescaleToArea ne touche à rien sous 2 % d’écart', () => {
  const rooms = [rectangle('salon')];
  const scaled = rescaleToArea(rooms, [], 12.1);
  assert.equal(scaled.factor, 1);
  assert.equal(scaled.rooms, rooms);
});

test('rescaleToArea ignore une surface non renseignée', () => {
  const rooms = [rectangle('salon')];
  assert.equal(rescaleToArea(rooms, [], 0).factor, 1);
});

/* ------------------------------------------------------------ déplacement */

test('distanceToSegment mesure la distance au segment, pas à la droite', () => {
  const wall = { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } };
  assert.equal(distanceToSegment({ x: 2, y: 3 }, wall), 3);
  // Au-delà de l'extrémité, c'est la distance au bout du segment qui compte.
  assert.equal(distanceToSegment({ x: 8, y: 0 }, wall), 4);
  assert.equal(distanceToSegment({ x: -3, y: 4 }, wall), 5);
});

test('canStandAt refuse le centre du mur et accepte le centre de la pièce', () => {
  const room = rectangle('salon');
  assert.ok(canStandAt(room, { x: 2, y: 1.5 }));
  // À dix centimètres du mur, on aurait le nez dedans.
  assert.ok(!canStandAt(room, { x: 0.1, y: 1.5 }));
  assert.ok(!canStandAt(room, { x: 9, y: 9 }));
});

test('slideMove laisse glisser le long du mur au lieu de bloquer net', () => {
  const room = rectangle('salon');
  const from = { x: 2, y: 1.5 };
  // Pas entièrement libre : accepté tel quel.
  assert.deepEqual(slideMove(room, from, { x: 2.5, y: 1.5 }), { x: 2.5, y: 1.5 });
  // Vers le mur de gauche en diagonale : le déplacement latéral passe, pas
  // la composante qui traverse la cloison.
  const slid = slideMove(room, from, { x: -1, y: 2 });
  assert.equal(slid.x, 2);
  assert.equal(slid.y, 2);
  // Droit dans le mur : on ne bouge pas.
  assert.deepEqual(slideMove(room, { x: 0.5, y: 1.5 }, { x: -2, y: 1.5 }), { x: 0.5, y: 1.5 });
});

test('reachableToward avance jusqu’au mur quand la cible est au-delà', () => {
  const room = rectangle('salon'); // 4 × 3
  const from = { x: 2, y: 1.5 };

  // Cible hors de la pièce, droit devant : on s'arrête à la marge du mur.
  const stopped = reachableToward(room, from, { x: 2, y: 9 });
  assert.ok(stopped);
  assert.ok(Math.abs(stopped.x - 2) < 1e-9);
  assert.ok(Math.abs(stopped.y - (3 - 0.35)) < 0.02);

  // Cible atteignable : rendue telle quelle.
  assert.deepEqual(reachableToward(room, from, { x: 2.5, y: 1.5 }), { x: 2.5, y: 1.5 });
});

test('reachableToward ne rend rien quand il n’y a pas un centimètre à gagner', () => {
  const room = rectangle('salon');
  // Déjà collé à la marge du mur du haut, cible encore plus haut.
  assert.equal(reachableToward(room, { x: 2, y: 0.35 }, { x: 2, y: -5 }), null);
  // Départ hors de la pièce : rien à faire.
  assert.equal(reachableToward(room, { x: 9, y: 9 }, { x: 2, y: 1.5 }), null);
});
