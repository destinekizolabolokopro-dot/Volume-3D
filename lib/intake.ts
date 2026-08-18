import { roomArea } from './plan.ts';
import type { FloorPlan, Photo, PlanDoor, PlanRoom } from './types';

/**
 * Contrôle de complétude d'un dossier avant publication.
 *
 * Le client envoie un plan et des photos ; encore faut-il qu'il y en ait assez.
 * Cette vérification est **déterministe** : elle compare ce que le plan annonce
 * à ce qui a été reçu. Pas d'appel à un modèle, pas d'incertitude — donc pas de
 * message d'erreur approximatif du genre « il manque peut-être quelque chose ».
 *
 * Le message doit toujours dire *quoi* faire. « Dossier incomplet » ne sert à
 * personne ; « il manque une photo de la chambre et de la salle de bain » se
 * traite en deux minutes.
 */

export type GapSeverity = 'blocking' | 'advice';

export interface Gap {
  /** Identifiant stable, pour retrouver le manque et le tester. */
  code: string;
  severity: GapSeverity;
  message: string;
  /** Pièce concernée, quand le manque en vise une. */
  roomId?: string;
}

export interface IntakeReport {
  /** Vrai quand plus rien ne bloque la publication. */
  ready: boolean;
  gaps: Gap[];
  /** Pièces du plan qui n'ont aucune photo. */
  roomsWithoutPhoto: PlanRoom[];
  /** Photos reçues mais rattachées à aucune pièce. */
  orphanPhotos: Photo[];
  /** Part des pièces couvertes par au moins une photo, de 0 à 1. */
  coverage: number;
}

/** Pièces où l'on ne demande pas de photo : personne ne visite un placard. */
const MINOR_ROOM = /(placard|rangement|cellier|local|gaine|technique)/i;

/** Sous cette surface, une pièce est un rangement, pas un espace à montrer. */
const MINOR_AREA = 2;

const isMinor = (room: PlanRoom): boolean => MINOR_ROOM.test(room.name) || roomArea(room) < MINOR_AREA;

/** Accord en genre du nom de pièce, pour un message qui se lit bien. */
const feminine = /^(chambre|cuisine|salle|entrée|buanderie|terrasse|véranda|mezzanine)/i;

/**
 * Article défini d'un nom de pièce.
 *
 * Exporté : plusieurs modules composent des phrases avec un nom de pièce, et
 * une seconde liste de noms féminins finirait par diverger de celle-ci.
 */
export const article = (name: string): string => (feminine.test(name.trim()) ? 'la' : 'le');

/**
 * Confronte le plan relevé aux photos reçues.
 *
 * `plan` peut être nul : c'est le tout premier état du dossier, et le message
 * doit alors demander le plan, pas des photos.
 */
export function reviewIntake(plan: FloorPlan | null, doors: PlanDoor[], photos: Photo[]): IntakeReport {
  const gaps: Gap[] = [];

  if (!plan) {
    gaps.push({
      code: 'plan-manquant',
      severity: 'blocking',
      message: 'Envoyez le plan du logement : c’est lui qui donne les dimensions de chaque pièce.',
    });
    return { ready: false, gaps, roomsWithoutPhoto: [], orphanPhotos: photos, coverage: 0 };
  }

  const shown = plan.rooms.filter((room) => !isMinor(room));
  const withPhoto = new Set(photos.map((photo) => photo.roomId).filter(Boolean));
  const roomsWithoutPhoto = shown.filter((room) => !withPhoto.has(room.id));
  const orphanPhotos = photos.filter((photo) => !photo.roomId);

  if (photos.length === 0) {
    gaps.push({
      code: 'photos-manquantes',
      severity: 'blocking',
      message: `Ajoutez au moins une photo par pièce : ${shown.map((room) => room.name).join(', ')}.`,
    });
  } else {
    for (const room of roomsWithoutPhoto) {
      gaps.push({
        code: 'piece-sans-photo',
        severity: 'blocking',
        roomId: room.id,
        message: `Il manque une photo pour ${article(room.name)} ${room.name.toLowerCase()}.`,
      });
    }
  }

  if (orphanPhotos.length > 0) {
    gaps.push({
      code: 'photos-non-rattachees',
      severity: 'advice',
      message:
        orphanPhotos.length === 1
          ? 'Une photo n’est rattachée à aucune pièce : elle n’apparaîtra pas dans la visite.'
          : `${orphanPhotos.length} photos ne sont rattachées à aucune pièce : elles n’apparaîtront pas dans la visite.`,
    });
  }

  // Un logement de plusieurs pièces sans aucun passage relevé signale une
  // mauvaise lecture du plan : le visiteur serait bloqué dans la première pièce.
  const passages = doors.filter((door) => door.kind !== 'window' && door.to).length;
  if (plan.rooms.length > 1 && passages === 0) {
    gaps.push({
      code: 'aucun-passage',
      severity: 'blocking',
      message:
        'Aucun passage n’a été trouvé entre les pièces : le visiteur ne pourrait pas circuler. Relisez le plan ou envoyez-en une image plus nette.',
    });
  }

  if (!plan.confirmed) {
    gaps.push({
      code: 'plan-non-confirme',
      severity: 'blocking',
      message: 'Relisez les dimensions relevées, puis confirmez le plan.',
    });
  }

  const coverage = shown.length === 0 ? 1 : (shown.length - roomsWithoutPhoto.length) / shown.length;

  return {
    ready: gaps.every((gap) => gap.severity !== 'blocking'),
    gaps,
    roomsWithoutPhoto,
    orphanPhotos,
    coverage,
  };
}

/** Résumé en une phrase, pour un bandeau ou un email. */
export function summarizeIntake(report: IntakeReport): string {
  if (report.ready) return 'Le dossier est complet.';
  const blocking = report.gaps.filter((gap) => gap.severity === 'blocking');
  if (blocking.length === 1) return blocking[0].message;
  return `${blocking.length} points à compléter avant publication.`;
}
