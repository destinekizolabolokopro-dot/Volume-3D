/**
 * L'appartement de démonstration.
 *
 * Il vit **dans le code**, pas dans la base. C'est délibéré : la page d'accueil
 * est la visite, et une page d'accueil qui dépend du contenu d'une base peut se
 * retrouver vide. Ici, le premier déploiement sur une base neuve montre déjà
 * quelque chose.
 *
 * Ce qu'il faut savoir sur son honnêteté : **les mesures sont réelles au sens
 * où elles sont cohérentes** — surfaces, hauteurs, largeurs d'ouverture,
 * circulation — mais le bien est fictif tant qu'un vrai logement n'a pas été
 * relevé. La page le dit. On vend la fidélité du volume, on ne peut pas la
 * revendiquer sur un appartement qui n'existe pas.
 *
 * Le mobilier est volontairement traité en masses simples. Un meuble en boîte
 * bien proportionnée se lit comme un meuble et n'a pas la prétention d'être une
 * photo ; une fausse photo, elle, aurait exactement le défaut qu'on reproche
 * aux annonces retouchées.
 */

import type { PlanDoor, PlanRoom } from './types.ts';
import type { CaptionText } from './journey-path.ts';

export const SHOWCASE_ROOMS: PlanRoom[] = [
  {
    id: 'sejour',
    name: 'Séjour & cuisine',
    height: 2.6,
    points: [
      { x: 0, y: 0 },
      { x: 5.2, y: 0 },
      { x: 5.2, y: 4 },
      { x: 0, y: 4 },
    ],
  },
  /* Le dégagement descend jusqu'à 4,40 m, et ce n'est pas un détail de
     dessin : il doit être réellement mitoyen des deux pièces qu'il dessert.
     Dans une première version il s'arrêtait à 3,00 m tandis que la salle d'eau
     commençait à 3,20 m — la porte déclarée entre les deux ne reposait donc sur
     aucun mur commun, et la caméra traversait vingt centimètres de vide sans
     sol ni plafond, par lesquels on voyait le ciel. Une porte doit toucher ses
     deux pièces. */
  {
    id: 'degagement',
    name: 'Dégagement',
    height: 2.6,
    points: [
      { x: 5.2, y: 1.2 },
      { x: 6.6, y: 1.2 },
      { x: 6.6, y: 4.4 },
      { x: 5.2, y: 4.4 },
    ],
  },
  {
    id: 'chambre',
    name: 'Chambre',
    height: 2.6,
    points: [
      { x: 6.6, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 3.2 },
      { x: 6.6, y: 3.2 },
    ],
  },
  {
    id: 'salle-eau',
    name: 'Salle d’eau',
    height: 2.6,
    points: [
      { x: 6.6, y: 3.2 },
      { x: 8.6, y: 3.2 },
      { x: 8.6, y: 5 },
      { x: 6.6, y: 5 },
    ],
  },
];

const opening = (
  id: string,
  from: string,
  to: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  kind: PlanDoor['kind'],
  height: number,
  sill: number,
): PlanDoor => ({ id, planId: 'showcase', from, to, a, b, kind, height, sill });

export const SHOWCASE_DOORS: PlanDoor[] = [
  // La porte palière : `to` vide, elle ne mène à aucune pièce du plan. C'est ce
  // qui la distingue d'une porte intérieure, et c'est par là qu'on entre.
  opening('entree', 'sejour', '', { x: 0, y: 2.35 }, { x: 0, y: 3.25 }, 'door', 2.1, 0),
  opening('deg-sejour', 'sejour', 'degagement', { x: 5.2, y: 1.6 }, { x: 5.2, y: 2.5 }, 'opening', 2.15, 0),
  opening('deg-chambre', 'degagement', 'chambre', { x: 6.6, y: 1.5 }, { x: 6.6, y: 2.4 }, 'door', 2.05, 0),
  opening('deg-bain', 'degagement', 'salle-eau', { x: 6.6, y: 3.5 }, { x: 6.6, y: 4.3 }, 'door', 2.05, 0),
  opening('f-sejour', 'sejour', '', { x: 1, y: 0 }, { x: 3.2, y: 0 }, 'window', 2.25, 0.85),
  opening('f-chambre', 'chambre', '', { x: 10, y: 0.6 }, { x: 10, y: 2 }, 'window', 2.2, 0.9),
  opening('f-bain', 'salle-eau', '', { x: 8.6, y: 3.7 }, { x: 8.6, y: 4.4 }, 'window', 2.1, 1.2),
];

/* ============================================================== mobilier === */

/**
 * Un meuble, ramené à sa masse.
 *
 * `x`/`y` sont le centre au sol, `w` la largeur avant rotation, `d` la
 * profondeur, `h` la hauteur. `yaw` tourne autour du centre, en degrés. On ne
 * modélise que ce qui change la lecture du volume : ce qui occupe le sol et ce
 * qui monte.
 */
export interface Massing {
  roomId: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  yaw?: number;
  /** Repose sur le sol par défaut ; utilisé pour un plateau ou un tapis. */
  base?: number;
  /**
   * `bloc` : une masse pleine, pour ce qui touche le sol — armoire, canapé,
   * plan de travail. `table` : un plateau sur quatre pieds.
   *
   * La distinction n'est pas cosmétique. Une table rendue en bloc plein
   * ressemble à une caisse posée au milieu de la pièce, et comme elle occupe le
   * premier plan quand la caméra passe à côté, c'est elle qu'on regarde. Quatre
   * pieds de six centimètres suffisent à ce que l'œil lise « table » et passe à
   * autre chose.
   */
  shape?: 'bloc' | 'table';
  tone: 'bois' | 'tissu' | 'clair' | 'sombre' | 'accent' | 'tapis';
}

export const SHOWCASE_MASSING: Massing[] = [
  /* ------------------------------------------------------------- séjour --- */
  { roomId: 'sejour', x: 1.7, y: 2.15, w: 2.6, d: 1.8, h: 0.012, tone: 'tapis' },
  { roomId: 'sejour', x: 1.7, y: 2.95, w: 2.1, d: 0.85, h: 0.42, tone: 'tissu' },
  { roomId: 'sejour', x: 1.7, y: 3.24, w: 2.1, d: 0.28, h: 0.78, tone: 'tissu' },
  { roomId: 'sejour', x: 0.78, y: 2.95, w: 0.26, d: 0.85, h: 0.6, tone: 'tissu' },
  { roomId: 'sejour', x: 2.62, y: 2.95, w: 0.26, d: 0.85, h: 0.6, tone: 'tissu' },
  { roomId: 'sejour', x: 1.7, y: 1.85, w: 1.0, d: 0.52, h: 0.4, shape: 'table', tone: 'bois' },
  // Coin repas, sous la fenêtre.
  { roomId: 'sejour', x: 4.1, y: 1.15, w: 1.35, d: 0.8, h: 0.74, shape: 'table', tone: 'bois' },
  { roomId: 'sejour', x: 4.1, y: 0.55, w: 0.42, d: 0.42, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 4.1, y: 0.36, w: 0.42, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 4.1, y: 1.75, w: 0.42, d: 0.42, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 4.1, y: 1.94, w: 0.42, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  // Cuisine en linéaire, contre le mur du fond, à droite de la fenêtre.
  { roomId: 'sejour', x: 4.35, y: 0.3, w: 1.6, d: 0.6, h: 0.9, tone: 'clair' },
  { roomId: 'sejour', x: 0.35, y: 0.9, w: 0.6, d: 1.6, h: 2.05, tone: 'clair' },

  /* ------------------------------------------------------------ chambre --- */
  { roomId: 'chambre', x: 8.4, y: 2.05, w: 1.6, d: 2.0, h: 0.5, tone: 'tissu' },
  { roomId: 'chambre', x: 8.4, y: 3.05, w: 1.7, d: 0.1, h: 1.0, tone: 'bois' },
  { roomId: 'chambre', x: 7.4, y: 2.85, w: 0.4, d: 0.4, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 9.4, y: 2.85, w: 0.4, d: 0.4, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 6.95, y: 0.65, w: 0.62, d: 1.2, h: 2.1, tone: 'clair' },
  { roomId: 'chambre', x: 8.4, y: 0.35, w: 1.1, d: 0.45, h: 0.78, shape: 'table', tone: 'bois' },

  /* --------------------------------------------------------- salle d’eau --- */
  { roomId: 'salle-eau', x: 7.05, y: 4.5, w: 0.9, d: 0.9, h: 2.0, tone: 'clair' },
  { roomId: 'salle-eau', x: 8.05, y: 3.52, w: 0.95, d: 0.5, h: 0.86, tone: 'bois' },
  { roomId: 'salle-eau', x: 8.05, y: 3.28, w: 0.8, d: 0.06, h: 0.9, base: 1.05, tone: 'clair' },

  /* --------------------------------------------------------- dégagement --- */
  { roomId: 'degagement', x: 5.45, y: 2.1, w: 0.34, d: 1.2, h: 2.2, tone: 'clair' },
];

/* ============================================================== légendes === */

export const SHOWCASE_OPENING: CaptionText = {
  kicker: 'Paris 3ᵉ · Le Marais',
  title: 'Deux pièces, 39,8 m²',
  text: 'Faites défiler. La porte s’ouvre et vous entrez.',
};

export const SHOWCASE_CAPTIONS: Record<string, CaptionText> = {
  sejour: {
    kicker: 'Séjour & cuisine',
    title: '20,8 m²',
    text: 'Une fenêtre de 2,20 m sur rue. La cuisine est en linéaire au fond, la table tient quatre couverts.',
  },
  degagement: {
    kicker: 'Dégagement',
    title: '4,5 m²',
    text: 'Il dessert la chambre et la salle d’eau, et porte le placard d’entrée. 1,40 m de large : deux personnes s’y croisent.',
  },
  chambre: {
    kicker: 'Chambre',
    title: '10,9 m²',
    text: 'Un lit en 160 avec ses deux chevets, une armoire pleine hauteur, et il reste 80 cm de passage de chaque côté.',
  },
  'salle-eau': {
    kicker: 'Salle d’eau',
    title: '3,6 m²',
    text: 'Douche 90 × 90, meuble vasque, et une fenêtre — ce que la moitié des salles d’eau parisiennes n’ont pas.',
  },
};

export const SHOWCASE_CLOSING: CaptionText = {
  kicker: 'Voilà',
  title: 'C’est ce que verra votre voyageur',
  text: 'Mêmes murs, mêmes distances : le volume vient du plan relevé, pas d’une image de synthèse improvisée.',
};

/** Ce qui s'affiche autour de la visite : le bien tel qu'on l'annoncerait. */
export const SHOWCASE_IDENTITY = {
  name: 'Appartement Sainte-Croix',
  city: 'Paris 3ᵉ — Le Marais',
  area: 39.8,
  rooms: 2,
  sleeps: 2,
  /** Appartement de démonstration : à dire, toujours, et sans détour. */
  disclaimer:
    'Appartement de démonstration. Les dimensions et la circulation sont cohérentes de bout en bout ; le bien, lui, est fictif tant qu’un vrai logement n’a pas été relevé.',
};
