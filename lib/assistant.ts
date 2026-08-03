import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { factsForAssistant } from './facts';
import type { Chapter, Photo, Property, Scene } from './types';

/**
 * Assistant de la page de visite.
 *
 * Il répond aux questions des voyageurs sur un logement précis, et uniquement
 * à partir des informations que le propriétaire a renseignées. Il n'invente
 * rien : une information absente doit être annoncée comme absente, pas
 * devinée — un voyageur qui réserve sur une réponse fausse se retourne contre
 * l'annonce.
 */

const MODEL = 'claude-opus-5';

export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface AssistantContext {
  property: Property;
  scenes: Scene[];
  chapters: Chapter[];
  photos: Photo[];
}

/** Fiche transmise au modèle. Uniquement du contenu saisi par le propriétaire. */
function describeProperty({ property, scenes, chapters, photos }: AssistantContext): string {
  const lines = [`Nom du logement : ${property.name}`];
  if (property.city) lines.push(`Ville : ${property.city}`);
  if (property.description) lines.push(`\nDescription rédigée par le propriétaire :\n${property.description}`);
  if (scenes.length > 0) {
    lines.push(`\nPièces visitables en 360° : ${scenes.map((scene) => scene.name).join(', ')}`);
  }
  if (chapters.length > 0) {
    lines.push(`Étapes de la vidéo : ${chapters.map((chapter) => chapter.label).join(', ')}`);
  }
  const captions = photos.map((photo) => photo.caption).filter(Boolean);
  if (captions.length > 0) lines.push(`Photos disponibles : ${captions.join(', ')}`);

  /* La fiche de renseignements est la principale source de l'assistant : c'est
     là que se trouvent le nombre de couchages, les équipements, le quartier.
     `factsForAssistant` n'y met que les réponses confirmées par le
     propriétaire — jamais les suppositions de la lecture automatique. */
  const facts = factsForAssistant(property.facts ?? []);
  if (facts) lines.push(`\nRenseignements confirmés par le propriétaire :\n${facts}`);

  return lines.join('\n');
}

const SYSTEM = [
  "Tu es l'assistant d'une visite virtuelle de logement en location saisonnière.",
  'Tu réponds aux questions des voyageurs qui envisagent de réserver.',
  '',
  'Règles absolues :',
  "— Ne réponds qu'à partir de la fiche ci-dessous. Tu n'as aucune autre source.",
  "— Si l'information ne s'y trouve pas, dis-le simplement et invite le voyageur à poser la question au propriétaire. N'invente jamais une surface, un équipement, un prix, une adresse ni une disponibilité.",
  '— Ne devine pas à partir du nom des pièces : « Chambre 2 » ne prouve pas qu\'il y a deux lits.',
  "— Tu ne peux ni réserver, ni modifier une réservation, ni transmettre un message.",
  '',
  'Style : deux à quatre phrases, en français, ton simple et chaleureux. Pas de listes à puces sauf énumération réelle.',
].join('\n');

export interface AssistantReply {
  answer: string;
  /** Vrai si le modèle a refusé de répondre. */
  refused: boolean;
}

/**
 * Pose la question au modèle. La conversation est fournie entière : l'API est
 * sans état, et le contexte tient largement dans une fenêtre.
 */
export async function askAssistant(
  context: AssistantContext,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<AssistantReply> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // Réponses courtes sur un contexte court : l'effort minimal suffit et
    // garde la latence acceptable pour un voyageur qui attend devant sa visite.
    output_config: { effort: 'low' },
    system: [
      { type: 'text', text: SYSTEM },
      {
        type: 'text',
        text: `Fiche du logement :\n${describeProperty(context)}`,
        // La fiche est stable d'une question à l'autre : on la met en cache
        // pour ne pas la refacturer à chaque message du voyageur.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: history.map((entry) => ({ role: entry.role, content: entry.content })),
  });

  // Un refus revient en HTTP 200 : il faut le lire sur stop_reason avant de
  // toucher au contenu, qui peut être vide.
  if (response.stop_reason === 'refusal') {
    return {
      answer: "Je ne peux pas répondre à cette question. Posez-la directement au propriétaire.",
      refused: true,
    };
  }

  const answer = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return {
    answer: answer || "Je n'ai pas d'information sur ce point. Le propriétaire pourra vous répondre.",
    refused: false,
  };
}
