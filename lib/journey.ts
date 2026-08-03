import { reviewFacts } from './facts.ts';
import type { IntakeReport } from './intake.ts';
import type { FloorPlan, Property, PropertyFact } from './types';

/**
 * Le parcours d'un bien, de sa création à sa mise en ligne.
 *
 * Ce module ne fait qu'une chose : dire **où en est le dossier**. Il ne
 * déplace personne, il ne verrouille rien. Un propriétaire reste libre de
 * remplir sa fiche avant d'envoyer son plan ; l'ordre affiché est celui qui
 * demande le moins d'allers-retours, pas une contrainte.
 *
 * Deux routes mènent à une visite publiable, et le parcours doit valoir pour
 * les deux : soit des panoramas 360° (ou une vidéo, un modèle, un viewer
 * externe), soit un plan relevé et des photos. L'étape de vérification n'a de
 * sens que sur la seconde — elle n'apparaît donc que si un plan existe.
 */

export type StepState = 'done' | 'current' | 'todo';

export interface JourneyStep {
  key: string;
  /** Nom de l'étape, tel qu'il s'affiche. */
  label: string;
  state: StepState;
  /** Ce qu'il reste à faire. Vide quand l'étape est franchie. */
  todo: string;
}

export interface Journey {
  steps: JourneyStep[];
  /** Première étape non franchie, celle sur laquelle travailler. */
  current: JourneyStep | null;
  /** Part des étapes franchies, de 0 à 1. */
  progress: number;
}

export interface JourneyInput {
  property: Pick<Property, 'name' | 'city' | 'status' | 'videoUrl' | 'modelUrl' | 'embedUrl'>;
  /** Nombre de panoramas 360° envoyés. */
  sceneCount: number;
  photoCount: number;
  plan: FloorPlan | null;
  intake: IntakeReport;
  facts: PropertyFact[];
}

/** Vrai dès qu'un format donne quelque chose à regarder au voyageur. */
function hasFormat(input: JourneyInput): boolean {
  const { property, sceneCount, plan } = input;
  return (
    sceneCount > 0 ||
    Boolean(property.videoUrl) ||
    Boolean(property.modelUrl) ||
    Boolean(property.embedUrl) ||
    Boolean(plan?.confirmed)
  );
}

/**
 * Établit l'état de chaque étape.
 *
 * Une étape est `done` quand sa condition est remplie, `current` pour la
 * première qui ne l'est pas, `todo` pour les suivantes. Une étape franchie le
 * reste même si une étape antérieure retombe : on montre l'avancement, pas une
 * machine à états.
 */
export function reviewJourney(input: JourneyInput): Journey {
  const { property, sceneCount, photoCount, plan, intake, facts } = input;
  const factsReview = reviewFacts(facts);

  const raw: Array<{ key: string; label: string; done: boolean; todo: string }> = [
    {
      key: 'logement',
      label: 'Le logement',
      done: Boolean(property.name.trim() && property.city.trim()),
      todo: 'Renseignez le nom et la ville du logement.',
    },
    {
      key: 'visite',
      label: 'La visite',
      done: hasFormat(input),
      todo: 'Envoyez des panoramas 360°, une vidéo, ou le plan du logement.',
    },
    {
      key: 'photos',
      label: 'Les photos',
      done: photoCount > 0,
      todo: 'Ajoutez au moins une photo par pièce.',
    },
  ];

  // La relecture du relevé ne concerne que la route « plan ». Sans plan, elle
  // n'a rien à vérifier et n'a donc pas à figurer au parcours.
  if (plan) {
    raw.push({
      key: 'verification',
      label: 'La vérification',
      done: intake.ready,
      todo: intake.gaps.find((gap) => gap.severity === 'blocking')?.message ?? 'Relisez le relevé du plan.',
    });
  }

  raw.push(
    {
      key: 'fiche',
      label: 'La fiche',
      done: factsReview.ready,
      todo: `Répondez aux ${factsReview.unanswered.filter((question) => question.required).length} question(s) obligatoire(s) restantes.`,
    },
    {
      key: 'publication',
      label: 'La publication',
      done: property.status === 'published',
      todo: 'Publiez la visite : son lien devient actif.',
    },
  );

  const firstOpen = raw.findIndex((step) => !step.done);
  const steps: JourneyStep[] = raw.map((step, index) => ({
    key: step.key,
    label: step.label,
    state: step.done ? 'done' : index === firstOpen ? 'current' : 'todo',
    todo: step.done ? '' : step.todo,
  }));

  const done = steps.filter((step) => step.state === 'done').length;

  return {
    steps,
    current: firstOpen === -1 ? null : steps[firstOpen],
    progress: steps.length === 0 ? 1 : done / steps.length,
  };
}
