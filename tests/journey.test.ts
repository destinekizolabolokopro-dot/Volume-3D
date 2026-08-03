import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewJourney, type JourneyInput } from '../lib/journey.ts';
import type { FloorPlan, PropertyFact } from '../lib/types.ts';

const emptyIntake = { ready: false, gaps: [], roomsWithoutPhoto: [], orphanPhotos: [], coverage: 0 };

const plan = (confirmed = true): FloorPlan => ({
  id: 'plan1',
  propertyId: 'bien1',
  imageUrl: '/plan.jpg',
  rooms: [],
  declaredArea: 42,
  readBy: 'test',
  readAt: '2026-01-01T00:00:00.000Z',
  confirmed,
  createdAt: '2026-01-01T00:00:00.000Z',
});

/** Toutes les réponses obligatoires, confirmées par le propriétaire. */
const fullFacts: PropertyFact[] = [
  { key: 'meuble', value: 'Entièrement meublé', source: 'proprietaire' },
  { key: 'couchages', value: '4', source: 'proprietaire' },
  { key: 'adresse', value: 'Le Marais, Paris', source: 'proprietaire' },
  { key: 'proximite', value: 'Métro Saint-Paul', source: 'proprietaire' },
];

const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  property: { name: 'Studio', city: 'Paris', status: 'draft', videoUrl: '', modelUrl: '', embedUrl: '' },
  sceneCount: 0,
  photoCount: 0,
  plan: null,
  intake: emptyIntake,
  facts: [],
  ...over,
});

const keys = (j: ReturnType<typeof reviewJourney>) => j.steps.map((s) => s.key);
const state = (j: ReturnType<typeof reviewJourney>, key: string) => j.steps.find((s) => s.key === key)?.state;

test('sans plan, l’étape de vérification n’existe pas', () => {
  const journey = reviewJourney(input());
  assert.deepEqual(keys(journey), ['logement', 'visite', 'photos', 'fiche', 'publication']);
});

test('avec un plan, la vérification s’intercale avant la fiche', () => {
  const journey = reviewJourney(input({ plan: plan(false) }));
  assert.deepEqual(keys(journey), ['logement', 'visite', 'photos', 'verification', 'fiche', 'publication']);
});

test('une seule étape est en cours : la première non franchie', () => {
  const journey = reviewJourney(input({ sceneCount: 2 }));
  assert.equal(state(journey, 'logement'), 'done');
  assert.equal(state(journey, 'visite'), 'done');
  assert.equal(state(journey, 'photos'), 'current');
  assert.equal(state(journey, 'fiche'), 'todo');
  assert.equal(journey.current?.key, 'photos');
  assert.equal(journey.steps.filter((s) => s.state === 'current').length, 1);
});

test('chacun des formats suffit à franchir l’étape « visite »', () => {
  for (const over of [
    { sceneCount: 1 },
    { property: { name: 'S', city: 'P', status: 'draft' as const, videoUrl: '/v.mp4', modelUrl: '', embedUrl: '' } },
    { property: { name: 'S', city: 'P', status: 'draft' as const, videoUrl: '', modelUrl: '/m.glb', embedUrl: '' } },
    { property: { name: 'S', city: 'P', status: 'draft' as const, videoUrl: '', modelUrl: '', embedUrl: 'https://x' } },
    { plan: plan(true) },
  ]) {
    assert.equal(state(reviewJourney(input(over)), 'visite'), 'done', JSON.stringify(over));
  }
});

test('un plan non confirmé ne suffit pas : il reste à relire', () => {
  const journey = reviewJourney(input({ plan: plan(false) }));
  assert.equal(state(journey, 'visite'), 'current');
});

test('l’étape en cours dit quoi faire, une étape franchie ne dit rien', () => {
  const journey = reviewJourney(input({ sceneCount: 1, photoCount: 3 }));
  assert.equal(journey.steps.find((s) => s.key === 'visite')?.todo, '');
  assert.ok(journey.current?.todo.includes('question(s) obligatoire(s)'));
});

test('la vérification reprend le premier manque bloquant du dossier', () => {
  const journey = reviewJourney(
    input({
      plan: plan(true),
      photoCount: 1,
      intake: {
        ...emptyIntake,
        gaps: [
          { code: 'photos-non-rattachees', severity: 'advice', message: 'conseil' },
          { code: 'piece-sans-photo', severity: 'blocking', message: 'Il manque une photo pour la chambre.' },
        ],
      },
    }),
  );
  assert.equal(journey.steps.find((s) => s.key === 'verification')?.todo, 'Il manque une photo pour la chambre.');
});

test('un dossier publié n’a plus d’étape en cours', () => {
  const journey = reviewJourney(
    input({
      property: { name: 'Studio', city: 'Paris', status: 'published', videoUrl: '', modelUrl: '', embedUrl: '' },
      sceneCount: 2,
      photoCount: 4,
      facts: fullFacts,
    }),
  );
  assert.equal(journey.current, null);
  assert.equal(journey.progress, 1);
  assert.ok(journey.steps.every((s) => s.state === 'done'));
});

test('la progression compte les étapes franchies', () => {
  const journey = reviewJourney(input({ sceneCount: 1, photoCount: 1 }));
  // logement, visite, photos franchies ; fiche et publication non.
  assert.equal(journey.steps.length, 5);
  assert.ok(Math.abs(journey.progress - 3 / 5) < 1e-9);
});

test('un nom ou une ville vide bloque la première étape', () => {
  const journey = reviewJourney(
    input({ property: { name: 'Studio', city: '  ', status: 'draft', videoUrl: '', modelUrl: '', embedUrl: '' } }),
  );
  assert.equal(state(journey, 'logement'), 'current');
  assert.equal(journey.current?.key, 'logement');
});
