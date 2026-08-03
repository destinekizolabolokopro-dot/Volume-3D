import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewIntake, summarizeIntake } from '../lib/intake.ts';
import type { FloorPlan, Photo, PlanDoor, PlanRoom } from '../lib/types.ts';

const room = (id: string, name: string, w = 4, h = 3): PlanRoom => ({
  id,
  name,
  height: 2.5,
  points: [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ],
});

const plan = (rooms: PlanRoom[], confirmed = true): FloorPlan => ({
  id: 'plan1',
  propertyId: 'bien1',
  imageUrl: '/plan.jpg',
  rooms,
  declaredArea: 42,
  readBy: 'test',
  readAt: '2026-01-01T00:00:00.000Z',
  confirmed,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const photo = (id: string, roomId = ''): Photo => ({
  id,
  propertyId: 'bien1',
  url: `/photos/${id}.jpg`,
  caption: '',
  position: 0,
  roomId,
  wallIndex: 0,
});

const passage = (from: string, to: string): PlanDoor => ({
  id: `${from}-${to}`,
  planId: 'plan1',
  from,
  to,
  a: { x: 4, y: 1 },
  b: { x: 4, y: 1.9 },
  kind: 'door',
  height: 2.05,
  sill: 0,
});

const codes = (report: ReturnType<typeof reviewIntake>) => report.gaps.map((gap) => gap.code);

test('sans plan, on demande le plan et rien d’autre', () => {
  const report = reviewIntake(null, [], [photo('p1')]);
  assert.equal(report.ready, false);
  assert.deepEqual(codes(report), ['plan-manquant']);
});

test('un dossier complet est prêt', () => {
  const report = reviewIntake(
    plan([room('sejour', 'Séjour'), room('chambre', 'Chambre')]),
    [passage('sejour', 'chambre')],
    [photo('p1', 'sejour'), photo('p2', 'chambre')],
  );
  assert.equal(report.ready, true);
  assert.deepEqual(report.gaps, []);
  assert.equal(report.coverage, 1);
  assert.equal(summarizeIntake(report), 'Le dossier est complet.');
});

test('chaque pièce sans photo produit un message nommé', () => {
  const report = reviewIntake(
    plan([room('sejour', 'Séjour'), room('chambre', 'Chambre'), room('salle-eau', 'Salle d’eau')]),
    [passage('sejour', 'chambre'), passage('sejour', 'salle-eau')],
    [photo('p1', 'sejour')],
  );
  assert.equal(report.ready, false);
  assert.equal(report.roomsWithoutPhoto.length, 2);
  const messages = report.gaps.map((gap) => gap.message);
  assert.ok(messages.some((text) => text.includes('la chambre')));
  assert.ok(messages.some((text) => text.includes('la salle d’eau')));
  assert.ok(Math.abs(report.coverage - 1 / 3) < 1e-9);
});

test('l’article suit le genre du nom de pièce', () => {
  const report = reviewIntake(plan([room('bureau', 'Bureau')]), [], []);
  // Aucune photo du tout : c'est le message global qui prend le relais.
  assert.ok(codes(report).includes('photos-manquantes'));

  const partial = reviewIntake(
    plan([room('sejour', 'Séjour'), room('bureau', 'Bureau')]),
    [passage('sejour', 'bureau')],
    [photo('p1', 'sejour')],
  );
  assert.ok(partial.gaps.some((gap) => gap.message.includes('le bureau')));
});

test('les placards et les pièces minuscules ne réclament pas de photo', () => {
  const report = reviewIntake(
    plan([room('sejour', 'Séjour'), room('placard', 'Placard'), room('gaine', 'Local technique', 1, 1)]),
    [passage('sejour', 'placard')],
    [photo('p1', 'sejour')],
  );
  assert.equal(report.ready, true);
  assert.equal(report.roomsWithoutPhoto.length, 0);
});

test('une photo non rattachée est signalée sans bloquer', () => {
  const report = reviewIntake(
    plan([room('sejour', 'Séjour')]),
    [],
    [photo('p1', 'sejour'), photo('p2'), photo('p3')],
  );
  assert.equal(report.ready, true);
  const orphan = report.gaps.find((gap) => gap.code === 'photos-non-rattachees');
  assert.ok(orphan);
  assert.equal(orphan.severity, 'advice');
  assert.ok(orphan.message.startsWith('2 photos'));
});

test('un logement à plusieurs pièces sans passage est bloqué', () => {
  const report = reviewIntake(
    plan([room('sejour', 'Séjour'), room('chambre', 'Chambre')]),
    [],
    [photo('p1', 'sejour'), photo('p2', 'chambre')],
  );
  assert.ok(codes(report).includes('aucun-passage'));
  assert.equal(report.ready, false);
});

test('un plan non confirmé bloque la publication', () => {
  const report = reviewIntake(
    plan([room('sejour', 'Séjour')], false),
    [],
    [photo('p1', 'sejour')],
  );
  assert.deepEqual(codes(report), ['plan-non-confirme']);
  assert.equal(report.ready, false);
  assert.equal(summarizeIntake(report), 'Relisez les dimensions relevées, puis confirmez le plan.');
});

test('summarizeIntake compte les points bloquants quand il y en a plusieurs', () => {
  const report = reviewIntake(
    plan([room('sejour', 'Séjour'), room('chambre', 'Chambre')], false),
    [passage('sejour', 'chambre')],
    [photo('p1', 'sejour')],
  );
  assert.equal(summarizeIntake(report), '2 points à compléter avant publication.');
});
