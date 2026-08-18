import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyBeacon,
  AttentionError,
  dayKey,
  ENOUGH_VISITS,
  formatDuration,
  insight,
  MAX_ROOMS_PER_BEACON,
  MAX_SECONDS_PER_ROOM,
  MAX_TOTAL_SECONDS,
  parseBeacon,
  summarize,
  type RoomAttention,
} from '../lib/attention.ts';

const rooms = ['salon', 'chambre', 'bain'];
const named = [
  { id: 'salon', name: 'Salon' },
  { id: 'chambre', name: 'Chambre' },
  { id: 'bain', name: 'Salle de bain' },
];

const row = (roomId: string, seconds: number, opens: number, day = '2026-08-03'): RoomAttention => ({
  id: `bien1:${day}:${roomId}`,
  propertyId: 'bien1',
  day,
  roomId,
  seconds,
  opens,
});

/* ------------------------------------------------------------- réception */

test('un lot valide est accepté tel quel', () => {
  const out = parseBeacon({ rooms: [{ roomId: 'salon', seconds: 42 }, { roomId: 'chambre', seconds: 13 }] }, rooms);
  assert.deepEqual(out, [
    { roomId: 'salon', seconds: 42 },
    { roomId: 'chambre', seconds: 13 },
  ]);
});

test('une pièce inconnue est ignorée, pas rejetée', () => {
  const out = parseBeacon({ rooms: [{ roomId: 'cave', seconds: 30 }, { roomId: 'salon', seconds: 10 }] }, rooms);
  assert.deepEqual(out, [{ roomId: 'salon', seconds: 10 }]);
});

test('une durée un peu trop grande est ramenée à sa borne', () => {
  // Une horloge qui dérive, un onglet resté au premier plan : on corrige.
  const out = parseBeacon({ rooms: [{ roomId: 'salon', seconds: 1200 }] }, rooms);
  assert.equal(out[0].seconds, MAX_SECONDS_PER_ROOM);
});

test('une durée manifestement inventée est écartée, pas ramenée', () => {
  // La ramener reviendrait à créditer le maximum à chaque lot forgé : en
  // répétant l'envoi, on gonflerait le compteur d'un logement sans limite.
  const out = parseBeacon({ rooms: [{ roomId: 'salon', seconds: 99999 }] }, rooms);
  assert.deepEqual(out, []);
  const limite = parseBeacon({ rooms: [{ roomId: 'salon', seconds: MAX_SECONDS_PER_ROOM * 2 }] }, rooms);
  assert.equal(limite[0].seconds, MAX_SECONDS_PER_ROOM, 'la borne exacte reste acceptée');
});

test('les durées négatives, nulles ou non numériques sont écartées', () => {
  const out = parseBeacon(
    { rooms: [{ roomId: 'salon', seconds: -5 }, { roomId: 'chambre', seconds: 0 }, { roomId: 'bain', seconds: 'x' }] },
    rooms,
  );
  assert.deepEqual(out, []);
});

test('découper une durée sur plusieurs entrées ne contourne pas le plafond', () => {
  // Dix entrées de 500 s sur la même pièce : le plafond par pièce s'applique
  // après fusion, sinon on le franchirait en découpant.
  const items = Array.from({ length: 10 }, () => ({ roomId: 'salon', seconds: 500 }));
  const out = parseBeacon({ rooms: items }, rooms);
  assert.equal(out.length, 1);
  assert.equal(out[0].seconds, MAX_SECONDS_PER_ROOM);
});

test('le total d’un lot est plafonné', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ roomId: rooms[i % 3], seconds: 900 }));
  const out = parseBeacon({ rooms: many }, rooms);
  const total = out.reduce((sum, entry) => sum + entry.seconds, 0);
  assert.ok(total <= MAX_TOTAL_SECONDS, `total ${total}`);
});

test('un lot informe ou trop gros est refusé', () => {
  assert.throws(() => parseBeacon({}, rooms), AttentionError);
  assert.throws(() => parseBeacon({ rooms: 'salon' }, rooms), AttentionError);
  const trop = Array.from({ length: MAX_ROOMS_PER_BEACON + 1 }, () => ({ roomId: 'salon', seconds: 1 }));
  assert.throws(() => parseBeacon({ rooms: trop }, rooms), AttentionError);
});

/* ------------------------------------------------------------- agrégation */

test('un lot crée les compteurs absents et incrémente les autres', () => {
  const existing = [row('salon', 100, 4)];
  const { updated, created } = applyBeacon(
    existing,
    'bien1',
    [{ roomId: 'salon', seconds: 20 }, { roomId: 'chambre', seconds: 30 }],
    '2026-08-03',
  );
  assert.equal(updated.length, 1);
  assert.equal(updated[0].seconds, 120);
  assert.equal(updated[0].opens, 5);
  assert.equal(created.length, 1);
  assert.equal(created[0].roomId, 'chambre');
  assert.equal(created[0].opens, 1);
  assert.equal(created[0].id, 'bien1:2026-08-03:chambre');
});

test('un compteur d’un autre jour n’est pas touché', () => {
  const existing = [row('salon', 100, 4, '2026-08-02')];
  const { updated, created } = applyBeacon(existing, 'bien1', [{ roomId: 'salon', seconds: 10 }], '2026-08-03');
  assert.deepEqual(updated, []);
  assert.equal(created.length, 1);
  assert.equal(created[0].day, '2026-08-03');
});

test('la clé du jour est en UTC', () => {
  assert.equal(dayKey(new Date('2026-08-03T23:30:00Z')), '2026-08-03');
  assert.match(dayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

/* ---------------------------------------------------------------- lecture */

test('le résumé classe les pièces et calcule les parts', () => {
  const s = summarize([row('salon', 600, 10), row('chambre', 300, 8), row('bain', 100, 5)], named);
  assert.equal(s.totalSeconds, 1000);
  assert.equal(s.visits, 10);
  assert.deepEqual(s.rooms.map((r) => r.roomId), ['salon', 'chambre', 'bain']);
  assert.ok(Math.abs(s.rooms[0].share - 0.6) < 1e-9);
  assert.equal(s.rooms[0].average, 60);
  assert.ok(Math.abs(s.rooms[1].reach - 0.8) < 1e-9);
});

test('une pièce supprimée du logement disparaît du résumé', () => {
  const s = summarize([row('salon', 100, 3), row('ancienne-piece', 90, 3)], named);
  assert.deepEqual(s.rooms.map((r) => r.roomId), ['salon']);
});

test('sans mesure, le résumé est vide et ne conclut rien', () => {
  const s = summarize([], named);
  assert.equal(s.visits, 0);
  assert.equal(s.totalSeconds, 0);
  assert.deepEqual(s.rooms, []);
  assert.equal(insight(s), '');
});

test('en dessous du seuil, on annonce qu’on ne conclut pas', () => {
  const s = summarize([row('salon', 60, 3), row('chambre', 10, 1)], named);
  assert.ok(s.thin);
  assert.match(insight(s), /trop peu de visites/);
  assert.ok(insight(s).includes(String(ENOUGH_VISITS)));
});

test('un décrochage franc est signalé, avec les accords justes', () => {
  // La chambre n'est atteinte que par 2 visites sur 10.
  const s = summarize([row('salon', 600, 10), row('chambre', 200, 2)], named);
  assert.ok(!s.thin);
  assert.match(insight(s), /Seuls 20 % des visiteurs atteignent la chambre/);
  assert.match(insight(s), /passage/);
});

test('une pièce qui monopolise l’attention est signalée', () => {
  // Trois pièces : la part équitable est de 33 %, le seuil de 67 %.
  const s = summarize([row('salon', 900, 10), row('chambre', 80, 9), row('bain', 40, 9)], named);
  assert.match(insight(s), /Salon retient/);
});

test('sur deux pièces, dépasser la moitié n’est pas un déséquilibre', () => {
  // 51 % sur deux pièces est la normale, pas une anomalie : le seuil suit la
  // part équitable, il ne se déclenche pas ici.
  const s = summarize([row('salon', 400, 10), row('chambre', 380, 10)], named);
  const text = insight(s);
  assert.ok(!text.includes('retient'), text);
  assert.match(text, /se répartit/);
});

test('les durées se lisent en français', () => {
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(60), '1 min');
  assert.equal(formatDuration(80), '1 min 20 s');
  assert.equal(formatDuration(0), '0 s');
});
