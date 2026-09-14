import { NextResponse } from 'next/server';
import { compteCourant } from '@/lib/comptes';
import { exporterLeCompte } from '@/lib/donnees';

/**
 * L'export de ses propres données, en un fichier.
 *
 * Une route plutôt qu'une action de formulaire : l'article 20 demande un
 * fichier lisible par machine, et un fichier se télécharge — il ne se rend pas
 * dans une page. L'en-tête `Content-Disposition` fait le reste.
 *
 * La session décide, et rien d'autre : il n'y a pas d'identifiant dans
 * l'adresse, donc rien à modifier pour tenter d'emporter le dossier de
 * quelqu'un d'autre.
 */
export async function GET() {
  const compte = await compteCourant();
  if (!compte) {
    return NextResponse.json({ erreur: 'Aucune session.' }, { status: 401 });
  }

  const contenu = await exporterLeCompte(compte);
  const jour = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(contenu, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="immolex-mes-donnees-${jour}.json"`,
      /* Un export ne se met jamais en cache : il contient tout le dossier. */
      'Cache-Control': 'no-store',
    },
  });
}
