import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/accounts';
import { cadence, origine } from '@/lib/cadence';
import {
  ajouterTour,
  consultationDuCompte,
  ouvrirConsultation,
  toursDeConsultation,
} from '@/lib/consultations';
import { domaine as ficheDomaine, estDomaineId, type DomaineId } from '@/lib/domaines';
import { estJuristeConfigure, orienter, repondre, type Echange } from '@/lib/juriste';
import { PieceRefusee, lirePiece, type Piece } from '@/lib/piece';
import { ValidationError, text } from '@/lib/validation';

/**
 * Une question posée à un spécialiste, et sa réponse.
 *
 * La route accepte deux formes : du JSON quand il n'y a que du texte, et du
 * multipart quand un document est joint. Le document n'est jamais écrit — il
 * traverse la mémoire du serveur le temps de l'appel au modèle, et seul son
 * nom subsiste dans le fil (voir lib/piece.ts).
 *
 * Le fil est reconstruit depuis la base dès que la personne est connectée, et
 * jamais depuis ce que le navigateur envoie : sans quoi il suffirait de
 * réécrire les réponses précédentes dans la requête pour faire dire au
 * spécialiste qu'il a déjà validé n'importe quoi.
 *
 * La spécialité peut être omise. C'est le cas normal depuis l'accueil, où la
 * personne écrit sans avoir rien choisi : le serveur aiguille alors lui-même
 * et renvoie, avec la réponse, le spécialiste retenu et les autres pistes.
 * Faire aiguiller le navigateur en deux requêtes coûterait un aller-retour de
 * plus au moment précis où quelqu'un attend devant un écran vide.
 */

const FREIN = cadence(8, 60_000);
/** Une consultation qui dépasse ça n'est plus une question mais un dossier. */
const MAX_TOURS = 24;
const MAX_CARACTERES = 6000;

function nettoyer(echanges: unknown): Echange[] {
  if (!Array.isArray(echanges)) return [];
  return echanges
    .slice(-MAX_TOURS)
    .map((entree) => entree as { role?: unknown; content?: unknown })
    .filter((entree) => entree.role === 'user' || entree.role === 'assistant')
    .map((entree) => ({
      role: entree.role as 'user' | 'assistant',
      content: String(entree.content ?? '').slice(0, MAX_CARACTERES),
    }))
    .filter((echange) => echange.content.length > 0);
}

interface Demande {
  /** Vide quand la personne n'a rien choisi : le serveur aiguille alors. */
  domaine: DomaineId | '';
  question: string;
  consultationId: string;
  historique: Echange[];
  piece: Piece | null;
}

async function lireDemande(request: Request): Promise<Demande> {
  const type = request.headers.get('content-type') ?? '';

  if (type.includes('multipart/form-data')) {
    const form = await request.formData();
    const fichier = form.get('piece');
    const brut = form.get('historique');
    return {
      domaine: domaineDe(form.get('domaine')),
      question: text(form.get('question'), 'question', { max: MAX_CARACTERES }),
      consultationId: text(form.get('consultationId'), 'consultation', { max: 40, required: false }),
      historique: nettoyer(typeof brut === 'string' ? JSON.parse(brut) : []),
      piece: fichier instanceof File ? await lirePiece(fichier) : null,
    };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return {
    domaine: domaineDe(body.domaine),
    question: text(body.question, 'question', { max: MAX_CARACTERES }),
    consultationId: text(body.consultationId, 'consultation', { max: 40, required: false }),
    historique: nettoyer(body.historique),
    piece: null,
  };
}

function domaineDe(value: unknown): DomaineId | '' {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) return '';
  if (!estDomaineId(id)) throw new ValidationError('Cette spécialité n’existe pas.');
  return id;
}

/**
 * Réponse donnée quand l'aiguillage ne reconnaît rien. Elle est écrite ici et
 * non demandée au modèle : sans spécialité, il n'y a pas de consigne à lui
 * donner, et un modèle sans périmètre est exactement ce que cette zone
 * s'interdit.
 */
const SANS_PISTE = [
  'Je n’ai pas reconnu de spécialité dans votre question, et je préfère vous le dire plutôt que de répondre au hasard.',
  '',
  'Précisez ce qui s’est passé et avec qui — un locataire, un voyageur, le syndic, un artisan, la mairie, un acquéreur, un assureur — ou choisissez une spécialité dans la liste.',
  '',
  'Cet assistant ne traite que le droit immobilier : une question de travail, de famille ou de succession n’y trouvera pas de réponse.',
].join('\n');

export async function POST(request: Request) {
  try {
    if (!estJuristeConfigure()) {
      return NextResponse.json(
        { error: 'L’assistant n’est pas configuré sur ce site (clé ANTHROPIC_API_KEY manquante).' },
        { status: 503 },
      );
    }
    if (FREIN.depasse(origine(request))) {
      return NextResponse.json(
        { error: 'Trop de questions d’affilée. Patientez une minute.' },
        { status: 429 },
      );
    }

    const demande = await lireDemande(request);
    const account = await currentAccount();

    /* Le fil de référence : la base si la personne est connectée et que la
       consultation lui appartient, sinon ce que le navigateur a gardé. */
    let consultation = account && demande.consultationId
      ? await consultationDuCompte(demande.consultationId, account.id)
      : null;

    if (account && demande.consultationId && !consultation) {
      return NextResponse.json({ error: 'Consultation introuvable.' }, { status: 404 });
    }

    let historique: Echange[] = demande.historique;
    if (consultation) {
      const tours = await toursDeConsultation(consultation.id);
      historique = tours.slice(-MAX_TOURS).map((tour) => ({
        role: tour.role === 'assistant' ? 'assistant' : 'user',
        content: tour.content,
      }));
      /* La spécialité est celle du fil, pas celle que la requête annonce : un
         fil ouvert en droit du travail ne devient pas pénal en cours de route. */
      if (estDomaineId(consultation.domaine)) demande.domaine = consultation.domaine;
    }

    historique = [...historique, { role: 'user', content: demande.question }];

    /* Aiguillage côté serveur quand la personne n'a rien choisi : les mots
       d'abord, un modèle seulement s'ils hésitent (voir lib/juriste.ts). Les
       autres pistes repartent avec la réponse, pour que la page puisse
       proposer de changer de spécialiste sans reposer la question. */
    let pistes: { id: DomaineId; label: string; resume: string }[] = [];
    if (!demande.domaine) {
      const orientation = await orienter(demande.question);
      pistes = orientation.pistes
        .filter((piste) => piste.id !== orientation.domaine)
        .slice(0, 2)
        .map((piste) => ({
          id: piste.id,
          label: ficheDomaine(piste.id).label,
          resume: ficheDomaine(piste.id).resume,
        }));

      if (!orientation.domaine) {
        /* Rien de reconnu : on répond nous-mêmes, sans modèle. Le fil n'est pas
           enregistré non plus — il n'y a pas de consultation à ouvrir tant
           qu'aucun spécialiste n'a été saisi. */
        return NextResponse.json({
          reponse: SANS_PISTE,
          refus: false,
          domaine: '',
          label: '',
          pistes: [],
          consultationId: demande.consultationId,
          piece: demande.piece?.nom ?? '',
        });
      }
      demande.domaine = orientation.domaine;
    }

    const reponse = await repondre(demande.domaine, historique, demande.piece);

    if (account) {
      if (!consultation) {
        consultation = await ouvrirConsultation(account.id, demande.domaine, demande.question);
      }
      await ajouterTour(consultation, {
        role: 'user',
        content: demande.question,
        piece: demande.piece?.nom ?? '',
      });
      await ajouterTour(consultation, { role: 'assistant', content: reponse.texte });
    }

    return NextResponse.json({
      reponse: reponse.texte,
      refus: reponse.refus,
      domaine: demande.domaine,
      label: ficheDomaine(demande.domaine).label,
      pistes,
      consultationId: consultation?.id ?? '',
      /* Le nom du fichier est renvoyé pour que la page l'affiche dans le fil ;
         il n'y a rien d'autre à en garder. */
      piece: demande.piece?.nom ?? '',
    });
  } catch (cause) {
    if (cause instanceof PieceRefusee || cause instanceof ValidationError) {
      return NextResponse.json({ error: cause.message }, { status: 400 });
    }
    console.error('consultation', cause);
    return NextResponse.json(
      { error: 'La réponse n’a pas pu être produite. Réessayez dans un instant.' },
      { status: 500 },
    );
  }
}
