import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlanError, parseAssignments, parsePlanReading } from '../lib/plan.ts';
import type { PlanRoom } from '../lib/types.ts';

/**
 * Ces tests portent sur la *validation* du relevé, pas sur l'appel au modèle.
 * C'est volontaire : l'appel réseau n'est qu'un transport, alors que c'est ici
 * qu'on décide si une géométrie est publiable. Une lecture automatique se
 * trompe ; ce filtre est ce qui empêche l'erreur d'arriver au voyageur.
 */

/** Relevé plausible d'un T1 : une pièce de 5 × 4 et sa fenêtre. */
const reading = () => ({
  rooms: [
    {
      id: 'sejour',
      name: 'Séjour',
      height: 2.5,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
    },
  ],
  doors: [
    { from: 'sejour', to: '', kind: 'window', height: 2.2, sill: 0.9, a: { x: 1, y: 0 }, b: { x: 2.4, y: 0 } },
  ],
  note: '',
});

test('parsePlanReading accepte un relevé cohérent', () => {
  const parsed = parsePlanReading(reading(), 20);
  assert.equal(parsed.rooms.length, 1);
  assert.equal(parsed.rooms[0].id, 'sejour');
  assert.equal(parsed.doors.length, 1);
  assert.equal(parsed.doors[0].kind, 'window');
  assert.equal(parsed.area, 20);
});

test('parsePlanReading recale le relevé sur la surface annoncée', () => {
  // Le modèle a relevé 20 m², le propriétaire en annonce 45 : c'est lui qui a
  // le bon chiffre, il figure sur son bail.
  const parsed = parsePlanReading(reading(), 45);
  assert.ok(Math.abs(parsed.area - 45) < 1e-9);
  assert.ok(parsed.scaleFactor > 1);
  // Les ouvertures suivent, sinon elles ne seraient plus sur les murs.
  assert.ok(parsed.doors[0].b.x > 2.4);
});

test('parsePlanReading normalise les identifiants', () => {
  const raw = reading();
  raw.rooms[0].id = 'Salle d’Eau';
  raw.doors[0].from = 'Salle d’Eau';
  const parsed = parsePlanReading(raw, 20);
  assert.equal(parsed.rooms[0].id, 'salle-d-eau');
  assert.equal(parsed.doors[0].from, 'salle-d-eau');
});

test('parsePlanReading remplace une hauteur aberrante par le standard', () => {
  const raw = reading();
  raw.rooms[0].height = 47;
  assert.equal(parsePlanReading(raw, 20).rooms[0].height, 2.5);
});

test('parsePlanReading coupe les passages vers une pièce inexistante', () => {
  const raw = reading();
  raw.doors[0] = { ...raw.doors[0], to: 'grenier', kind: 'door', sill: 0 };
  // La destination inconnue devient « extérieur » : la géométrie reste juste,
  // le passage disparaît simplement de la navigation.
  assert.equal(parsePlanReading(raw, 20).doors[0].to, '');
});

test('parsePlanReading écarte une ouverture partie d’une pièce inconnue', () => {
  const raw = reading();
  raw.doors.push({ ...raw.doors[0], from: 'cave' });
  assert.equal(parsePlanReading(raw, 20).doors.length, 1);
});

test('parsePlanReading refuse ce qui n’est pas un relevé', () => {
  assert.throws(() => parsePlanReading(null, 20), PlanError);
  assert.throws(() => parsePlanReading({ rooms: [], doors: [], note: 'Ceci est une facture.' }, 20), PlanError);
  // Un contour à deux points ne délimite aucune pièce.
  assert.throws(
    () => parsePlanReading({ rooms: [{ id: 'a', name: 'A', height: 2.5, points: [{ x: 0, y: 0 }] }], doors: [] }, 20),
    PlanError,
  );
});

test('parsePlanReading survit à des champs manquants ou mal typés', () => {
  const parsed = parsePlanReading(
    {
      rooms: [{ id: 'sejour', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }] }],
      doors: [{ from: 'sejour', a: { x: 1, y: 0 }, b: { x: 2, y: 0 } }],
    },
    0,
  );
  assert.equal(parsed.rooms[0].name, 'sejour');
  assert.equal(parsed.rooms[0].height, 2.5);
  // Type d'ouverture absent : une porte, c'est le cas le plus fréquent.
  assert.equal(parsed.doors[0].kind, 'door');
  assert.equal(parsed.doors[0].sill, 0);
  // Surface non renseignée : on ne recale pas.
  assert.equal(parsed.scaleFactor, 1);
});

/* ---------------------------------------------- rattachement des photos */

const rooms: PlanRoom[] = [
  {
    id: 'sejour',
    name: 'Séjour',
    height: 2.5,
    points: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ],
  },
];

test('parseAssignments ne garde que les photos et les pièces connues', () => {
  const result = parseAssignments(
    {
      assignments: [
        { photoId: 'p1', roomId: 'sejour', wallIndex: 2 },
        { photoId: 'inconnue', roomId: 'sejour', wallIndex: 0 },
        { photoId: 'p2', roomId: 'grenier', wallIndex: 0 },
      ],
    },
    rooms,
    ['p1', 'p2'],
  );
  assert.deepEqual(result, [{ photoId: 'p1', roomId: 'sejour', wallIndex: 2 }]);
});

test('parseAssignments ramène un mur hors bornes dans le contour', () => {
  const result = parseAssignments({ assignments: [{ photoId: 'p1', roomId: 'sejour', wallIndex: 9 }] }, rooms, ['p1']);
  assert.equal(result[0].wallIndex, 1);
});

test('parseAssignments ignore les doublons et les entrées vides', () => {
  const result = parseAssignments(
    {
      assignments: [
        { photoId: 'p1', roomId: 'sejour', wallIndex: 0 },
        { photoId: 'p1', roomId: 'sejour', wallIndex: 3 },
        { photoId: 'p2', roomId: '', wallIndex: 0 },
      ],
    },
    rooms,
    ['p1', 'p2'],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].wallIndex, 0);
});

test('parseAssignments tolère une réponse vide', () => {
  assert.deepEqual(parseAssignments({}, rooms, ['p1']), []);
  assert.deepEqual(parseAssignments({ assignments: 'oui' }, rooms, ['p1']), []);
});
