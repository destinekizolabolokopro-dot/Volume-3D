import { NextResponse } from 'next/server';
import { cadence, origine } from '@/lib/cadence';
import { domaine } from '@/lib/domaines';
import { orienter } from '@/lib/juriste';
import { ValidationError, text } from '@/lib/validation';

/**
 * « Où va cette question ? »
 *
 * La page d'accueil appelle cette route avant d'ouvrir une consultation. Elle
 * ne répond jamais par un domaine seul : elle renvoie aussi les autres pistes
 * et les mots qui ont décidé, pour que la page les affiche et laisse corriger.
 */

const FREIN = cadence(20, 60_000);

export async function POST(request: Request) {
  try {
    if (FREIN.depasse(origine(request))) {
      return NextResponse.json({ error: 'Trop de demandes d’affilée. Patientez une minute.' }, { status: 429 });
    }

    const body = (await request.json()) as { question?: unknown };
    const question = text(body.question, 'question', { max: 2000 });

    const orientation = await orienter(question);

    return NextResponse.json({
      domaine: orientation.domaine,
      certitude: orientation.certitude,
      pistes: orientation.pistes.map((piste) => ({
        id: piste.id,
        label: domaine(piste.id).label,
        resume: domaine(piste.id).resume,
        indices: piste.indices.slice(0, 4),
      })),
    });
  } catch (cause) {
    if (cause instanceof ValidationError) {
      return NextResponse.json({ error: cause.message }, { status: 400 });
    }
    console.error('aiguillage', cause);
    return NextResponse.json({ error: 'Aiguillage impossible pour le moment.' }, { status: 500 });
  }
}
