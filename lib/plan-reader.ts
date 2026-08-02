import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { PlanError, parseAssignments, parsePlanReading } from './plan';
import type { PlanRoom } from './types';

/**
 * Lecture automatique d'un plan de logement.
 *
 * Le modèle ne dessine rien et n'imagine rien : il *relève*. On lui donne
 * l'image du plan, il rend les contours des pièces et la position des
 * ouvertures, en mètres. C'est la seule information qu'une photo ne contient
 * pas et qu'un plan contient — d'où l'intérêt de demander les deux.
 *
 * Trois garde-fous, parce qu'une lecture automatique se trompe :
 *  1. le modèle rend du JSON strict, validé ici avant toute utilisation ;
 *  2. la géométrie passe par `assertPlanIsUsable`, qui refuse l'aberrant ;
 *  3. le résultat est marqué non confirmé, et n'est publié qu'après relecture
 *     par le propriétaire.
 */

const MODEL = 'claude-opus-5';

export function isPlanReaderConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type { PhotoAssignment, PlanReading } from './plan';
export { parseAssignments, parsePlanReading } from './plan';

const SYSTEM = [
  "Tu relèves des plans d'appartements et de maisons. Tu ne dessines rien, tu ne complètes rien : tu transcris ce qui est visible sur l'image, et rien d'autre.",
  '',
  'Repère : origine en haut à gauche de l’image, x vers la droite, y vers le bas, unité le mètre.',
  '',
  'Règles :',
  '— Une pièce = un polygone fermé, sommets dans l’ordre du contour. Les pièces voisines partagent leurs sommets de mur : leurs contours doivent coïncider, sans recouvrement ni vide entre elles.',
  '— Déduis l’échelle des cotes écrites sur le plan. Si aucune cote n’est lisible, prends des dimensions plausibles : une porte fait 0,80 m à 0,90 m de large, un couloir 0,90 m à 1,20 m.',
  '— Une ouverture est un segment posé exactement sur le mur qu’elle perce, avec les mêmes coordonnées que ce mur.',
  '— `from` et `to` sont des identifiants de pièces. Une ouverture vers l’extérieur ou vers le palier a `to` vide. Une fenêtre a toujours `to` vide.',
  '— N’invente aucune pièce qui ne figure pas sur le plan. Ne fusionne pas deux pièces séparées par une cloison.',
  '— Si le document n’est pas un plan de logement, rends `rooms` vide et explique pourquoi dans `note`.',
  '',
  'Identifiants : minuscules, sans accent ni espace (« sejour », « chambre-1 », « salle-eau »). Noms : en français, tels qu’écrits sur le plan.',
].join('\n');

/** Contrat de sortie. Le modèle n'a pas le droit d'en dévier. */
const SHAPE = {
  name: 'releve_de_plan',
  description: 'Contours des pièces et position des ouvertures, relevés sur le plan fourni.',
  input_schema: {
    type: 'object' as const,
    properties: {
      rooms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Identifiant court, minuscules sans accent.' },
            name: { type: 'string', description: 'Nom lisible, en français.' },
            height: { type: 'number', description: 'Hauteur sous plafond en mètres. 2,5 si non indiquée.' },
            points: {
              type: 'array',
              description: 'Contour fermé de la pièce, en mètres.',
              items: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' } },
                required: ['x', 'y'],
              },
            },
          },
          required: ['id', 'name', 'height', 'points'],
        },
      },
      doors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string', description: 'Vide si l’ouverture donne sur l’extérieur ou le palier.' },
            kind: { type: 'string', enum: ['door', 'opening', 'window'] },
            height: { type: 'number', description: 'Hauteur du linteau au-dessus du sol, en mètres.' },
            sill: { type: 'number', description: 'Hauteur d’allège. 0 pour une porte.' },
            a: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } },
              required: ['x', 'y'],
            },
            b: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } },
              required: ['x', 'y'],
            },
          },
          required: ['from', 'to', 'kind', 'height', 'sill', 'a', 'b'],
        },
      },
      note: { type: 'string', description: 'Ce qui a gêné la lecture, ou pourquoi le relevé est vide.' },
    },
    required: ['rooms', 'doors', 'note'],
  },
};

/* ----------------------------------------------------------------- appel */

export interface ReadPlanInput {
  /** Image du plan, encodée en base64, sans préfixe `data:`. */
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Surface annoncée par le propriétaire, en m². Sert de mètre étalon. */
  declaredArea: number;
  /** Précisions du propriétaire : « la petite pièce du fond est un cellier ». */
  hint?: string;
}

/**
 * Envoie le plan au modèle et rend la géométrie relevée.
 *
 * L'outil est imposé (`tool_choice`), donc la réponse est structurée par
 * construction : pas de JSON à extraire d'un texte, pas de format à deviner.
 */
export async function readPlan(input: ReadPlanInput): Promise<import('./plan').PlanReading> {
  if (!isPlanReaderConfigured()) {
    throw new PlanError('La lecture automatique de plan n’est pas configurée (ANTHROPIC_API_KEY manquante).');
  }

  const client = new Anthropic();
  const context = [
    `Surface totale annoncée par le propriétaire : ${input.declaredArea} m².`,
    input.hint ? `Précisions du propriétaire : ${input.hint}` : '',
    'Relève ce plan.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    // Relever un plan demande de compter, de comparer des cotes et de refermer
    // des polygones : c'est du raisonnement, pas de la reformulation.
    output_config: { effort: 'high' },
    system: SYSTEM,
    tools: [SHAPE],
    tool_choice: { type: 'tool', name: SHAPE.name },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.imageBase64 } },
          { type: 'text', text: context },
        ],
      },
    ],
  });

  // Un refus arrive en HTTP 200 : il se lit sur stop_reason, avant le contenu.
  if (response.stop_reason === 'refusal') {
    throw new PlanError('Le modèle a refusé de traiter ce document.');
  }

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === SHAPE.name,
  );
  if (!call) throw new PlanError('Le modèle n’a pas rendu de relevé exploitable.');

  return parsePlanReading(call.input, input.declaredArea, MODEL);
}

/* ------------------------------------------- rattachement des photos --- */

const ASSIGN = {
  name: 'rattacher_photos',
  description: 'Associe chaque photo à la pièce du plan qu’elle montre, et au mur qui lui fait face.',
  input_schema: {
    type: 'object' as const,
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            photoId: { type: 'string' },
            roomId: { type: 'string', description: 'Vide si la photo ne correspond à aucune pièce du plan.' },
            wallIndex: {
              type: 'number',
              description: 'Index du mur dans le contour de la pièce, en partant de 0.',
            },
          },
          required: ['photoId', 'roomId', 'wallIndex'],
        },
      },
    },
    required: ['assignments'],
  },
};

/**
 * Range les photos du propriétaire dans les pièces du plan.
 *
 * Le modèle voit les photos et la liste des pièces relevées ; il dit laquelle
 * montre quoi. Une photo qu'il ne sait pas rattacher reste sans pièce plutôt
 * que d'être placée au hasard — une photo de cuisine accrochée dans la chambre
 * décrédibiliserait toute la visite.
 */
export async function assignPhotos(
  rooms: PlanRoom[],
  photos: { id: string; url: string; caption: string; base64: string; mediaType: ReadPlanInput['mediaType'] }[],
): Promise<import('./plan').PhotoAssignment[]> {
  if (!isPlanReaderConfigured()) throw new PlanError('Lecture automatique non configurée.');
  if (photos.length === 0) return [];

  const client = new Anthropic();
  const inventory = rooms
    .map((room) => `— ${room.id} (« ${room.name} »), ${room.points.length} murs numérotés de 0 à ${room.points.length - 1}`)
    .join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'medium' },
    system: [
      'Tu ranges des photos d’un logement dans les pièces relevées sur son plan.',
      'Si une photo ne correspond à aucune pièce de la liste, laisse `roomId` vide. Ne devine pas.',
      'Le mur choisi est celui que la photo a dans le dos : c’est là qu’on l’accrochera pour qu’elle regarde la pièce.',
    ].join('\n'),
    tools: [ASSIGN],
    tool_choice: { type: 'tool', name: ASSIGN.name },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Pièces du plan :\n${inventory}` },
          ...photos.flatMap((photo) => [
            { type: 'text' as const, text: `Photo ${photo.id}${photo.caption ? ` — « ${photo.caption} »` : ''} :` },
            {
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: photo.mediaType, data: photo.base64 },
            },
          ]),
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new PlanError('Le modèle a refusé de traiter ces photos.');

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === ASSIGN.name,
  );
  if (!call) return [];

  return parseAssignments(call.input, rooms, photos.map((photo) => photo.id));
}

