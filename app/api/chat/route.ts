import { NextResponse } from 'next/server';
import { askAssistant, isAssistantConfigured } from '@/lib/assistant';
import { randomId } from '@/lib/ids';
import { findPublishedProperty, loadTour } from '@/lib/queries';
import { getStore } from '@/lib/store';
import type { ChatMessage } from '@/lib/types';
import { ValidationError, text } from '@/lib/validation';

/** Une visite très fréquentée ne doit pas pouvoir vider le budget d'API. */
const MAX_TURNS = 12;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

/**
 * Compteur en mémoire, volontairement simple : il freine les rafales sur une
 * même instance sans base ni dépendance. Sur plusieurs instances la limite est
 * appliquée par instance — suffisant à cette échelle, à remplacer par un
 * compteur partagé si le trafic grandit.
 */
const hits = new Map<string, number[]>();

function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  try {
    if (!isAssistantConfigured()) {
      return NextResponse.json({ error: 'assistant_indisponible' }, { status: 503 });
    }

    const body = (await request.json()) as { slug?: unknown; messages?: unknown };
    const slug = text(body.slug, 'visite', { max: 80 });

    const property = await findPublishedProperty(slug);
    if (!property || !property.chatEnabled) {
      return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnu';
    if (rateLimited(`${property.id}:${ip}`)) {
      return NextResponse.json(
        { error: 'Trop de questions d’affilée. Patientez une minute.' },
        { status: 429 },
      );
    }

    const raw = Array.isArray(body.messages) ? body.messages : [];
    const history = raw
      .slice(-MAX_TURNS)
      .map((entry) => entry as { role?: unknown; content?: unknown })
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .map((entry) => ({
        role: entry.role as 'user' | 'assistant',
        content: String(entry.content ?? '').slice(0, 1000),
      }))
      .filter((entry) => entry.content.trim() !== '');

    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      throw new ValidationError('Posez une question.');
    }

    const store = getStore();
    const { scenes } = await loadTour(property.id);
    const [chapters, photos] = await Promise.all([
      store.list('chapters', { propertyId: property.id }),
      store.list('photos', { propertyId: property.id }),
    ]);

    const reply = await askAssistant(
      { property, scenes, chapters: chapters.sort((a, b) => a.seconds - b.seconds), photos },
      history,
    );

    // Les questions posées sont la matière première du tableau de bord :
    // elles disent au propriétaire ce que son annonce n'explique pas.
    const record: ChatMessage = {
      id: randomId(),
      propertyId: property.id,
      question: history[history.length - 1].content,
      answer: reply.answer,
      createdAt: new Date().toISOString(),
    };
    store.insert('chatMessages', record).catch((error) => {
      console.error('[chat] enregistrement impossible', error);
    });

    return NextResponse.json({ answer: reply.answer });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[chat] échec', error);
    return NextResponse.json(
      { error: 'L’assistant est momentanément indisponible.' },
      { status: 500 },
    );
  }
}
