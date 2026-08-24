/**
 * La maison de démonstration.
 *
 * Deuxième bien fictif du site, et il ne double pas l'appartement : il montre
 * ce que l'appartement ne peut pas montrer. Un logement parisien de deux
 * pièces se parcourt en ligne — entrée, séjour, couloir, chambre — et c'est
 * précisément le cas facile. Une maison de plain-pied a un couloir central qui
 * dessert six pièces, une grande baie au fond, une cuisine ouverte sur le
 * séjour : c'est là que se voient les deux choses qu'on vend, la circulation et
 * le volume.
 *
 * Elle obéit aux mêmes règles que l'appartement, et pour les mêmes raisons :
 *
 *  · **les cotes sont cohérentes de bout en bout** — surfaces, hauteurs,
 *    largeurs de passage, épaisseurs de mur — mais le bien est fictif, et la
 *    page le dit sans détour ;
 *  · **on se cale sur la face du mur, pas sur la ligne du plan.** Chaque pièce
 *    porte une peau intérieure : trente centimètres contre une façade, neuf
 *    contre une cloison. Un meuble posé sur la ligne du plan s'enfonce dedans,
 *    et à l'écran ça ne se lit pas comme une erreur mais comme un meuble
 *    anormalement mince, ce qui est bien pire ;
 *  · **rien dans l'axe d'une porte**, sinon la caméra le traverse en passant.
 *
 * Les mêmes contrôles que l'appartement tournent dessus — un plan écrit à la
 * main peut être faux, et un plan faux ne se voit pas dans un éditeur de texte.
 */

import type { FurnitureTone } from './palette.ts';
import type { PlanDoor, PlanRoom } from './types.ts';
import type { CaptionText } from './journey-path.ts';
import type { Massing } from './showcase.ts';

/*
 * Le plan, en une image.
 *
 *        0        2,8        7,0        11,2
 *   0    ┌────────┬──────────┬───────────┐
 *        │ ENTRÉE │ CHAMBRE 1│ CHAMBRE 2 │   ← rue
 *   3,3  ├────────┴──────────┴───────────┤
 *        │          DÉGAGEMENT           │
 *   4,5  ├────────┬──────────────────────┤
 *        │ SALLE  │   SÉJOUR & CUISINE   │
 *        │ DE BAIN│                      │   ← jardin
 *   8,4  └────────┴──────────────────────┘
 *
 * Le couloir traverse toute la maison : c'est lui qui rend la circulation
 * lisible, et c'est aussi ce qui manque à l'appartement, dont le dégagement ne
 * dessert que deux pièces.
 *
 * Sa largeur n'est pas un chiffre rond par hasard. À 1,10 m hors œuvre il
 * restait 92 cm entre les deux peaux de cloison — praticable, mais on le sent
 * en le traversant, et un couloir qu'on sent est exactement ce qu'une visite
 * ne doit pas donner à sentir. À 1,20 m il reste 1,02 m de passage, et les
 * douze centimètres se prennent sur le séjour, qui en a de reste.
 */

/** Deux mètres cinquante sous plafond : une maison récente, pas un haussmannien. */
const HAUTEUR = 2.5;

export const MAISON_ROOMS: PlanRoom[] = [
  {
    id: 'entree',
    name: 'Entrée',
    height: HAUTEUR,
    points: [
      { x: 0, y: 0 },
      { x: 2.8, y: 0 },
      { x: 2.8, y: 3.3 },
      { x: 0, y: 3.3 },
    ],
  },
  {
    id: 'chambre-1',
    name: 'Chambre principale',
    height: HAUTEUR,
    points: [
      { x: 2.8, y: 0 },
      { x: 7, y: 0 },
      { x: 7, y: 3.3 },
      { x: 2.8, y: 3.3 },
    ],
  },
  {
    id: 'chambre-2',
    name: 'Deuxième chambre',
    height: HAUTEUR,
    points: [
      { x: 7, y: 0 },
      { x: 11.2, y: 0 },
      { x: 11.2, y: 3.3 },
      { x: 7, y: 3.3 },
    ],
  },
  {
    id: 'degagement',
    name: 'Dégagement',
    height: HAUTEUR,
    points: [
      { x: 0, y: 3.3 },
      { x: 11.2, y: 3.3 },
      { x: 11.2, y: 4.5 },
      { x: 0, y: 4.5 },
    ],
  },
  {
    id: 'salle-de-bain',
    name: 'Salle de bain',
    height: HAUTEUR,
    points: [
      { x: 0, y: 4.5 },
      { x: 2.8, y: 4.5 },
      { x: 2.8, y: 8.4 },
      { x: 0, y: 8.4 },
    ],
  },
  {
    id: 'sejour',
    name: 'Séjour & cuisine',
    height: HAUTEUR,
    points: [
      { x: 2.8, y: 4.5 },
      { x: 11.2, y: 4.5 },
      { x: 11.2, y: 8.4 },
      { x: 2.8, y: 8.4 },
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
): PlanDoor => ({ id, planId: 'maison', from, to, a, b, kind, height, sill });

/*
 * Les ouvertures.
 *
 * Chacune est posée là où **rien ne la bloque de l'autre côté**. Sur un plan
 * papier ça se choisit à l'œil ; ici la contrainte est plus dure, parce que la
 * caméra franchit réellement chaque passage et regarde droit devant en le
 * franchissant. Une porte face à une armoire donne une image d'armoire ; une
 * porte face à un plan de travail donne l'impression qu'on entre dans le
 * meuble. L'ouverture du séjour a été déplacée deux fois pour cette raison
 * seule : à l'ouest elle butait sur le dossier du canapé, à l'est sur le retour
 * de cuisine. Entre les deux, elle débouche sur la table et, derrière elle,
 * sur la baie.
 */
export const MAISON_DOORS: PlanDoor[] = [
  // La porte d'entrée, sur la façade rue. `to` vide : elle ne mène à aucune
  // pièce du plan, et c'est ce qui la désigne comme porte d'entrée.
  opening('porte', 'entree', '', { x: 1, y: 0 }, { x: 2, y: 0 }, 'door', 2.15, 0),

  // Les portes intérieures. Chacune repose sur un mur commun à ses deux pièces.
  opening('d-entree', 'entree', 'degagement', { x: 1.3, y: 3.3 }, { x: 2.3, y: 3.3 }, 'opening', 2.15, 0),
  opening('d-chambre-1', 'chambre-1', 'degagement', { x: 5.2, y: 3.3 }, { x: 6.1, y: 3.3 }, 'door', 2.1, 0),
  opening('d-chambre-2', 'chambre-2', 'degagement', { x: 7.35, y: 3.3 }, { x: 8.25, y: 3.3 }, 'door', 2.1, 0),
  opening('d-bain', 'salle-de-bain', 'degagement', { x: 1, y: 4.5 }, { x: 1.75, y: 4.5 }, 'door', 2.1, 0),
  /* Le séjour s'ouvre largement sur le couloir : un mètre soixante, sans
     battant. C'est ce qui fait qu'on voit la baie du fond depuis le couloir. */
  opening('d-sejour', 'sejour', 'degagement', { x: 5.6, y: 4.5 }, { x: 7.2, y: 4.5 }, 'opening', 2.2, 0),

  // Les fenêtres, côté rue.
  opening('f-chambre-1', 'chambre-1', '', { x: 3.9, y: 0 }, { x: 5.9, y: 0 }, 'window', 2.2, 0.9),
  opening('f-chambre-2', 'chambre-2', '', { x: 8.1, y: 0 }, { x: 10.1, y: 0 }, 'window', 2.2, 0.9),
  /* La baie du séjour, côté jardin : trois mètres soixante, allège à quinze
     centimètres. C'est l'argument de la maison, et il se mesure. */
  opening('baie', 'sejour', '', { x: 5.2, y: 8.4 }, { x: 8.8, y: 8.4 }, 'window', 2.3, 0.15),
  opening('f-sejour', 'sejour', '', { x: 11.2, y: 5.6 }, { x: 11.2, y: 7.2 }, 'window', 2.2, 0.9),
  /* La fenêtre de la salle de bain donne au sud, au-dessus de la baignoire,
     allège à 1,20 m. Elle était d'abord à l'ouest ; le seul mur qui pouvait
     recevoir le meuble vasque et son miroir était celui-là, et une salle de
     bain sans miroir au-dessus des vasques n'est pas une salle de bain. */
  opening('f-bain', 'salle-de-bain', '', { x: 0.9, y: 8.4 }, { x: 1.9, y: 8.4 }, 'window', 2.1, 1.2),
];

/* ============================================================== mobilier === */

/*
 * L'implantation.
 *
 * Les faces intérieures, une fois retirée la peau de chaque mur — c'est sur
 * elles qu'on se cale, jamais sur les lignes du plan :
 *
 *   entrée         x 0,30 → 2,71    y 0,30 → 3,21
 *   chambre 1      x 2,89 → 6,91    y 0,30 → 3,21
 *   chambre 2      x 7,09 → 10,90   y 0,30 → 3,21
 *   dégagement     x 0,30 → 10,90   y 3,39 → 4,41
 *   salle de bain  x 0,30 → 2,71    y 4,59 → 8,10
 *   séjour         x 2,89 → 10,90   y 4,59 → 8,10
 */
export const MAISON_MASSING: Massing[] = [
  /* ------------------------------------------------------------- entrée --- */
  /* Le vestiaire, contre le mur ouest. Il est volontairement court : le reste
     du mur reçoit le radiateur, et une entrée entièrement bordée de placards
     se lit comme un couloir. */
  { roomId: 'entree', x: 0.575, y: 1.75, w: 0.55, d: 1.3, h: 2.15, shape: 'placard', tone: 'cabinet' },
  { roomId: 'entree', x: 0.355, y: 2.8, w: 0.7, d: 0.11, h: 0.55, yaw: 90, shape: 'radiateur', tone: 'cabinet' },
  /* La console et son miroir, en face en entrant : les deux objets qui font
     qu'une entrée se lit comme une entrée et non comme un bout de couloir. */
  { roomId: 'entree', x: 2.53, y: 1.9, w: 0.34, d: 1.0, h: 0.8, shape: 'placard', tone: 'bois' },
  { roomId: 'entree', x: 2.68, y: 1.9, w: 0.06, d: 0.8, h: 0.9, base: 1.0, tone: 'cabinet' },
  { roomId: 'entree', x: 1.5, y: 1.0, w: 1.3, d: 0.85, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'entree', x: 1.5, y: 1.9, w: 0.28, d: 0.28, h: 0.05, base: 2.45, shape: 'plafonnier', tone: 'platre' },

  /* --------------------------------------------------------- chambre 1 --- */
  /* Le lit en 160, tête contre le mur ouest. Il ne peut pas aller ailleurs :
     la fenêtre tient le mur nord, la porte le mur sud, et l'armoire a besoin
     des deux mètres du mur est. */
  { roomId: 'chambre-1', x: 2.94, y: 1.75, w: 0.1, d: 1.8, h: 1.0, tone: 'bois' },
  { roomId: 'chambre-1', x: 4.02, y: 1.75, w: 2.05, d: 1.65, h: 0.35, tone: 'bois' },
  { roomId: 'chambre-1', x: 4.02, y: 1.75, w: 2.0, d: 1.6, h: 0.18, base: 0.35, moelleux: true, tone: 'lin' },
  /* La couette déborde le matelas et retombe : c'est la seule chose qui la
     distingue d'un couvercle posé sur une caisse. */
  { roomId: 'chambre-1', x: 4.24, y: 1.75, w: 1.6, d: 1.72, h: 0.2, base: 0.45, moelleux: true, tone: 'petrole' },
  { roomId: 'chambre-1', x: 3.3, y: 1.35, w: 0.34, d: 0.62, h: 0.075, base: 0.58, moelleux: true, tone: 'terre' },
  { roomId: 'chambre-1', x: 3.3, y: 2.15, w: 0.34, d: 0.62, h: 0.075, base: 0.58, moelleux: true, tone: 'terre' },
  { roomId: 'chambre-1', x: 3.3, y: 0.6, w: 0.44, d: 0.44, h: 0.5, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-1', x: 3.3, y: 2.9, w: 0.44, d: 0.44, h: 0.5, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-1', x: 3.3, y: 0.6, w: 0.18, d: 0.18, h: 0.26, base: 0.5, tone: 'laiton' },
  { roomId: 'chambre-1', x: 3.3, y: 2.9, w: 0.18, d: 0.18, h: 0.26, base: 0.5, tone: 'laiton' },
  { roomId: 'chambre-1', x: 6.59, y: 1.6, w: 0.62, d: 1.9, h: 2.15, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'chambre-1', x: 4.9, y: 0.37, w: 0.9, d: 0.11, h: 0.6, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'chambre-1', x: 3.72, y: 0.4, w: 0.32, d: 0.17, h: 2.18, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-1', x: 6.12, y: 0.4, w: 0.32, d: 0.17, h: 2.18, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-1', x: 4.92, y: 0.4, w: 2.72, d: 0.028, h: 0.028, base: 2.28, tone: 'laiton' },
  { roomId: 'chambre-1', x: 4.9, y: 1.75, w: 0.3, d: 0.3, h: 0.05, base: 2.45, shape: 'plafonnier', tone: 'platre' },

  /* --------------------------------------------------------- chambre 2 --- */
  /* Le lit en 140, tête contre la façade est. La chambre reçoit aussi le
     bureau : c'est la pièce qu'un voyageur en télétravail vient chercher, et
     la montrer meublée en bureau dit plus qu'une ligne d'équipement. */
  { roomId: 'chambre-2', x: 10.845, y: 1.75, w: 0.09, d: 1.6, h: 0.95, tone: 'bois' },
  { roomId: 'chambre-2', x: 9.76, y: 1.75, w: 2.05, d: 1.45, h: 0.35, tone: 'bois' },
  { roomId: 'chambre-2', x: 9.76, y: 1.75, w: 2.0, d: 1.4, h: 0.18, base: 0.35, moelleux: true, tone: 'lin' },
  { roomId: 'chambre-2', x: 9.54, y: 1.75, w: 1.6, d: 1.52, h: 0.19, base: 0.45, moelleux: true, tone: 'petrole' },
  { roomId: 'chambre-2', x: 10.47, y: 1.75, w: 0.34, d: 0.72, h: 0.075, base: 0.58, moelleux: true, tone: 'terre' },
  { roomId: 'chambre-2', x: 10.35, y: 0.75, w: 0.42, d: 0.42, h: 0.48, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-2', x: 10.35, y: 2.78, w: 0.42, d: 0.42, h: 0.48, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-2', x: 10.35, y: 2.78, w: 0.18, d: 0.18, h: 0.24, base: 0.48, tone: 'laiton' },
  { roomId: 'chambre-2', x: 8.95, y: 0.62, w: 1.3, d: 0.58, h: 0.75, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-2', x: 8.5, y: 1.25, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'chambre-2', x: 8.5, y: 1.46, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'chambre-2', x: 7.21, y: 1.95, w: 0.24, d: 1.3, h: 1.8, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'chambre-2', x: 7.145, y: 0.85, w: 0.7, d: 0.11, h: 0.55, yaw: 90, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'chambre-2', x: 7.88, y: 0.4, w: 0.32, d: 0.17, h: 2.18, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-2', x: 10.32, y: 0.4, w: 0.32, d: 0.17, h: 2.18, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-2', x: 9.1, y: 0.4, w: 2.76, d: 0.028, h: 0.028, base: 2.28, tone: 'laiton' },
  { roomId: 'chambre-2', x: 9.0, y: 1.75, w: 0.3, d: 0.3, h: 0.05, base: 2.45, shape: 'plafonnier', tone: 'platre' },

  /* -------------------------------------------------------- dégagement --- */
  /* Un mètre deux de passage ne se meuble pas des deux côtés. On garde le
     fond, qui est un cul-de-sac, et les murs, qui ne coûtent rien. */
  { roomId: 'degagement', x: 10.6, y: 3.9, w: 0.34, d: 0.9, h: 0.8, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'degagement', x: 10.87, y: 3.9, w: 0.06, d: 0.8, h: 1.2, base: 0.9, tone: 'cabinet' },
  { roomId: 'degagement', x: 3.7, y: 3.42, w: 0.5, d: 0.05, h: 0.7, base: 1.1, tone: 'bois' },
  { roomId: 'degagement', x: 3.7, y: 3.445, w: 0.4, d: 0.02, h: 0.58, base: 1.16, tone: 'terre' },
  { roomId: 'degagement', x: 4.45, y: 3.42, w: 0.4, d: 0.05, h: 0.5, base: 1.2, tone: 'bois' },
  { roomId: 'degagement', x: 9.1, y: 3.42, w: 0.45, d: 0.05, h: 0.6, base: 1.15, tone: 'bois' },
  /* Deux plafonniers : le dégagement est la seule pièce sans fenêtre, et la
     visite le traverse quatre fois. Un seul point lumineux sur dix mètres
     soixante laissait les deux bouts dans le noir. */
  { roomId: 'degagement', x: 2.5, y: 3.95, w: 0.26, d: 0.26, h: 0.05, base: 2.45, shape: 'plafonnier', tone: 'platre' },
  { roomId: 'degagement', x: 8.0, y: 3.95, w: 0.26, d: 0.26, h: 0.05, base: 2.45, shape: 'plafonnier', tone: 'platre' },

  /* ----------------------------------------------------- salle de bain --- */
  /* La douche à l'italienne dans l'angle nord-est, hors de l'axe de la porte :
     sa paroi monte à 1,95 m et, plantée en face du seuil, elle remplissait
     tout le cadre — c'est exactement le défaut qu'on avait dû corriger dans la
     salle d'eau de l'appartement. */
  { roomId: 'salle-de-bain', x: 2.26, y: 5.1, w: 0.87, d: 1.0, h: 0.06, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 1.843, y: 5.1, w: 0.035, d: 1.0, h: 1.95, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 2.26, y: 5.5825, w: 0.87, d: 0.035, h: 1.95, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 2.66, y: 5.1, w: 0.06, d: 0.2, h: 1.15, base: 0.85, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 2.5, y: 5.1, w: 0.3, d: 0.22, h: 0.03, base: 1.98, tone: 'laiton' },
  // Le meuble double vasque et son miroir, sur le mur ouest.
  { roomId: 'salle-de-bain', x: 0.62, y: 6.3, w: 0.62, d: 1.3, h: 0.85, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'salle-de-bain', x: 0.63, y: 6.3, w: 0.64, d: 1.34, h: 0.05, base: 0.85, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 0.63, y: 5.9, w: 0.44, d: 0.34, h: 0.02, base: 0.885, tone: 'lin' },
  { roomId: 'salle-de-bain', x: 0.63, y: 6.7, w: 0.44, d: 0.34, h: 0.02, base: 0.885, tone: 'lin' },
  { roomId: 'salle-de-bain', x: 0.37, y: 5.9, w: 0.05, d: 0.05, h: 0.24, base: 0.9, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 0.37, y: 6.7, w: 0.05, d: 0.05, h: 0.24, base: 0.9, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 0.48, y: 5.9, w: 0.2, d: 0.035, h: 0.035, base: 1.115, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 0.48, y: 6.7, w: 0.2, d: 0.035, h: 0.035, base: 1.115, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 0.335, y: 6.3, w: 0.05, d: 1.3, h: 0.9, base: 1.05, tone: 'cabinet' },
  // Le sèche-serviettes et les WC, sur le mur est.
  { roomId: 'salle-de-bain', x: 2.655, y: 5.95, w: 0.09, d: 0.5, h: 0.9, base: 0.6, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 2.38, y: 6.6, w: 0.62, d: 0.38, h: 0.4, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 2.6, y: 6.6, w: 0.18, d: 0.38, h: 0.52, base: 0.4, tone: 'cabinet' },
  /* La baignoire sous la fenêtre sud. Une allège à 1,20 m passe au-dessus du
     rebord sans qu'on ait à choisir entre l'intimité et la lumière. */
  { roomId: 'salle-de-bain', x: 1.5, y: 7.72, w: 1.7, d: 0.75, h: 0.55, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 1.5, y: 7.72, w: 1.56, d: 0.62, h: 0.06, base: 0.49, tone: 'lin' },
  { roomId: 'salle-de-bain', x: 0.78, y: 7.72, w: 0.05, d: 0.05, h: 0.2, base: 0.55, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 0.9, y: 7.72, w: 0.22, d: 0.04, h: 0.04, base: 0.73, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 1.55, y: 6.9, w: 0.9, d: 0.6, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'salle-de-bain', x: 1.5, y: 6.2, w: 0.28, d: 0.28, h: 0.05, base: 2.45, shape: 'plafonnier', tone: 'platre' },

  /* ------------------------------------------------------------- séjour --- */
  /* L'enfilade et son cadre, contre le mur ouest, à l'entrée de la pièce. */
  { roomId: 'sejour', x: 3.2, y: 5.15, w: 0.5, d: 1.0, h: 0.75, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'sejour', x: 2.93, y: 5.15, w: 0.04, d: 0.9, h: 0.7, base: 1.0, tone: 'bois' },
  { roomId: 'sejour', x: 2.955, y: 5.15, w: 0.02, d: 0.78, h: 0.58, base: 1.06, tone: 'terre' },
  /* Le canapé tourne le dos au couloir et regarde la baie. Son dossier
     culmine à 81 cm : la caméra, à 1,60 m, passe au-dessus et voit le jardin
     en entrant — c'est tout l'intérêt de l'avoir mis dans cet axe-là. */
  { roomId: 'sejour', x: 4.6, y: 6.95, w: 2.6, d: 1.9, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'sejour', x: 4.6, y: 6.25, w: 2.1, d: 0.85, h: 0.13, tone: 'sombre' },
  { roomId: 'sejour', x: 4.6, y: 6.25, w: 2.2, d: 0.94, h: 0.32, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 4.6, y: 5.93, w: 2.2, d: 0.3, h: 0.68, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 3.63, y: 6.25, w: 0.26, d: 0.94, h: 0.5, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 5.57, y: 6.25, w: 0.26, d: 0.94, h: 0.5, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 4.1, y: 6.05, w: 0.42, d: 0.17, h: 0.38, base: 0.45, moelleux: true, tone: 'terre' },
  { roomId: 'sejour', x: 5.1, y: 6.05, w: 0.42, d: 0.17, h: 0.38, base: 0.45, moelleux: true, tone: 'terre' },
  { roomId: 'sejour', x: 4.6, y: 7.3, w: 1.1, d: 0.55, h: 0.38, shape: 'table', tone: 'bois' },
  // Le lampadaire, au bout du canapé.
  { roomId: 'sejour', x: 3.3, y: 6.35, w: 0.06, d: 0.06, h: 1.35, tone: 'sombre' },
  { roomId: 'sejour', x: 3.3, y: 6.35, w: 0.3, d: 0.3, h: 0.26, base: 1.35, shape: 'suspension', tone: 'lin' },
  { roomId: 'sejour', x: 3.25, y: 7.7, w: 0.36, d: 0.36, h: 1.25, shape: 'plante', tone: 'terre' },

  // La table, six couverts, dans l'axe de l'ouverture du couloir.
  { roomId: 'sejour', x: 7.1, y: 7.15, w: 1.5, d: 0.9, h: 0.75, shape: 'table', tone: 'bois' },
  { roomId: 'sejour', x: 6.55, y: 6.45, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 6.55, y: 6.24, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 7.65, y: 6.45, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 7.65, y: 6.24, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 6.55, y: 7.85, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 6.55, y: 8.06, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 7.65, y: 7.85, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 7.65, y: 8.06, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 7.1, y: 7.15, w: 0.16, d: 0.16, h: 0.03, base: 2.47, shape: 'rosace', tone: 'platre' },
  { roomId: 'sejour', x: 7.1, y: 7.15, w: 0.025, d: 0.025, h: 0.5, base: 1.97, tone: 'laiton' },
  { roomId: 'sejour', x: 7.1, y: 7.15, w: 0.42, d: 0.42, h: 0.27, base: 1.7, shape: 'suspension', tone: 'laiton' },

  /* La cuisine, en linéaire contre le mur nord, et l'îlot qui la sépare du
     séjour. Le plan de travail est d'une autre teinte que les caissons : c'est
     ce qui la fait lire comme une cuisine plutôt que comme un mur de placards,
     et c'est vrai de presque toutes les cuisines. */
  { roomId: 'sejour', x: 8.15, y: 4.9, w: 1.5, d: 0.62, h: 0.9, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'sejour', x: 9.9, y: 4.9, w: 1.8, d: 0.62, h: 0.9, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'sejour', x: 9.1, y: 4.91, w: 3.4, d: 0.64, h: 0.045, base: 0.9, tone: 'sombre' },
  { roomId: 'sejour', x: 9.1, y: 4.63, w: 3.4, d: 0.05, h: 0.5, base: 0.945, tone: 'cabinet' },
  { roomId: 'sejour', x: 8.3, y: 4.93, w: 0.5, d: 0.4, h: 0.012, base: 0.938, tone: 'sombre' },
  { roomId: 'sejour', x: 8.3, y: 4.72, w: 0.036, d: 0.036, h: 0.28, base: 0.945, tone: 'laiton' },
  { roomId: 'sejour', x: 8.3, y: 4.81, w: 0.03, d: 0.2, h: 0.03, base: 1.2, tone: 'laiton' },
  { roomId: 'sejour', x: 9.9, y: 4.93, w: 0.6, d: 0.5, h: 0.02, base: 0.945, tone: 'sombre' },
  { roomId: 'sejour', x: 9.9, y: 4.81, w: 0.6, d: 0.42, h: 0.5, base: 1.55, tone: 'cabinet' },
  { roomId: 'sejour', x: 8.15, y: 4.76, w: 1.5, d: 0.34, h: 0.65, base: 1.45, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'sejour', x: 9.0, y: 6.6, w: 2.0, d: 0.9, h: 0.92, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'sejour', x: 9.0, y: 6.6, w: 2.06, d: 0.94, h: 0.05, base: 0.92, tone: 'sombre' },
  { roomId: 'sejour', x: 8.4, y: 7.35, w: 0.36, d: 0.36, h: 0.68, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 9.6, y: 7.35, w: 0.36, d: 0.36, h: 0.68, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 8.4, y: 6.6, w: 0.16, d: 0.16, h: 0.03, base: 2.47, shape: 'rosace', tone: 'platre' },
  { roomId: 'sejour', x: 9.6, y: 6.6, w: 0.16, d: 0.16, h: 0.03, base: 2.47, shape: 'rosace', tone: 'platre' },
  { roomId: 'sejour', x: 8.4, y: 6.6, w: 0.025, d: 0.025, h: 0.47, base: 2.0, tone: 'laiton' },
  { roomId: 'sejour', x: 9.6, y: 6.6, w: 0.025, d: 0.025, h: 0.47, base: 2.0, tone: 'laiton' },
  { roomId: 'sejour', x: 8.4, y: 6.6, w: 0.3, d: 0.3, h: 0.26, base: 1.74, shape: 'suspension', tone: 'laiton' },
  { roomId: 'sejour', x: 9.6, y: 6.6, w: 0.3, d: 0.3, h: 0.26, base: 1.74, shape: 'suspension', tone: 'laiton' },

  /* Les rideaux de la baie et de la fenêtre est. Ils débordent l'ouverture
     des deux côtés et s'arrêtent à six centimètres du sol : posés au ras du
     tableau, ils fermeraient la baie au lieu de l'encadrer. */
  { roomId: 'sejour', x: 4.95, y: 7.98, w: 0.32, d: 0.17, h: 2.3, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 9.05, y: 7.98, w: 0.32, d: 0.17, h: 2.3, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 7.0, y: 7.98, w: 4.42, d: 0.028, h: 0.028, base: 2.42, tone: 'laiton' },
  { roomId: 'sejour', x: 10.72, y: 5.42, w: 0.17, d: 0.32, h: 2.18, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 10.72, y: 7.42, w: 0.17, d: 0.32, h: 2.18, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 10.75, y: 6.42, w: 0.028, d: 2.32, h: 0.028, base: 2.28, tone: 'laiton' },
];

/* ============================================================== légendes === */

export const MAISON_OPENING: CaptionText = {
  kicker: 'Maison de démonstration · plain-pied',
  title: 'Deux chambres, 94 m²',
  text: 'Faites défiler. La porte s’ouvre et vous entrez.',
};

export const MAISON_CAPTIONS: Record<string, CaptionText> = {
  entree: {
    kicker: 'Entrée',
    title: '9,2 m²',
    text: 'Un vrai sas, pas un bout de couloir : penderie fermée, console, et de la place pour poser deux valises.',
  },
  degagement: {
    kicker: 'Dégagement',
    title: '13,4 m²',
    text: 'Dix mètres soixante de couloir qui desservent les cinq autres pièces. 1,02 m de passage, sans marche.',
  },
  'chambre-1': {
    kicker: 'Chambre principale',
    title: '13,9 m²',
    text: 'Lit en 160 avec ses deux chevets, armoire trois portes, et 90 cm de passage de chaque côté du lit.',
  },
  'chambre-2': {
    kicker: 'Deuxième chambre',
    title: '13,9 m²',
    text: 'Lit en 140 et un vrai bureau sous la fenêtre — de quoi travailler une semaine sans s’installer sur la table.',
  },
  'salle-de-bain': {
    kicker: 'Salle de bain',
    title: '10,9 m²',
    text: 'Baignoire sous la fenêtre, douche à l’italienne, double vasque et WC. Les quatre, dans la même pièce.',
  },
  sejour: {
    kicker: 'Séjour & cuisine',
    title: '32,8 m²',
    text: 'Une baie de 3,60 m sur le jardin, une cuisine ouverte de 3,40 m et un îlot. La table tient six couverts.',
  },
};

export const MAISON_CLOSING: CaptionText = {
  kicker: 'Voilà',
  title: 'C’est ce que verra votre voyageur',
  text: 'Mêmes murs, mêmes distances : le volume vient du plan relevé, pas d’une image de synthèse improvisée.',
};

/** Ce qui s'affiche autour de la visite : le bien tel qu'on l'annoncerait. */
export const MAISON_IDENTITY = {
  name: 'Maison des Tilleuls',
  city: 'Maison de démonstration — plain-pied avec jardin',
  area: 94.1,
  /** Au sens français : séjour et chambres. Deux chambres, un séjour. */
  rooms: 3,
  bedrooms: 2,
  bathrooms: 1,
  sleeps: 4,
  /** Bien fictif : à dire, toujours, et sans détour. */
  disclaimer:
    'Maison de démonstration. Les dimensions et la circulation sont cohérentes de bout en bout ; le bien, lui, est fictif — il n’est ni à louer ni à visiter.',
};

/* ============================================================== l'annonce === */

/**
 * L'annonce fictive.
 *
 * Elle existe parce que le produit ne se juge pas sur une visite seule. Un
 * propriétaire qui regarde une démonstration se demande une chose : « à quoi
 * ressemblera **mon annonce** avec ça dedans ». Une visite posée dans le vide
 * ne répond pas ; une annonce complète — prix à la nuit, capacité, équipements,
 * règles — avec la visite en tête, y répond d'un coup d'œil.
 *
 * Deux précautions, et elles ne sont pas négociables :
 *
 *  · **rien ici ne se fait passer pour un vrai bien.** Le nom, l'adresse, le
 *    prix sont inventés, la page le dit en clair et à plusieurs endroits, et le
 *    bien n'est ni à louer ni à visiter ;
 *  · **aucun avis, aucune note, aucun historique de réservation.** Une note en
 *    étoiles inventée est un faux document, quelle que soit la mention qui
 *    l'accompagne — et c'est précisément le genre de retouche qu'on reproche
 *    aux annonces qu'on veut remplacer.
 *
 * Le prix à la nuit n'a rien à voir avec le prix de Volume3D. La page les
 * sépare explicitement : l'un est ce que le voyageur paierait, l'autre ce que
 * le propriétaire paie une fois.
 */
export const MAISON_LISTING = {
  /** Ce que paierait le voyageur. Fictif, comme le reste. */
  nightly: 149,
  cleaning: 70,
  minimumNights: 2,
  /** Les cinq chiffres qu'un voyageur lit avant tout le reste. */
  facts: [
    { label: 'Voyageurs', value: '4' },
    { label: 'Chambres', value: '2' },
    { label: 'Lits', value: '2' },
    { label: 'Salle de bain', value: '1' },
    { label: 'Surface', value: '94 m²' },
  ],
  equipment: [
    {
      group: 'Les pièces',
      items: [
        'Séjour de 32,8 m² ouvert sur la cuisine',
        'Baie vitrée de 3,60 m sur le jardin',
        'Chambre principale : lit en 160, armoire trois portes',
        'Deuxième chambre : lit en 140, bureau sous la fenêtre',
        'Salle de bain de 10,9 m² : baignoire, douche à l’italienne, double vasque, WC',
        'Entrée fermée avec penderie',
      ],
    },
    {
      group: 'La cuisine',
      items: [
        'Cuisine ouverte, plan de travail de 3,40 m',
        'Îlot central de 2 m avec deux tabourets',
        'Plaque, four, lave-vaisselle',
        'Table de six couverts',
      ],
    },
    {
      group: 'Le confort',
      items: [
        'Plain-pied intégral, aucune marche',
        'Couloir de 1,02 m de passage',
        'Lave-linge',
        'Wi-Fi fibre',
        'Chauffage dans chaque pièce',
        'Draps et serviettes fournis',
      ],
    },
  ],
  rules: [
    'Arrivée à partir de 16 h, départ avant 11 h',
    'Deux nuits minimum',
    'Non-fumeur',
    'Animaux acceptés sur demande',
  ],
};
