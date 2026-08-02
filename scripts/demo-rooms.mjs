/**
 * Description des trois pièces de la démonstration publique.
 *
 * Toutes les cotes sont en mètres. `depth` est la demi-largeur de la pièce,
 * `eye` la hauteur de l'objectif au-dessus du sol, `height` la hauteur sous
 * plafond — soit exactement les trois chiffres qu'on relève sur place.
 *
 * Les éléments sont posés par cap (`yaw`, en degrés) et par largeur angulaire,
 * puis par hauteur au-dessus du sol (`from` / `to`). L'ordre du tableau est
 * l'ordre de dessin : tapis d'abord, meubles ensuite.
 */
export const ROOMS = [
  {
    slug: 'salon',
    name: 'Salon',
    depth: 2.7,
    eye: 1.6,
    height: 2.55,
    /** Cap du mur le plus éclairé — oriente le voile de lumière. */
    light: 90,
    items: [
      { type: 'rug', yaw: 196, width: 86 },
      { type: 'window', yaw: 90, width: 76, from: 0.85, to: 2.2 },
      { type: 'table', yaw: 146, width: 26, top: 0.44 },
      { type: 'sofa', yaw: 196, width: 64, back: 0.82, seat: 0.44 },
      { type: 'art', yaw: 196, width: 34, from: 1.25, to: 1.9 },
      { type: 'door', yaw: 250, width: 26, to: 2.05 },
      { type: 'art', yaw: 288, width: 26, from: 1.15, to: 1.95 },
      { type: 'art', yaw: 318, width: 18, from: 1.35, to: 1.85 },
      { type: 'door', yaw: 348, width: 26, to: 2.05 },
    ],
  },
  {
    slug: 'chambre',
    name: 'Chambre',
    depth: 2.25,
    eye: 1.6,
    height: 2.55,
    light: 268,
    items: [
      { type: 'rug', yaw: 60, width: 94 },
      { type: 'window', yaw: 268, width: 58, from: 0.9, to: 2.15 },
      { type: 'door', yaw: 196, width: 26, to: 2.05 },
      { type: 'bed', yaw: 60, width: 78, mattress: 0.56, headboard: 1.05 },
      { type: 'art', yaw: 60, width: 30, from: 1.35, to: 1.95 },
      { type: 'wardrobe', yaw: 130, width: 42, to: 2.25 },
    ],
  },
  {
    slug: 'cuisine',
    name: 'Cuisine',
    depth: 1.95,
    eye: 1.6,
    height: 2.55,
    light: 4,
    items: [
      { type: 'counter', yaw: 4, width: 128, top: 0.92 },
      { type: 'window', yaw: 4, width: 46, from: 1.15, to: 2.15 },
      { type: 'cabinets', yaw: 82, width: 58, from: 1.5, to: 2.2 },
      { type: 'table', yaw: 196, width: 46, top: 0.75 },
      { type: 'door', yaw: 254, width: 26, to: 2.05 },
      { type: 'art', yaw: 300, width: 16, from: 1.4, to: 1.85 },
    ],
  },
];
