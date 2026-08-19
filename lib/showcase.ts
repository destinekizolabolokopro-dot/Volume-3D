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

import type { FurnitureTone } from './palette.ts';
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
  /** Une teinte du nuancier étudié (`lib/palette.ts`), jamais une valeur libre. */
  tone: FurnitureTone;
}

/*
 * L'implantation.
 *
 * Deux règles ont guidé chaque position, et toutes deux viennent d'une erreur
 * qu'un contrôle a rattrapée.
 *
 *  · **On se cale sur la face du mur, pas sur la ligne du plan.** Chaque pièce
 *    porte une peau intérieure — neuf centimètres pour une cloison, trente pour
 *    une façade. La cuisine était enfoncée d'un tiers dans la façade, le placard
 *    d'entrée à moitié dedans. À l'écran ça ne se lit pas comme une erreur, mais
 *    comme un meuble anormalement mince.
 *  · **Rien dans l'axe d'une porte.** Le placard du dégagement était posé pile
 *    devant l'ouverture du séjour, la douche devant la sienne : la caméra les
 *    traversait à chaque passage.
 */
export const SHOWCASE_MASSING: Massing[] = [
  /* ------------------------------------------------------------- séjour --- */
  { roomId: 'sejour', x: 1.7, y: 2.15, w: 2.6, d: 1.8, h: 0.012, tone: 'tapis' },
  // Le canapé porte la seule couleur franche de la scène ; les coussins lui
  // répondent en terre cuite, presque à l'opposé sur le cercle des teintes.
  { roomId: 'sejour', x: 1.7, y: 2.9, w: 2.1, d: 0.85, h: 0.42, tone: 'petrole' },
  { roomId: 'sejour', x: 1.7, y: 3.19, w: 2.1, d: 0.28, h: 0.78, tone: 'petrole' },
  { roomId: 'sejour', x: 0.78, y: 2.9, w: 0.26, d: 0.85, h: 0.6, tone: 'petrole' },
  { roomId: 'sejour', x: 2.62, y: 2.9, w: 0.26, d: 0.85, h: 0.6, tone: 'petrole' },
  { roomId: 'sejour', x: 1.18, y: 2.99, w: 0.4, d: 0.18, h: 0.34, base: 0.42, tone: 'terre' },
  { roomId: 'sejour', x: 2.22, y: 2.99, w: 0.4, d: 0.18, h: 0.34, base: 0.42, tone: 'terre' },
  { roomId: 'sejour', x: 1.7, y: 1.8, w: 1.0, d: 0.52, h: 0.4, shape: 'table', tone: 'bois' },
  // Un cadre au-dessus du canapé. Un mur nu de deux mètres soixante se remarque.
  { roomId: 'sejour', x: 1.7, y: 3.68, w: 0.9, d: 0.04, h: 0.6, base: 1.15, tone: 'bois' },
  { roomId: 'sejour', x: 1.7, y: 3.655, w: 0.78, d: 0.02, h: 0.48, base: 1.21, tone: 'terre' },

  // Coin repas, sous la fenêtre.
  { roomId: 'sejour', x: 4.05, y: 1.15, w: 1.35, d: 0.8, h: 0.74, shape: 'table', tone: 'bois' },
  { roomId: 'sejour', x: 4.05, y: 0.68, w: 0.42, d: 0.42, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 4.05, y: 0.49, w: 0.42, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 4.05, y: 1.62, w: 0.42, d: 0.42, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 4.05, y: 1.81, w: 0.42, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  // La suspension : une tige et un abat-jour. Deux boîtes, et la pièce cesse
  // d'être un volume vide au-dessus d'un mètre quatre-vingts.
  { roomId: 'sejour', x: 4.05, y: 1.15, w: 0.025, d: 0.025, h: 0.5, base: 2.1, tone: 'laiton' },
  { roomId: 'sejour', x: 4.05, y: 1.15, w: 0.24, d: 0.24, h: 0.13, base: 1.97, tone: 'laiton' },

  /* La cuisine en linéaire. Le plan de travail est d'une autre teinte que les
     caissons — c'est ce qui la fait lire comme une cuisine plutôt que comme un
     bloc, et c'est vrai de presque toutes les cuisines. */
  { roomId: 'sejour', x: 4.31, y: 0.6, w: 1.6, d: 0.6, h: 0.9, tone: 'cabinet' },
  { roomId: 'sejour', x: 4.31, y: 0.62, w: 1.6, d: 0.64, h: 0.045, base: 0.9, tone: 'sombre' },
  { roomId: 'sejour', x: 4.0, y: 0.62, w: 0.46, d: 0.38, h: 0.02, base: 0.925, tone: 'lin' },
  { roomId: 'sejour', x: 4.31, y: 0.32, w: 1.6, d: 0.04, h: 0.48, base: 0.945, tone: 'cabinet' },
  { roomId: 'sejour', x: 4.31, y: 0.47, w: 1.6, d: 0.34, h: 0.62, base: 1.45, tone: 'cabinet' },
  // Le placard d'entrée, contre la façade.
  { roomId: 'sejour', x: 0.6, y: 1.1, w: 0.6, d: 1.6, h: 2.05, tone: 'cabinet' },

  /* ------------------------------------------------------------ chambre --- */
  { roomId: 'chambre', x: 8.4, y: 1.95, w: 1.6, d: 2.0, h: 0.4, tone: 'bois' },
  { roomId: 'chambre', x: 8.4, y: 1.95, w: 1.55, d: 1.95, h: 0.18, base: 0.4, tone: 'lin' },
  // La couette reprend la couleur du canapé : c'est ce qui relie les deux pièces,
  // et ce qui empêche la chambre de paraître décorée par quelqu'un d'autre.
  { roomId: 'chambre', x: 8.4, y: 1.62, w: 1.55, d: 1.3, h: 0.1, base: 0.58, tone: 'petrole' },
  { roomId: 'chambre', x: 8.4, y: 1.06, w: 1.55, d: 0.34, h: 0.05, base: 0.58, tone: 'terre' },
  { roomId: 'chambre', x: 8.05, y: 2.68, w: 0.58, d: 0.34, h: 0.13, base: 0.58, tone: 'lin' },
  { roomId: 'chambre', x: 8.75, y: 2.68, w: 0.58, d: 0.34, h: 0.13, base: 0.58, tone: 'lin' },
  { roomId: 'chambre', x: 8.4, y: 2.99, w: 1.7, d: 0.1, h: 1.0, tone: 'bois' },
  { roomId: 'chambre', x: 7.4, y: 2.75, w: 0.4, d: 0.4, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 9.4, y: 2.75, w: 0.4, d: 0.4, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 7.4, y: 2.75, w: 0.18, d: 0.18, h: 0.26, base: 0.52, tone: 'laiton' },
  { roomId: 'chambre', x: 9.4, y: 2.75, w: 0.18, d: 0.18, h: 0.26, base: 0.52, tone: 'laiton' },
  { roomId: 'chambre', x: 7.0, y: 0.9, w: 0.62, d: 1.2, h: 2.1, tone: 'cabinet' },
  { roomId: 'chambre', x: 8.4, y: 0.525, w: 1.1, d: 0.45, h: 0.78, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 8.4, y: 0.34, w: 0.7, d: 0.04, h: 0.45, base: 1.25, tone: 'bois' },
  { roomId: 'chambre', x: 8.4, y: 0.365, w: 0.6, d: 0.02, h: 0.35, base: 1.3, tone: 'petrole' },

  /* --------------------------------------------------------- salle d’eau --- */
  /* La douche occupe l'angle le plus éloigné de la porte. Elle était d'abord
     posée dans l'angle d'à côté, c'est-à-dire exactement dans l'axe de son
     ouverture : on entrait dedans. */
  { roomId: 'salle-eau', x: 7.85, y: 4.25, w: 0.9, d: 0.9, h: 0.07, tone: 'cabinet' },
  { roomId: 'salle-eau', x: 7.395, y: 4.25, w: 0.035, d: 0.9, h: 1.9, base: 0.07, tone: 'cabinet' },
  { roomId: 'salle-eau', x: 7.85, y: 3.7825, w: 0.9, d: 0.035, h: 1.9, base: 0.07, tone: 'cabinet' },
  { roomId: 'salle-eau', x: 7.25, y: 3.54, w: 0.7, d: 0.5, h: 0.86, tone: 'bois' },
  { roomId: 'salle-eau', x: 7.25, y: 3.54, w: 0.44, d: 0.34, h: 0.055, base: 0.86, tone: 'cabinet' },
  { roomId: 'salle-eau', x: 7.25, y: 3.32, w: 0.6, d: 0.06, h: 0.9, base: 1.05, tone: 'cabinet' },
  { roomId: 'salle-eau', x: 6.72, y: 4.5, w: 0.06, d: 0.4, h: 0.9, base: 0.55, tone: 'laiton' },
  { roomId: 'salle-eau', x: 6.78, y: 4.5, w: 0.045, d: 0.3, h: 0.52, base: 0.72, tone: 'lin' },

  /* --------------------------------------------------------- dégagement --- */
  /* Le placard tient le fond du couloir, et rien d'autre n'y tient : un mètre
     quarante de large ne se meuble pas des deux côtés. */
  { roomId: 'degagement', x: 5.46, y: 3.5, w: 0.34, d: 1.2, h: 2.2, tone: 'cabinet' },
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
