import { NextResponse } from 'next/server';
import {
  BookingError,
  bookedSlots,
  checkSlot,
  offeredDays,
  slotLabel,
  type Appointment,
} from '@/lib/booking';
import { randomId } from '@/lib/ids';
import { getStore } from '@/lib/store';
import { ValidationError, email, text } from '@/lib/validation';

/**
 * Réservation d'un créneau.
 *
 * Point d'entrée **public et sans authentification** : c'est un inconnu qui
 * l'appelle. Trois barrières, dans cet ordre.
 *
 * 1. Le débit, par adresse, et **deux compteurs distincts**. Le premier borne
 *    le nombre de requêtes : personne n'a de raison légitime d'en envoyer
 *    trente en dix minutes. Le second borne le nombre de rendez-vous
 *    réellement pris, parce qu'un agenda saturé est une panne aussi efficace
 *    qu'une autre.
 *
 *    Les séparer n'est pas un détail : avec un seul compteur, quelqu'un qui se
 *    trompe quatre fois d'adresse e-mail se retrouvait interdit de réservation
 *    pendant dix minutes. On compte les réservations abouties, pas les
 *    tentatives.
 * 2. Le créneau, recalculé ici. La page en propose une liste, mais c'est le
 *    serveur qui décide : un créneau qui n'est pas dans la liste qu'il vient de
 *    reconstruire est refusé, quelle que soit sa provenance.
 * 3. Les champs, bornés et typés comme partout ailleurs.
 *
 * La réponse d'erreur est explicite, contrairement à celle de la mesure
 * d'attention : ici, quelqu'un attend une réponse et doit pouvoir corriger.
 */

const WINDOW_MS = 10 * 60_000;
/** Requêtes acceptées par adresse et par fenêtre, quelle qu'en soit l'issue. */
const MAX_REQUESTS = 30;
/** Rendez-vous réellement pris par adresse et par fenêtre. */
const MAX_BOOKINGS = 4;
const MAX_BODY = 4096;

const requests = new Map<string, number[]>();
const bookings = new Map<string, number[]>();

function tooMany(ledger: Map<string, number[]>, key: string, cap: number, now = Date.now()): boolean {
  const recent = (ledger.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  ledger.set(key, recent);
  if (ledger.size > 5000) ledger.clear();
  return recent.length > cap;
}

/** Combien de réservations abouties, sans en compter une de plus. */
function bookedRecently(key: string, now = Date.now()): number {
  return (bookings.get(key) ?? []).filter((time) => now - time < WINDOW_MS).length;
}

const clientOf = (request: Request): string =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnu';

/** Les créneaux encore libres. La page s'en sert pour se remettre à jour. */
export async function GET() {
  const taken = bookedSlots(await getStore().list('appointments'));
  return NextResponse.json({ days: offeredDays(new Date(), taken) });
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return NextResponse.json({ error: 'Message trop long.' }, { status: 400 });
    }
    const body = JSON.parse(raw) as Record<string, unknown>;

    // Champ leurre : un robot le remplit, un humain ne le voit pas. On répond
    // comme si tout allait bien plutôt que de lui apprendre qu'il est repéré.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, slot: '' });
    }

    const client = clientOf(request);
    if (tooMany(requests, client, MAX_REQUESTS)) {
      return NextResponse.json(
        { error: 'Trop de demandes d’affilée. Réessayez dans quelques minutes.' },
        { status: 429 },
      );
    }
    if (bookedRecently(client) >= MAX_BOOKINGS) {
      return NextResponse.json(
        {
          error:
            'Vous avez déjà réservé plusieurs créneaux. Écrivez-nous plutôt, on organisera ça ensemble.',
        },
        { status: 429 },
      );
    }

    const store = getStore();
    const existing = await store.list('appointments');
    const slot = checkSlot(text(body.slot, 'créneau', { max: 40 }), new Date(), bookedSlots(existing));

    const appointment: Appointment = {
      id: randomId(),
      slot,
      name: text(body.name, 'nom', { max: 120 }),
      email: email(body.email),
      phone: text(body.phone, 'téléphone', { max: 40 }),
      channel: body.channel === 'visio' ? 'visio' : 'telephone',
      city: text(body.city, 'ville', { max: 120, required: false }),
      listings: Math.max(0, Math.min(500, Math.round(Number(body.listings) || 0))),
      message: text(body.message, 'message', { max: 1200, required: false }),
      createdAt: new Date().toISOString(),
      status: 'demande',
    };

    await store.insert('appointments', appointment);
    // Compté seulement maintenant : c'est la réservation qui coûte, pas l'essai.
    tooMany(bookings, client, MAX_BOOKINGS);
    return NextResponse.json({ ok: true, slot: slotLabel(slot) });
  } catch (error) {
    if (error instanceof BookingError) {
      // 409 et non 400 : la demande était bien formée, c'est l'état du monde qui
      // a changé. La page repropose la liste au lieu d'accuser le visiteur.
      const days = offeredDays(new Date(), bookedSlots(await getStore().list('appointments')));
      return NextResponse.json({ error: error.message, days }, { status: 409 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[rendez-vous] échec enregistrement', error);
    return NextResponse.json(
      { error: 'Impossible d’enregistrer la demande. Réessayez, ou écrivez-nous directement.' },
      { status: 500 },
    );
  }
}
