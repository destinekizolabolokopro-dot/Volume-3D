import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BookingError,
  LEAD_HOURS,
  SLOT_MINUTES,
  bookedSlots,
  channelLabel,
  checkSlot,
  dayKey,
  fromParis,
  inParis,
  offeredDays,
  offeredSlots,
  sentence,
  slotLabel,
  timeLabel,
  upcoming,
  type Appointment,
} from '../lib/booking.ts';

/* Deux instants de référence, choisis de part et d'autre du changement d'heure :
   c'est là que tout calcul de créneau se casse la figure. */
const ETE = new Date('2026-08-17T06:00:00Z'); // lundi 17 août, 8 h à Paris (UTC+2)
const HIVER = new Date('2026-01-12T07:00:00Z'); // lundi 12 janvier, 8 h à Paris (UTC+1)

test('l’heure parisienne est lue correctement été comme hiver', () => {
  assert.equal(inParis(ETE).hour, 8);
  assert.equal(inParis(HIVER).hour, 8);
  assert.equal(dayKey(ETE), '2026-08-17');
  assert.equal(dayKey(HIVER), '2026-01-12');
});

test('minuit parisien n’est pas lu comme vingt-quatre heures', () => {
  // 22 h UTC en été = minuit à Paris, le lendemain.
  const minuit = new Date('2026-08-17T22:00:00Z');
  assert.equal(inParis(minuit).hour, 0);
  assert.equal(dayKey(minuit), '2026-08-18');
});

test('une heure locale se convertit en instant, décalage saisonnier compris', () => {
  assert.equal(fromParis(2026, 8, 17, 14 * 60 + 30).toISOString(), '2026-08-17T12:30:00.000Z');
  assert.equal(fromParis(2026, 1, 12, 14 * 60 + 30).toISOString(), '2026-01-12T13:30:00.000Z');
});

test('la conversion tient au passage à l’heure d’hiver', () => {
  // Le changement a lieu le dimanche 25 octobre 2026 à 3 h locales.
  assert.equal(fromParis(2026, 10, 24, 15 * 60).toISOString(), '2026-10-24T13:00:00.000Z');
  assert.equal(fromParis(2026, 10, 26, 15 * 60).toISOString(), '2026-10-26T14:00:00.000Z');
});

test('les heures s’écrivent à la française', () => {
  assert.equal(timeLabel(new Date('2026-08-17T07:00:00Z')), '9 h');
  assert.equal(timeLabel(new Date('2026-08-17T07:30:00Z')), '9 h 30');
  assert.equal(slotLabel('2026-08-17T07:30:00.000Z'), 'lundi 17 août à 9 h 30');
});

test('aucun créneau n’est proposé avant le délai de prévenance', () => {
  const days = offeredDays(ETE);
  const first = days[0].slots[0];
  const gap = new Date(first.start).getTime() - ETE.getTime();
  assert.ok(gap >= LEAD_HOURS * 3600_000, 'le premier créneau doit respecter le délai');
  // 8 h + 3 h = 11 h : le créneau de 11 h passe, celui de 10 h 30 non.
  assert.equal(first.label, '11 h');
});

test('les créneaux tombent dans les plages ouvertes et durent une demi-heure', () => {
  const days = offeredDays(ETE);
  for (const day of days) {
    for (let i = 1; i < day.slots.length; i += 1) {
      const gap = new Date(day.slots[i].start).getTime() - new Date(day.slots[i - 1].start).getTime();
      // Soit le créneau suivant, soit le saut de la pause déjeuner.
      assert.ok(gap >= SLOT_MINUTES * 60_000);
    }
    for (const slot of day.slots) {
      const { hour } = inParis(new Date(slot.start));
      assert.ok(hour >= 9 && hour < 20, `créneau hors plage : ${slot.label}`);
    }
  }
});

test('le dimanche n’est jamais proposé', () => {
  const days = offeredDays(ETE, [], 14);
  for (const day of days) {
    assert.ok(!day.label.startsWith('dimanche'), `dimanche proposé : ${day.label}`);
  }
  // Le samedi, lui, l'est : un propriétaire n'est pas toujours libre en semaine.
  assert.ok(days.some((day) => day.label.startsWith('samedi')));
});

test('un créneau pris est marqué occupé mais reste affiché', () => {
  const libre = offeredDays(ETE);
  const cible = libre[0].slots[0].start;
  const days = offeredDays(ETE, [cible]);
  const slot = days[0].slots.find((candidate) => candidate.start === cible);
  assert.ok(slot, 'le créneau doit rester dans la liste');
  assert.equal(slot!.free, false);
  // Les autres ne sont pas touchés.
  assert.equal(days[0].slots[1].free, true);
});

test('le contrôle serveur refuse un créneau inventé', () => {
  assert.throws(
    () => checkSlot('2026-08-18T01:00:00.000Z', ETE, []),
    (error: unknown) => error instanceof BookingError && /plus proposé/.test((error as Error).message),
  );
  assert.throws(() => checkSlot('pas une date', ETE, []), BookingError);
});

test('le contrôle serveur distingue « inexistant » de « déjà pris »', () => {
  const valide = [...offeredSlots(ETE)][3];
  assert.equal(checkSlot(valide, ETE, []), valide);
  assert.throws(
    () => checkSlot(valide, ETE, [valide]),
    (error: unknown) => error instanceof BookingError && /vient d’être réservé/.test((error as Error).message),
  );
});

test('un créneau normalisé passe quelle que soit son écriture', () => {
  const valide = [...offeredSlots(ETE)][2];
  // Même instant, écrit avec un décalage : ce doit être le même créneau.
  const autre = new Date(valide).toISOString().replace('.000Z', '.000+00:00');
  assert.equal(checkSlot(autre, ETE, []), valide);
});

test('en hiver aussi, la première proposition respecte le délai', () => {
  const days = offeredDays(HIVER);
  const first = new Date(days[0].slots[0].start);
  assert.equal(timeLabel(first), '11 h');
  assert.equal(inParis(first).hour, 11);
});

/* ----------------------------------------------------------- back-office --- */

const rdv = (slot: string, status = 'demande'): Appointment => ({
  id: slot,
  slot,
  name: 'Marc',
  email: 'marc@example.fr',
  phone: '0600000000',
  channel: 'telephone',
  city: 'Paris',
  listings: 1,
  message: '',
  createdAt: '2026-08-17T06:00:00.000Z',
  status,
});

test('les rendez-vous à venir sont triés et les annulés écartés', () => {
  const liste = [
    rdv('2026-08-20T09:00:00.000Z'),
    rdv('2026-08-18T09:00:00.000Z'),
    rdv('2026-08-19T09:00:00.000Z', 'annule'),
    rdv('2026-08-10T09:00:00.000Z'),
  ];
  assert.deepEqual(
    upcoming(liste, ETE).map((appointment) => appointment.slot),
    ['2026-08-18T09:00:00.000Z', '2026-08-20T09:00:00.000Z'],
  );
});

test('un créneau annulé se libère', () => {
  const liste = [rdv('2026-08-20T09:00:00.000Z', 'annule'), rdv('2026-08-21T09:00:00.000Z')];
  assert.deepEqual(bookedSlots(liste), ['2026-08-21T09:00:00.000Z']);
});

test('le canal inconnu retombe sur le téléphone', () => {
  assert.equal(channelLabel('visio'), 'En visio');
  assert.equal(channelLabel('pigeon'), 'Par téléphone');
});

test('la capitale ne tombe que sur la première lettre', () => {
  // « capitalize » en CSS aurait donné « Mercredi 19 Août » : en français, un
  // nom de mois ne prend pas de majuscule.
  assert.equal(sentence('mercredi 19 août'), 'Mercredi 19 août');
  assert.equal(sentence(''), '');
  assert.equal(sentence('à'), 'À');
});
