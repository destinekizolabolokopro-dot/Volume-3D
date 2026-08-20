import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atPlace, bedroomCount, buildListing, buildTitle, TITLE_LIMIT, typology } from '../lib/listing.ts';
import { formatArea } from '../lib/floorplan-svg.ts';
import type { FloorPlan, PlanRoom, Property, PropertyFact } from '../lib/types.ts';

const room = (id: string, name: string, w: number, h: number, x = 0): PlanRoom => ({
  id,
  name,
  height: 2.5,
  points: [
    { x, y: 0 },
    { x: x + w, y: 0 },
    { x: x + w, y: h },
    { x, y: h },
  ],
});

const plan = (rooms: PlanRoom[]): FloorPlan => ({
  id: 'plan1',
  propertyId: 'bien1',
  imageUrl: '',
  rooms,
  declaredArea: 42,
  readBy: 'test',
  readAt: '2026-01-01T00:00:00.000Z',
  confirmed: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const property = (over: Partial<Property> = {}): Property =>
  ({
    id: 'bien1',
    accountId: 'compte1',
    name: 'Appartement lumineux',
    city: 'Paris',
    slug: 'appartement-lumineux',
    description: '',
    embedUrl: '',
    modelUrl: '',
    videoUrl: '',
    status: 'published',
    views: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    facts: [],
    ...over,
  }) as Property;

const owner = (key: string, value: string): PropertyFact => ({ key, value, source: 'proprietaire' });
const guess = (key: string, value: string): PropertyFact => ({ key, value, source: 'ia' });

test('la préposition se contracte comme en français', () => {
  assert.equal(atPlace('Le Marais'), 'au Marais');
  assert.equal(atPlace('Les Sables-d’Olonne'), 'aux Sables-d’Olonne');
  assert.equal(atPlace('La Rochelle'), 'à la Rochelle');
  assert.equal(atPlace('L’Isle-sur-la-Sorgue'), 'à l’Isle-sur-la-Sorgue');
  assert.equal(atPlace('Bordeaux'), 'à Bordeaux');
  assert.equal(atPlace('  '), '');
});

test('la typologie compte les pièces principales, pas toutes les pièces', () => {
  assert.equal(typology(plan([room('sejour', 'Séjour', 5, 4), room('ch', 'Chambre', 3, 3, 5)])), 'T2');
  assert.equal(
    typology(
      plan([
        room('sejour', 'Séjour', 5, 4),
        room('c1', 'Chambre 1', 3, 3, 5),
        room('c2', 'Chambre 2', 3, 3, 8),
        room('sdb', 'Salle d’eau', 2, 2, 11),
        room('deg', 'Dégagement', 1, 2, 13),
      ]),
    ),
    'T3',
  );
  assert.equal(typology(plan([room('studio', 'Pièce de vie', 5, 5)])), 'T1');
  assert.equal(typology(null), '');
});

test('les chambres sont comptées sur le plan', () => {
  assert.equal(bedroomCount(plan([room('c1', 'Chambre 1', 3, 3), room('c2', 'Chambre 2', 3, 3, 3)])), 2);
  assert.equal(bedroomCount(null), 0);
});

test('le titre reste sous la limite d’Airbnb', () => {
  const long = property({ name: 'Un nom de logement vraiment très long qui dépasse largement la limite' });
  const title = buildTitle(long, null, []);
  assert.ok(title.length <= TITLE_LIMIT, title);
  assert.ok(!title.endsWith(' '));
});

test('le titre réunit typologie, surface et lieu', () => {
  const title = buildTitle(
    property(),
    /* Une surface volontairement non entière : c'est le seul cas où un arrondi
       peut annoncer plus que ce qui a été mesuré, donc le seul qui teste
       quelque chose. Avec 5 × 4 le contrôle plus bas serait toujours vrai. */
    plan([room('sejour', 'Séjour', 5, 4.15), room('ch', 'Chambre', 3, 3, 5)]),
    [owner('adresse', 'Le Marais'), owner('exposition', 'Très lumineux')],
  );
  assert.ok(title.includes('T2'), title);
  assert.ok(title.includes('m²'), title);
  assert.ok(title.includes('Marais'), title);
  assert.ok(title.length <= TITLE_LIMIT);

  /*
   * Le titre annonce exactement la surface que le plan dessine.
   *
   * Elle était arrondie à l'entier de son côté : un logement relevé à 37,8 m²
   * devenait « T2 38 m² » juste au-dessus d'un plan qui écrivait 37,8 et d'une
   * description qui écrivait 37,8. Trois chiffres pour la même pièce, sur le
   * même écran, dont un plus grand que la mesure.
   *
   * Le contrôle a d'abord été écrit « le titre ne dépasse jamais la surface
   * mesurée », et il échouait de cinq centièmes sur la version corrigée :
   * `formatArea` arrondit lui aussi au dixième. C'était la mauvaise règle. Ce
   * qu'on veut n'est pas une borne, c'est qu'il n'y ait **qu'un seul chiffre**
   * pour un logement — celui du plan.
   */
  const mesuree = 5 * 4.15 + 3 * 3;
  assert.ok(
    title.includes(formatArea(mesuree)),
    `le titre « ${title} » n’annonce pas ${formatArea(mesuree)}`,
  );
});

test('une réponse non confirmée par le propriétaire n’entre pas dans l’annonce', () => {
  const draft = buildListing(property(), null, [
    guess('equipements', 'Lave-linge, Four'),
    guess('meuble', 'Entièrement meublé'),
  ]);
  assert.ok(!draft.description.includes('Lave-linge'), draft.description);
  assert.ok(!draft.description.includes('meublé'), draft.description);
});

test('les pièces de circulation ne figurent pas dans le texte', () => {
  const draft = buildListing(
    property(),
    plan([room('sejour', 'Séjour', 5, 4), room('deg', 'Dégagement', 1.4, 1.8, 5)]),
    [],
  );
  assert.ok(draft.description.includes('séjour'), draft.description);
  assert.ok(!draft.description.toLowerCase().includes('dégagement'), draft.description);
});

test('les noms propres gardent leur casse', () => {
  const draft = buildListing(property(), null, [
    owner('proximite', 'Métro Saint-Paul, Place des Vosges'),
    owner('equipements', 'Wi-Fi, Lave-vaisselle'),
  ]);
  assert.ok(draft.description.includes('Métro Saint-Paul'), draft.description);
  assert.ok(draft.description.includes('Wi-Fi'), draft.description);
});

test('les points forts ne se répètent pas', () => {
  const draft = buildListing(property(), null, [
    owner('equipements', 'Ascenseur'),
    owner('etage', 'Ascenseur'),
  ]);
  const lower = draft.highlights.map((h) => h.toLowerCase());
  assert.equal(new Set(lower).size, lower.length, draft.highlights.join(' | '));
});

test('le lien de la visite n’est que dans le message, jamais dans l’annonce', () => {
  const url = 'https://volume3d.fr/v/appartement-lumineux';
  const draft = buildListing(property(), null, [owner('couchages', '4')], url);
  assert.ok(draft.travellerMessage.includes(url));
  assert.ok(!draft.description.includes(url));
  assert.ok(!draft.title.includes(url));
});

test('ce qui manque est nommé, et disparaît une fois renseigné', () => {
  const empty = buildListing(property(), null, []);
  assert.ok(empty.missing.length >= 4);
  assert.ok(empty.missing.some((m) => m.includes('plan')));

  const full = buildListing(
    property(),
    plan([room('sejour', 'Séjour', 5, 4), room('ch', 'Chambre', 3, 3, 5)]),
    [
      owner('couchages', '4'),
      owner('proximite', 'Métro Saint-Paul'),
      owner('equipements', 'Wi-Fi'),
      owner('particularites', 'Vue sur cour'),
    ],
  );
  assert.deepEqual(full.missing, []);
});

test('un dossier vide produit quand même un texte utilisable', () => {
  const draft = buildListing(property({ city: '' }), null, []);
  assert.ok(draft.title.length > 0);
  assert.ok(draft.summary.length > 0);
  assert.ok(draft.travellerMessage.includes('Bonjour'));
});
