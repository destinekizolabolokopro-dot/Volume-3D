import { NextResponse } from 'next/server';
import { applyBeacon, AttentionError, parseBeacon } from '@/lib/attention';
import { findPublishedProperty, loadTour } from '@/lib/queries';
import { getStore } from '@/lib/store';
import { orderedRooms } from '@/lib/plan';
import { ValidationError, text } from '@/lib/validation';

/**
 * Réception des mesures d'attention.
 *
 * Point d'entrée **public et sans authentification** : c'est un voyageur qui
 * l'appelle, et il n'a pas de compte. Tout ce qui arrive est donc traité comme
 * hostile, et trois barrières se succèdent.
 *
 * 1. La visite doit exister et être publiée. Un identifiant inventé n'écrit
 *    rien.
 * 2. Les pièces doivent appartenir à cette visite. La liste des identifiants
 *    acceptés est construite ici, à partir de la base, jamais du corps de la
 *    requête.
 * 3. Les durées sont bornées (`lib/attention.ts`), et le débit limité par
 *    logement et par adresse.
 *
 * La réponse ne dit jamais ce qui a été écrit ni ce qui a été refusé : ce
 * point d'entrée n'est pas un moyen de sonder la base.
 */

/** Une visite mesure une fois par chargement ; au-delà c'est du bruit. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;

const hits = new Map<string, number[]>();

function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

/** Le corps arrive par `sendBeacon` : petit, et à lire sans traîner. */
const MAX_BODY = 4096;

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return NextResponse.json({ ok: true });

    const body = JSON.parse(raw) as { slug?: unknown; rooms?: unknown };
    const slug = text(body.slug, 'visite', { max: 80 });

    const property = await findPublishedProperty(slug);
    if (!property) return NextResponse.json({ ok: true });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnu';
    if (rateLimited(`${property.id}:${ip}`)) return NextResponse.json({ ok: true });

    // Les identifiants acceptés viennent de la base, pas de la requête : c'est
    // ce qui empêche d'inventer une pièce pour gonfler un compteur.
    const store = getStore();
    const { scenes } = await loadTour(property.id);
    const plans = await store.list('plans', { propertyId: property.id });
    const plan = plans.find((entry) => entry.confirmed) ?? null;
    const known = [...scenes.map((scene) => scene.id), ...(plan ? orderedRooms(plan).map((room) => room.id) : [])];
    if (known.length === 0) return NextResponse.json({ ok: true });

    const entries = parseBeacon(body, known);
    if (entries.length === 0) return NextResponse.json({ ok: true });

    const existing = await store.list('attention', { propertyId: property.id });
    const { updated, created } = applyBeacon(existing, property.id, entries);
    for (const row of updated) await store.update('attention', row.id, row);
    for (const row of created) await store.insert('attention', row);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Un lot mal formé n'est pas une erreur pour l'appelant : la mesure est
    // accessoire, elle ne doit jamais faire remonter d'erreur dans une visite.
    if (error instanceof AttentionError || error instanceof ValidationError || error instanceof SyntaxError) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }
}
