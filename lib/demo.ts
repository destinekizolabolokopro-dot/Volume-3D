import type { Hotspot, Scene } from './types';

/**
 * Visite de démonstration de la page d'accueil.
 *
 * Elle ne vient pas de la base : ce sont trois fichiers fixes, versionnés avec
 * le code. Trois raisons à ça — la page d'accueil doit être identique sur toute
 * installation, y compris neuve ; elle ne doit jamais exposer le logement d'un
 * client ; et elle ne doit pas dépendre de la disponibilité de la base.
 *
 * Les images sont préparées par `scripts/generate-demo.mjs`.
 */

/**
 * Les caps relevés sur l'image et ceux du viewer ne partagent pas la même
 * origine.
 *
 * Une position se lit facilement sur le panorama à plat : la colonne x sur une
 * image de largeur W correspond au cap `360 × x / W`. Mais cette colonne, une
 * fois plaquée sur la sphère inversée de three.js, se retrouve un quart de tour
 * plus loin que le zéro du viewer, qui compte depuis −Z (voir `lib/sphere.ts`).
 * D'où cette conversion, faite en un seul endroit.
 */
const facing = (imageYaw: number) => (imageYaw + 90) % 360;

const room = (id: string, name: string, position: number, imageYaw: number, pitch = -6): Scene => ({
  id,
  propertyId: 'demo',
  name,
  imageUrl: `/demo/${id}.jpg`,
  position,
  initialYaw: facing(imageYaw),
  initialPitch: pitch,
});

/** Chaque pièce s'ouvre sur ce qu'on regarde en entrant, pas sur un mur nu. */
export const DEMO_SCENES: Scene[] = [
  room('salon', 'Salon', 0, 219),
  room('chambre', 'Chambre', 1, 294),
  // Pièce mansardée : sans plongée, on ouvre sur la fenêtre de toit.
  room('salle-de-bain', 'Salle de bain', 2, 186, -16),
];

/** Les points de passage sont posés sur les portes visibles dans les images. */
export const DEMO_HOTSPOTS: Hotspot[] = [
  { id: 'salon-chambre', sceneId: 'salon', targetSceneId: 'chambre', label: 'Chambre', yaw: facing(144), pitch: -4 },
  { id: 'chambre-salon', sceneId: 'chambre', targetSceneId: 'salon', label: 'Salon', yaw: facing(45), pitch: -4 },
  {
    id: 'chambre-bain',
    sceneId: 'chambre',
    targetSceneId: 'salle-de-bain',
    label: 'Salle de bain',
    yaw: facing(352),
    pitch: -4,
  },
  {
    id: 'bain-chambre',
    sceneId: 'salle-de-bain',
    targetSceneId: 'chambre',
    label: 'Chambre',
    yaw: facing(300),
    pitch: -4,
  },
];
