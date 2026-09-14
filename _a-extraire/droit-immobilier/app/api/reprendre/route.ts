import { NextResponse } from 'next/server';
import { compteCourant } from '@/lib/comptes';
import { ajouterTour, ouvrirConsultation } from '@/lib/consultations';
import { estDomaineId } from '@/lib/domaines';
import { relireLeFil } from '@/lib/reprise';

/**
 * Verser en base la consultation d'essai de quelqu'un qui vient d'ouvrir un
 * compte.
 *
 * Le fil vient du navigateur, donc de n'importe qui : il est relu et borné par
 * `relireLeFil` avant d'écrire quoi que ce soit. Et il est écrit au nom du
 * compte de la SESSION, jamais d'un identifiant transmis dans la requête — la
 * route ne peut donc pas servir à déposer un fil dans le dossier d'un autre.
 *
 * Elle est délibérément indulgente : une reprise qui échoue rend `null` et
 * laisse la personne dans son espace, plutôt que de lui barrer l'entrée avec
 * une erreur qui ne lui apprendrait rien.
 */
export async function POST(request: Request) {
  const compte = await compteCourant();
  if (!compte) {
    return NextResponse.json({ consultationId: null }, { status: 401 });
  }

  let brut: unknown = null;
  try {
    brut = await request.json();
  } catch {
    return NextResponse.json({ consultationId: null }, { status: 400 });
  }

  const fil = relireLeFil(brut);
  if (!fil) {
    return NextResponse.json({ consultationId: null }, { status: 400 });
  }

  /* La spécialité doit exister : elle sert à rouvrir le fil avec le bon
     spécialiste, et un identifiant inconnu laisserait une consultation qu'on
     ne peut plus reprendre. */
  const domaine = estDomaineId(fil.domaine) ? fil.domaine : 'bail-habitation';

  const consultation = await ouvrirConsultation(compte.id, domaine, fil.tours[0].content);
  for (const tour of fil.tours) {
    await ajouterTour(consultation, { role: tour.role, content: tour.content });
  }

  return NextResponse.json({ consultationId: consultation.id });
}
