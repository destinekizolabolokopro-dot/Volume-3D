import type { Hotspot, Scene } from './types';

/**
 * Visite de démonstration de la page d'accueil.
 *
 * Elle ne vient pas de la base : ce sont trois fichiers fixes, versionnés avec
 * le code. Trois raisons à ça — la page d'accueil doit être identique sur toute
 * installation, y compris neuve ; elle ne doit jamais exposer le logement d'un
 * client ; et elle ne doit pas dépendre de la disponibilité de la base.
 *
 * Les images sont produites par `scripts/generate-demo.mjs`.
 */

/**
 * Les caps du plan de la pièce (`scripts/demo-rooms.mjs`) et ceux du viewer ne
 * partagent pas la même origine.
 *
 * La colonne x = 0 de l'image équirectangulaire se retrouve, une fois plaquée
 * sur la sphère inversée de three.js, dans la direction +X du monde. Le viewer,
 * lui, compte ses lacets depuis −Z (voir `lib/sphere.ts`). D'où un quart de
 * tour d'écart, et rien d'autre : les deux repères tournent dans le même sens.
 */
const facing = (drawnYaw: number) => (drawnYaw + 90) % 360;

const room = (id: string, name: string, position: number, drawnYaw: number): Scene => ({
  id,
  propertyId: 'demo',
  name,
  imageUrl: `/demo/${id}.jpg`,
  position,
  initialYaw: facing(drawnYaw),
  // Légère plongée : le mobilier entre dans le cadre, pas seulement les murs.
  initialPitch: -11,
});

/** Chaque pièce s'ouvre face à son meuble principal, pas face à un mur nu. */
export const DEMO_SCENES: Scene[] = [
  room('salon', 'Salon', 0, 196),
  room('chambre', 'Chambre', 1, 60),
  room('cuisine', 'Cuisine', 2, 4),
];

/** Les points de passage sont posés sur les portes dessinées dans les images. */
export const DEMO_HOTSPOTS: Hotspot[] = [
  { id: 'salon-cuisine', sceneId: 'salon', targetSceneId: 'cuisine', label: 'Cuisine', yaw: facing(250), pitch: -6 },
  { id: 'salon-chambre', sceneId: 'salon', targetSceneId: 'chambre', label: 'Chambre', yaw: facing(348), pitch: -6 },
  { id: 'chambre-salon', sceneId: 'chambre', targetSceneId: 'salon', label: 'Salon', yaw: facing(196), pitch: -6 },
  { id: 'cuisine-salon', sceneId: 'cuisine', targetSceneId: 'salon', label: 'Salon', yaw: facing(254), pitch: -6 },
];
