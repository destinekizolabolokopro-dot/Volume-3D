import assert from 'node:assert/strict';
import { test } from 'node:test';
import { floorPlanDataUri, floorPlanFileName, formatArea, renderFloorPlan } from '../lib/floorplan-svg.ts';
import type { FloorPlan, PlanDoor, PlanRoom } from '../lib/types.ts';

const room = (id: string, name: string, x: number, y: number, w: number, h: number): PlanRoom => ({
  id,
  name,
  height: 2.5,
  points: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});

const plan = (rooms: PlanRoom[]): FloorPlan => ({
  id: 'plan1',
  propertyId: 'bien1',
  imageUrl: '',
  rooms,
  declaredArea: 40,
  readBy: 'test',
  readAt: '2026-01-01T00:00:00.000Z',
  confirmed: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const door = (over: Partial<PlanDoor> = {}): PlanDoor => ({
  id: 'd1',
  planId: 'plan1',
  from: 'sejour',
  to: 'chambre',
  a: { x: 5, y: 1 },
  b: { x: 5, y: 1.9 },
  kind: 'door',
  height: 2.05,
  sill: 0,
  ...over,
});

const twoRooms = plan([room('sejour', 'Séjour', 0, 0, 5, 4), room('chambre', 'Chambre', 5, 0, 3, 3)]);

test('la surface se lit à la française', () => {
  assert.equal(formatArea(20.75), '20,8 m²');
  assert.equal(formatArea(3), '3,0 m²');
});

test('un plan sans pièce ne rend rien', () => {
  assert.equal(renderFloorPlan(plan([]), []), '');
  assert.equal(floorPlanDataUri(plan([]), []), '');
});

test('le dessin porte le nom et la surface de chaque pièce', () => {
  const svg = renderFloorPlan(twoRooms, []);
  assert.ok(svg.includes('Séjour'), 'nom du séjour absent');
  assert.ok(svg.includes('Chambre'), 'nom de la chambre absent');
  assert.ok(svg.includes('20,0 m²'), 'surface du séjour absente');
  assert.ok(svg.includes('9,0 m²'), 'surface de la chambre absente');
});

test('l’en-tête annonce le nombre de pièces et la surface totale', () => {
  const svg = renderFloorPlan(twoRooms, [], { title: 'Mon logement' });
  assert.ok(svg.includes('Mon logement'));
  assert.ok(svg.includes('2 pièces · 29,0 m²'), svg.slice(0, 400));
});

test('le SVG est bien formé et à la bonne largeur', () => {
  const svg = renderFloorPlan(twoRooms, [], { width: 800 });
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('width="800"'));
  // Autant de balises ouvrantes que de fermantes sur les éléments à contenu.
  const open = (svg.match(/<text /g) ?? []).length;
  const close = (svg.match(/<\/text>/g) ?? []).length;
  assert.equal(open, close);
});

test('un nom de pièce qui contient un caractère XML est échappé', () => {
  const svg = renderFloorPlan(plan([room('s', 'Cuisine & <salon>', 0, 0, 4, 4)]), []);
  assert.ok(svg.includes('Cuisine &amp; &lt;salon&gt;'), 'échappement manquant');
  assert.ok(!svg.includes('<salon>'), 'balise injectée');
});

test('une porte trace son battant et son arc, une fenêtre deux traits', () => {
  const withDoor = renderFloorPlan(twoRooms, [door()]);
  assert.ok(withDoor.includes('<path d="M '), 'arc de porte absent');

  const withWindow = renderFloorPlan(twoRooms, [door({ kind: 'window', a: { x: 1, y: 0 }, b: { x: 3, y: 0 } })]);
  assert.ok(!withWindow.includes('<path d="M '), 'une fenêtre n’a pas d’arc');
});

test('un passage sans porte interrompt le mur sans rien dessiner', () => {
  const nu = renderFloorPlan(twoRooms, []);
  const withOpening = renderFloorPlan(twoRooms, [door({ kind: 'opening' })]);
  // Le mur est coupé en deux : un trait de plus qu'un mur plein.
  const count = (svg: string) => (svg.match(/<line /g) ?? []).length;
  assert.ok(count(withOpening) > count(nu), 'le mur n’a pas été percé');
  assert.ok(!withOpening.includes('<path d="M '), 'un passage n’a pas de battant');
});

test('le data URI est décodable et le nom de fichier propre', () => {
  const uri = floorPlanDataUri(twoRooms, []);
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
  const decoded = decodeURIComponent(uri.slice('data:image/svg+xml;charset=utf-8,'.length));
  assert.ok(decoded.startsWith('<svg '));

  assert.equal(floorPlanFileName('Appartement lumineux — Le Marais'), 'plan-appartement-lumineux-le-marais.svg');
  assert.equal(floorPlanFileName(''), 'plan-logement.svg');
});

test('le libellé d’une pièce étroite est réduit pour ne pas déborder', () => {
  // Les deux pièces sont sur le même plan : sans cela on comparerait des
  // tailles prises à deux échelles différentes, ce qui ne veut rien dire.
  const svg = renderFloorPlan(
    plan([room('s', 'Séjour', 0, 0, 6, 5), room('d', 'Dégagement', 6, 0, 1.2, 3)]),
    [],
    { width: 1000 },
  );
  const sizes = [...svg.matchAll(/font-size="([\d.]+)" font-weight="600"/g)].map((m) => Number(m[1]));
  assert.equal(sizes.length, 2, 'les deux noms devraient être écrits');
  const [large, narrow] = sizes;
  assert.ok(narrow < large, `étroit ${narrow} vs large ${large}`);
});
