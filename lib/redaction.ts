import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { rassemblerLesReferences, type CitationBrute, type Reference } from './citations';
import { consigneDuModele, type ModeleDocument } from './documents';
import { MAX_TOKENS, MODEL, SOCLE, blocsDuCorpus, client, poserLeCorpus } from './juriste';
import { domaine } from './domaines';
import { versRtf, type Bloc } from './rtf';

/**
 * La rédaction d'un document.
 *
 * ── Pourquoi ce n'est pas un modèle à trous ─────────────────────────────────
 * Un courrier type se reconnaît à dix mètres, ne colle jamais tout à fait à la
 * situation, et donne à celui qui l'envoie la fausse assurance d'avoir traité
 * son affaire. Ici le texte est écrit pour la situation décrite, à partir des
 * mentions obligatoires du modèle (lib/documents.ts) et des textes officiels
 * de la spécialité (lib/corpus.ts) — les mêmes que pour une réponse.
 *
 * ── Ce qui n'est jamais inventé ─────────────────────────────────────────────
 * Un prix, une date, un nom, un montant. Le modèle a l'ordre d'écrire
 * [PRIX DE VENTE] plutôt que de choisir une valeur, et la liste de ce qui reste
 * à compléter revient avec le courrier. Un courrier qui part avec une date
 * inventée est pire qu'un courrier non écrit : il a l'air valable.
 */

/** L'outil par lequel le document revient — structuré, donc affichable. */
const OUTIL_REDIGER: Anthropic.Tool = {
  name: 'rediger',
  description: [
    'Rends le courrier demandé, découpé en parties.',
    '',
    'Chaque mention obligatoire du modèle doit se retrouver dans le corps. Quand une',
    'information te manque pour en écrire une, écris un blanc en majuscules entre',
    'crochets — [PRIX DE VENTE], [DATE DE RÉCEPTION] — et reporte-la dans aVerifier.',
    'N’invente jamais un nom, une date, un montant ni une adresse.',
  ].join('\n'),
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['objet', 'corps', 'aVerifier'],
    properties: {
      objet: {
        type: 'string',
        description: 'La ligne d’objet, sans le mot « Objet ». Exemple : « congé pour vendre — logement sis 12 rue des Lilas ».',
      },
      corps: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Les paragraphes du courrier, de l’appel (« Madame, Monsieur, ») à la formule de politesse. Un élément par paragraphe, sans saut de ligne dedans.',
      },
      aVerifier: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Ce que la personne doit compléter ou vérifier avant d’envoyer : chaque blanc entre crochets, et chaque point qui dépend d’un document qu’elle seule a.',
      },
    },
  },
};

export interface DocumentRedige {
  modele: string;
  titre: string;
  objet: string;
  corps: string[];
  aVerifier: string[];
  /** Les articles cités par le courrier, lus dans le corpus. */
  references: Reference[];
  /** Le fichier prêt à ouvrir dans un traitement de texte. */
  rtf: string;
}

/** Ce que le modèle a renvoyé, ramené à quelque chose d'affichable. */
function lireLeDocument(brut: unknown): { objet: string; corps: string[]; aVerifier: string[] } | null {
  if (!brut || typeof brut !== 'object') return null;
  const entree = brut as { objet?: unknown; corps?: unknown; aVerifier?: unknown };

  const corps = Array.isArray(entree.corps)
    ? entree.corps.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
    : [];
  /* Un courrier sans corps n'est pas un courrier. Mieux vaut le dire que
     produire un fichier vide qui s'ouvrira chez quelqu'un. */
  if (corps.length === 0) return null;

  return {
    objet: typeof entree.objet === 'string' ? entree.objet.trim() : '',
    corps,
    aVerifier: Array.isArray(entree.aVerifier)
      ? entree.aVerifier.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
      : [],
  };
}

/** Le courrier, mis en page pour un traitement de texte. */
export function versFichier(modele: ModeleDocument, objet: string, corps: string[]): string {
  const blocs: Bloc[] = [{ type: 'titre', contenu: modele.titre.toUpperCase() }];
  if (objet) blocs.push({ type: 'objet', contenu: `Objet : ${objet}` });
  for (const paragraphe of corps) blocs.push({ type: 'texte', contenu: paragraphe });
  /* Le blanc de signature : un courrier qui part sans signature manuscrite ne
     vaut rien, et l'oubli est plus fréquent qu'on ne croit. */
  blocs.push({ type: 'signature', contenu: 'Signature' });
  return versRtf({ titre: modele.titre, blocs });
}

export async function redigerDocument(
  modele: ModeleDocument,
  situation: string,
): Promise<DocumentRedige> {
  const anthropic = await client();
  if (!anthropic) throw new Error('Aucune clé d’API n’est configurée.');

  const fiche = domaine(modele.domaine);
  const { blocs, plan } = await blocsDuCorpus(modele.domaine);

  const consigne = [
    'Tu rédiges un courrier juridique en français, pour quelqu’un qui va le signer et l’envoyer.',
    '',
    consigneDuModele(modele),
    '',
    `Spécialité de rattachement : ${fiche.label}.`,
    '',
    'FORME DU COURRIER',
    'Registre soutenu et sobre, phrases courtes, aucune menace inutile. Un courrier qui hausse le ton se fait moins bien recevoir qu’un courrier qui expose des faits datés.',
    'Commence par l’appel (« Madame, Monsieur, ») et finis par une formule de politesse. N’écris ni l’en-tête d’expéditeur, ni l’adresse du destinataire, ni la date : ils seront ajoutés par la personne, qui seule les connaît.',
    'Quand un texte joint fonde une obligation, cite-le dans le corps du courrier : c’est ce qui distingue une réclamation d’une lettre de mécontentement.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: [
      { type: 'text', text: SOCLE },
      { type: 'text', text: consigne, cache_control: { type: 'ephemeral' } },
    ],
    tools: [OUTIL_REDIGER],
    tool_choice: { type: 'auto' },
    messages: poserLeCorpus(
      [{ role: 'user', content: `Voici la situation :\n\n${situation}` }],
      blocs,
    ),
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Je ne peux pas rédiger ce document.');
  }

  const appel = response.content.find(
    (bloc): bloc is Anthropic.ToolUseBlock => bloc.type === 'tool_use' && bloc.name === 'rediger',
  );
  const document = appel ? lireLeDocument(appel.input) : null;
  if (!document) {
    throw new Error('Le courrier n’a pas pu être rédigé. Reformulez la situation en précisant les faits et les dates.');
  }

  const references = plan
    ? rassemblerLesReferences(
        response.content
          .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
          .flatMap((bloc) => (bloc.citations ?? []) as CitationBrute[]),
        plan,
      )
    : [];

  return {
    modele: modele.id,
    titre: modele.titre,
    objet: document.objet,
    corps: document.corps,
    aVerifier: document.aVerifier,
    references,
    rtf: versFichier(modele, document.objet, document.corps),
  };
}
