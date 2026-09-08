/**
 * Les pièces déposées : contrat, bail, mise en demeure, arrêté, ordonnance.
 *
 * ── Ce fichier ne stocke rien, et c'est le point important ──────────────────
 * Une pièce est lue en mémoire, envoyée au modèle avec la question, puis
 * oubliée. Elle n'est écrite ni sur le disque, ni dans le bucket, ni dans la
 * base. Ce qui reste de la consultation, c'est le nom du fichier et la réponse
 * — pas le contrat de travail ni l'acte de naissance.
 *
 * C'est un choix, pas un oubli. Les documents qu'on dépose ici sont parmi les
 * plus sensibles qu'une personne possède ; les conserver imposerait un
 * chiffrement, une durée de rétention, une procédure d'effacement et une
 * réponse claire en cas de fuite. Ne pas les conserver répond à tout cela
 * d'un coup. Le prix à payer est qu'une pièce doit être redéposée pour être
 * relue plus tard : il est assumé.
 */

/** Huit mégaoctets : un bail scanné en fait deux, un dossier complet rarement plus. */
export const MAX_PIECE_BYTES = 8 * 1024 * 1024;

const PDF = 'application/pdf';
const TEXTES = new Set(['text/plain', 'text/markdown', 'text/csv']);
const IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type NaturePiece = 'pdf' | 'texte' | 'image';

/** Une pièce lue, prête à être jointe à la question. Jamais persistée. */
export interface Piece {
  nom: string;
  nature: NaturePiece;
  /** Type MIME d'origine — l'API exige le vrai type pour les images. */
  type: string;
  /** Base64 pour un PDF ou une image, texte brut pour un fichier texte. */
  donnees: string;
  octets: number;
}

export class PieceRefusee extends Error {}

function nature(type: string): NaturePiece | null {
  if (type === PDF) return 'pdf';
  if (TEXTES.has(type)) return 'texte';
  if (IMAGES.has(type)) return 'image';
  return null;
}

/**
 * Lit le fichier envoyé, ou refuse en expliquant pourquoi. Les messages sont
 * écrits pour être affichés tels quels : « format non supporté » sans dire
 * lesquels le sont ne sert personne.
 */
export async function lirePiece(file: File): Promise<Piece> {
  const genre = nature(file.type);
  if (!genre) {
    throw new PieceRefusee(
      `Ce format n’est pas lisible (${file.type || 'type inconnu'}). Déposez un PDF, une photo du document (JPEG, PNG, WebP) ou un fichier texte.`,
    );
  }
  if (file.size === 0) throw new PieceRefusee('Ce fichier est vide.');
  if (file.size > MAX_PIECE_BYTES) {
    throw new PieceRefusee(
      `Ce fichier est trop lourd (${Math.round(file.size / 1024 / 1024)} Mo). Maximum ${MAX_PIECE_BYTES / 1024 / 1024} Mo — pour un document scanné, réduisez la résolution ou n’envoyez que les pages utiles.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    nom: file.name.slice(0, 120) || 'document',
    nature: genre,
    type: file.type,
    donnees: genre === 'texte' ? buffer.toString('utf8') : buffer.toString('base64'),
    octets: file.size,
  };
}
