import type { PropertyFact } from './types';

/**
 * Fiche de renseignements d'un logement.
 *
 * Elle sert deux choses : rédiger la présentation publique, et donner à
 * l'assistant de quoi répondre aux voyageurs. Les deux ont le même besoin —
 * des faits vérifiés, jamais devinés.
 *
 * D'où la distinction centrale de ce module : ce que **l'IA peut voir sur une
 * photo** (meublé ou non, douche ou baignoire, présence d'un lave-linge) et ce
 * qu'elle **ne peut pas savoir** (l'adresse, les écoles du quartier, le prix du
 * ménage). Le premier groupe est pré-rempli et soumis à confirmation ; le
 * second est demandé au propriétaire. Une réponse d'IA non confirmée n'est
 * jamais servie à un voyageur.
 */

export type FactKind = 'text' | 'choice' | 'multi';

export interface FactQuestion {
  key: string;
  /** Question telle qu'elle est posée au propriétaire. */
  label: string;
  kind: FactKind;
  options?: string[];
  /** Vrai si la réponse se lit sur une photo du logement. */
  visual: boolean;
  /** Sans cette réponse, la fiche reste incomplète. */
  required: boolean;
  /** Précision affichée sous la question. */
  help?: string;
}

/**
 * Catalogue des questions.
 *
 * L'ordre est celui dans lequel on les pose : d'abord ce qui se voit et se
 * confirme en un clic, ensuite ce qui demande de réfléchir.
 */
export const FACT_QUESTIONS: FactQuestion[] = [
  {
    key: 'meuble',
    label: 'Le logement est-il meublé ?',
    kind: 'choice',
    options: ['Entièrement meublé', 'Partiellement meublé', 'Non meublé'],
    visual: true,
    required: true,
  },
  {
    key: 'couchages',
    label: 'Combien de personnes peuvent dormir ?',
    kind: 'text',
    visual: false,
    required: true,
    help: 'Comptez les lits, pas les places assises.',
  },
  {
    key: 'salle-eau',
    label: 'Douche, baignoire, ou les deux ?',
    kind: 'choice',
    options: ['Douche', 'Baignoire', 'Les deux'],
    visual: true,
    required: false,
  },
  {
    key: 'equipements',
    label: 'Quels équipements sont présents ?',
    kind: 'multi',
    options: [
      'Lave-linge',
      'Lave-vaisselle',
      'Four',
      'Micro-ondes',
      'Télévision',
      'Wi-Fi',
      'Climatisation',
      'Balcon ou terrasse',
      'Ascenseur',
      'Parking',
    ],
    visual: true,
    required: false,
  },
  {
    key: 'exposition',
    label: 'Comment est la lumière ?',
    kind: 'choice',
    options: ['Très lumineux', 'Lumineux', 'Lumière douce'],
    visual: true,
    required: false,
  },
  {
    key: 'adresse',
    label: 'Où se trouve le logement ?',
    kind: 'text',
    visual: false,
    required: true,
    help: 'Quartier et ville suffisent. L’adresse exacte n’est jamais affichée publiquement.',
  },
  {
    key: 'etage',
    label: 'À quel étage, et y a-t-il un ascenseur ?',
    kind: 'text',
    visual: false,
    required: false,
  },
  {
    key: 'proximite',
    label: 'Qu’y a-t-il à moins de dix minutes à pied ?',
    kind: 'text',
    visual: false,
    required: true,
    help: 'Commerces, transports, écoles, plage, centre-ville — ce que vous citeriez à un ami.',
  },
  {
    key: 'public',
    label: 'À qui s’adresse le logement ?',
    kind: 'multi',
    options: ['Couples', 'Familles', 'Voyageurs d’affaires', 'Groupes d’amis', 'Séjours longs'],
    visual: false,
    required: false,
  },
  {
    key: 'particularites',
    label: 'Qu’est-ce qui rend ce logement différent des autres ?',
    kind: 'text',
    visual: false,
    required: false,
    help: 'La vue, le calme, une cheminée, un jardin — ce qu’une photo ne raconte pas.',
  },
];

const BY_KEY = new Map(FACT_QUESTIONS.map((question) => [question.key, question]));

export const findQuestion = (key: string): FactQuestion | undefined => BY_KEY.get(key);

/** Les questions auxquelles une photo peut répondre. */
export const visualQuestions = (): FactQuestion[] => FACT_QUESTIONS.filter((question) => question.visual);

/**
 * Fusionne un lot de réponses dans la fiche existante.
 *
 * Règle d'arbitrage : **le propriétaire l'emporte toujours sur l'IA**. Une
 * réponse humaine ne peut pas être écrasée par une lecture automatique, même
 * postérieure — c'est lui qui connaît son logement.
 */
export function mergeFacts(existing: PropertyFact[], incoming: PropertyFact[]): PropertyFact[] {
  const merged = new Map(existing.map((fact) => [fact.key, fact]));
  for (const fact of incoming) {
    if (!BY_KEY.has(fact.key)) continue;
    const current = merged.get(fact.key);
    if (current?.source === 'proprietaire' && fact.source === 'ia') continue;
    merged.set(fact.key, fact);
  }
  // On conserve l'ordre du catalogue : la fiche se lit toujours pareil.
  return FACT_QUESTIONS.map((question) => merged.get(question.key)).filter(
    (fact): fact is PropertyFact => fact !== undefined,
  );
}

export interface FactsReview {
  /** Questions sans aucune réponse. */
  unanswered: FactQuestion[];
  /** Questions pré-remplies par l'IA, en attente de confirmation. */
  toConfirm: FactQuestion[];
  /** Vrai quand toutes les questions obligatoires ont une réponse confirmée. */
  ready: boolean;
  /** Part des questions obligatoires réglées, de 0 à 1. */
  progress: number;
}

/** Ce qu'il reste à faire sur la fiche. */
export function reviewFacts(facts: PropertyFact[]): FactsReview {
  const byKey = new Map(facts.map((fact) => [fact.key, fact]));
  const settled = (question: FactQuestion): boolean => {
    const fact = byKey.get(question.key);
    return Boolean(fact?.value.trim()) && fact!.source === 'proprietaire';
  };

  const unanswered = FACT_QUESTIONS.filter((question) => !byKey.get(question.key)?.value.trim());
  const toConfirm = FACT_QUESTIONS.filter((question) => {
    const fact = byKey.get(question.key);
    return Boolean(fact?.value.trim()) && fact!.source === 'ia';
  });

  const required = FACT_QUESTIONS.filter((question) => question.required);
  const done = required.filter(settled).length;

  return {
    unanswered,
    toConfirm,
    ready: done === required.length,
    progress: required.length === 0 ? 1 : done / required.length,
  };
}

/**
 * Fiche mise en texte pour l'assistant des visites.
 *
 * Seules les réponses confirmées par le propriétaire y figurent : l'assistant
 * ne doit répondre à un voyageur que sur des faits assumés. Une supposition de
 * l'IA restée sans confirmation n'a rien à faire dans une conversation qui
 * précède une réservation.
 */
export function factsForAssistant(facts: PropertyFact[]): string {
  const lines: string[] = [];
  for (const question of FACT_QUESTIONS) {
    const fact = facts.find((entry) => entry.key === question.key);
    if (!fact || fact.source !== 'proprietaire' || !fact.value.trim()) continue;
    lines.push(`${question.label} ${fact.value.trim()}`);
  }
  return lines.join('\n');
}

/** Réponses réunies en un paragraphe, point de départ de la présentation publique. */
export function factsForDescription(facts: PropertyFact[]): string {
  const value = (key: string) => facts.find((fact) => fact.key === key && fact.source === 'proprietaire')?.value.trim();

  const parts: string[] = [];
  const meuble = value('meuble');
  const couchages = value('couchages');
  if (meuble || couchages) {
    parts.push([meuble, couchages && `${couchages} couchages`].filter(Boolean).join(', ') + '.');
  }
  const equipements = value('equipements');
  if (equipements) parts.push(`Équipements : ${equipements}.`);
  const adresse = value('adresse');
  const proximite = value('proximite');
  if (adresse) parts.push(`${adresse}.`);
  if (proximite) parts.push(`À proximité : ${proximite}.`);
  const particularites = value('particularites');
  if (particularites) parts.push(particularites.endsWith('.') ? particularites : `${particularites}.`);
  return parts.join(' ');
}

/**
 * Valide les réponses du modèle.
 *
 * Isolée de l'appel réseau pour être testable sans clé : c'est ici qu'on refuse
 * une clé inventée ou une option hors catalogue.
 */
export function parseFactAnswers(raw: unknown): PropertyFact[] {
  const payload = raw as { answers?: unknown };
  if (!Array.isArray(payload?.answers)) return [];

  const seen = new Set<string>();
  const facts: PropertyFact[] = [];

  for (const entry of payload.answers) {
    const answer = entry as { key?: unknown; value?: unknown };
    const key = String(answer.key ?? '').trim();
    const value = String(answer.value ?? '').trim();
    const question = findQuestion(key);
    if (!question || !question.visual || !value || seen.has(key)) continue;

    if (question.kind === 'choice' && question.options) {
      // Une réponse hors des options proposées n'est pas exploitable telle
      // quelle : on la laisse au propriétaire plutôt que de la déformer.
      const match = question.options.find((option) => option.toLowerCase() === value.toLowerCase());
      if (!match) continue;
      seen.add(key);
      facts.push({ key, value: match, source: 'ia' });
      continue;
    }

    if (question.kind === 'multi' && question.options) {
      const chosen = value
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .map((part) => question.options!.find((option) => option.toLowerCase() === part))
        .filter((option): option is string => Boolean(option));
      if (chosen.length === 0) continue;
      seen.add(key);
      facts.push({ key, value: [...new Set(chosen)].join(', '), source: 'ia' });
      continue;
    }

    seen.add(key);
    facts.push({ key, value: value.slice(0, 400), source: 'ia' });
  }

  return facts;
}
