import { NextResponse } from 'next/server';
import { formuleDuCompte } from '@/lib/abonnements';
import { cadence, origine } from '@/lib/cadence';
import { compteCourant } from '@/lib/comptes';
import { noterDocument, questionsDuMois } from '@/lib/consultations';
import { modeleOuNull } from '@/lib/documents';
import { estJuristeConfigure } from '@/lib/juriste';
import { redigerDocument } from '@/lib/redaction';
import { ValidationError, text } from '@/lib/validation';

/**
 * La rédaction d'un document.
 *
 * Elle demande un COMPTE, contrairement à une question. Ce n'est pas une
 * barrière commerciale : un courrier de congé ou une mise en demeure est un
 * acte qui produit des effets, et l'écrire coûte plus au modèle qu'une réponse.
 * Le compte gratuit suffit, et l'écran le dit.
 *
 * Rien de ce qui est écrit ici n'est conservé : le courrier repart dans la
 * réponse et n'existe plus ensuite côté serveur. Une mise en demeure pour
 * loyers impayés nomme des gens et raconte une histoire ; il n'y a aucune
 * raison d'en garder une copie.
 */

const FREIN = cadence(4, 60_000);
/** Un courrier vaut une question au compteur : il coûte au moins autant. */
const MAX_SITUATION = 4000;

export async function POST(request: Request) {
  try {
    if (FREIN.depasse(origine(request))) {
      return NextResponse.json(
        { error: 'Trop de demandes coup sur coup. Réessayez dans une minute.' },
        { status: 429 },
      );
    }

    if (!(await estJuristeConfigure())) {
      return NextResponse.json(
        { error: 'L’assistant n’est pas configuré sur ce site (clé ANTHROPIC_API_KEY manquante).' },
        { status: 503 },
      );
    }

    const compte = await compteCourant();
    if (!compte) {
      return NextResponse.json(
        {
          error:
            'La rédaction d’un document demande un compte : un courrier de congé ou une mise en demeure produit des effets, et il doit être rattaché à quelqu’un. La création de compte est gratuite.',
          abonnement: true,
        },
        { status: 402 },
      );
    }

    const corps = (await request.json()) as { modele?: unknown; situation?: unknown };
    const modele = modeleOuNull(String(corps.modele ?? ''));
    if (!modele) {
      return NextResponse.json({ error: 'Modèle de document inconnu.' }, { status: 400 });
    }

    const situation = text(corps.situation, 'situation', { max: MAX_SITUATION });

    const formule = formuleDuCompte(compte.abonnement);
    if (Number.isFinite(formule.quota)) {
      const posees = await questionsDuMois(compte.id);
      if (posees >= formule.quota) {
        return NextResponse.json(
          {
            error: `Vous avez atteint les ${formule.quota} questions de la formule ${formule.nom} ce mois-ci. Un document compte pour une question.`,
            abonnement: true,
          },
          { status: 402 },
        );
      }
    }

    const document = await redigerDocument(modele, situation);

    /* Le courrier est décompté MAINTENANT, une fois rendu. Le quota était
       lu plus haut mais rien n'était jamais écrit : la phrase « un document
       compte pour une question » était donc fausse, et la rédaction — l'appel
       le plus cher du service — restait gratuite sans limite. Ce qui est noté
       tient en trois champs, et pas le courrier : voir lib/types.ts.

       L'échec de cette écriture ne perd pas le courrier déjà rédigé : on le
       rend, et le mois compte une unité de moins. */
    try {
      await noterDocument(compte.id, modele.id);
    } catch (cause) {
      console.error('[document] décompte non enregistré', cause);
    }

    return NextResponse.json(document);
  } catch (cause) {
    if (cause instanceof ValidationError) {
      return NextResponse.json({ error: cause.message }, { status: 400 });
    }
    console.error('[document] rédaction en échec', cause);
    return NextResponse.json(
      { error: 'Le document n’a pas pu être rédigé. Réessayez dans un instant.' },
      { status: 500 },
    );
  }
}
