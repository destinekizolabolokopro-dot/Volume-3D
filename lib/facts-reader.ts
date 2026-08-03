import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { parseFactAnswers, visualQuestions } from './facts';
import type { PropertyFact } from './types';

/**
 * Pré-remplissage de la fiche à partir des photos.
 *
 * Le modèle ne répond qu'aux questions dont la réponse **se voit** : meublé ou
 * non, douche ou baignoire, présence d'un lave-linge. Il n'a pas à deviner
 * l'adresse ni les écoles du quartier — ces informations ne sont pas sur les
 * photos, et une réponse inventée se retournerait contre l'annonce.
 *
 * Tout ce qui sort d'ici est marqué `source: 'ia'`. C'est ce qui garantit que
 * ces réponses passent devant le propriétaire avant d'atteindre un voyageur :
 * `factsForAssistant` et `factsForDescription` les ignorent tant qu'elles ne
 * sont pas confirmées.
 */

const MODEL = 'claude-opus-5';

export function isFactsReaderConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface PhotoForReading {
  id: string;
  caption: string;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

const TOOL = {
  name: 'remplir_fiche',
  description: 'Répond aux questions dont la réponse est visible sur les photos fournies.',
  input_schema: {
    type: 'object' as const,
    properties: {
      answers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Clé de la question.' },
            value: {
              type: 'string',
              description:
                'Réponse. Pour une question à choix, reprendre exactement l’une des options. Pour un choix multiple, séparer par des virgules.',
            },
          },
          required: ['key', 'value'],
        },
      },
      /** Ce que les photos ne permettent pas de trancher. */
      unsure: { type: 'array', items: { type: 'string' } },
    },
    required: ['answers', 'unsure'],
  },
};

const SYSTEM = [
  'Tu remplis une fiche de logement à partir de ses photos, pour une annonce de location courte durée.',
  '',
  'Règles absolues :',
  '— Ne réponds qu’à ce que tu vois réellement sur les photos. Une pièce non photographiée ne prouve rien.',
  '— Si tu hésites, ne réponds pas : mets la clé dans `unsure`. Une case vide se corrige en un clic, une réponse fausse se découvre à l’arrivée du voyageur.',
  '— Pour les questions à choix, reprends exactement l’une des options proposées.',
  '— Ne déduis jamais un équipement de l’absence d’un autre, ni du standing apparent du logement.',
].join('\n');

/** Décrit les questions visuelles au modèle, avec leurs options. */
function askable(): string {
  return visualQuestions()
    .map((question) => {
      const options = question.options ? ` Options : ${question.options.join(' | ')}.` : '';
      return `— ${question.key} : ${question.label}${options}`;
    })
    .join('\n');
}

/** Envoie les photos et rend les réponses lisibles dessus. */
export async function readFactsFromPhotos(photos: PhotoForReading[]): Promise<PropertyFact[]> {
  if (!isFactsReaderConfigured() || photos.length === 0) return [];

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    // Reconnaître un lave-vaisselle ou compter des fenêtres ne demande pas de
    // longue réflexion, mais il faut regarder chaque photo avec attention.
    output_config: { effort: 'medium' },
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Questions auxquelles répondre :\n${askable()}` },
          ...photos.flatMap((photo) => [
            { type: 'text' as const, text: photo.caption ? `Photo « ${photo.caption} » :` : 'Photo :' },
            {
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: photo.mediaType, data: photo.base64 },
            },
          ]),
        ],
      },
    ],
  });

  // Un refus revient en HTTP 200 : il se lit sur stop_reason, avant le contenu.
  if (response.stop_reason === 'refusal') return [];

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === TOOL.name,
  );
  return call ? parseFactAnswers(call.input) : [];
}


/** Réexport pour que l'appelant n'ait qu'un module à connaître. */
export { parseFactAnswers } from './facts';
