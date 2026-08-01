import { NextResponse } from 'next/server';
import { randomId } from '@/lib/ids';
import { getStore } from '@/lib/store';
import type { Lead } from '@/lib/types';
import { ValidationError, email, text } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Champ leurre rempli : c'est un robot. On répond 200 pour ne pas
    // lui signaler qu'il a été détecté, mais on n'enregistre rien.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true });
    }

    const lead: Lead = {
      id: randomId(),
      name: text(body.name, 'nom', { max: 120 }),
      email: email(body.email),
      phone: text(body.phone, 'téléphone', { max: 40, required: false }),
      city: text(body.city, 'ville', { max: 120 }),
      profile: text(body.profile, 'profil', { max: 40, required: false }) || 'proprietaire',
      message: text(body.message, 'message', { max: 2000, required: false }),
      createdAt: new Date().toISOString(),
      handled: false,
    };

    await getStore().insert('leads', lead);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[contact] échec enregistrement', error);
    return NextResponse.json(
      { error: 'Impossible d’enregistrer votre demande. Réessayez ou écrivez-nous directement.' },
      { status: 500 },
    );
  }
}
