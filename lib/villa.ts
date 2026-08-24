/**
 * La villa.
 *
 * Troisième décor, et le plus grand : cent quatre-vingt-dix mètres carrés de
 * plain-pied autour d'une galerie centrale, avec une piscine au sud.
 *
 * Il ne répète ni l'appartement ni la maison, et la raison n'est pas la
 * surface. Un deux-pièces se parcourt en ligne ; une maison de plain-pied
 * ajoute un couloir. Une villa ajoute **le dehors comme pièce** : trois baies
 * qui donnent sur la même terrasse, un séjour qu'on traverse dans sa longueur,
 * une suite qui a sa propre salle d'eau. Ce que la visite doit rendre ici,
 * c'est qu'on peut aller d'un bout à l'autre sans repasser deux fois au même
 * endroit — et ça, aucune photographie d'annonce ne le montre.
 *
 * Mêmes règles que les deux autres décors, et pour les mêmes raisons :
 *
 *  · **cotes cohérentes de bout en bout**, mais le bien est fictif et la page
 *    le dit ;
 *  · **on se cale sur la face du mur**, jamais sur la ligne du plan — trente
 *    centimètres de peau contre une façade, neuf contre une cloison ;
 *  · **rien dans l'axe d'une porte**, sinon la caméra le traverse en passant.
 *
 * Les huit contrôles de `tests/decors.test.ts` tournent dessus.
 */

import type { PlanDoor, PlanRoom } from './types.ts';
import type { CaptionText } from './journey-path.ts';
import type { Massing } from './showcase.ts';

/*
 * Le plan, en une image.
 *
 *        0          5,6        9,8      13,0        17,6
 *   0    ┌───────────┬──────────┬─────────┬──────────┐
 *        │           │  ENTRÉE  │  SALLE  │ CHAMBRE 2│   ← rue
 *        │           │          │ DE BAIN │          │
 *   4,3  │  SÉJOUR   ├──────────┴─────────┴──────────┤
 *        │     &     │           GALERIE              │
 *   5,7  │  CUISINE  ├──────────┬──────────┬─────────┤
 *        │           │ CHAMBRE 3│  SUITE   │  BAIN   │
 *        │           │          │          │ DE LA   │
 *  10,8  └───────────┴──────────┴──────────┴─────────┘   ← terrasse, piscine
 *
 * Le séjour tient tout le pignon ouest, sur les dix mètres quatre-vingts de
 * profondeur : c'est lui qui donne son échelle à la villa, et c'est le seul
 * volume du plan qu'on ne peut pas cadrer d'un seul regard. La galerie dessert
 * les cinq autres pièces et ne dessert qu'elles — on ne la traverse jamais
 * pour aller ailleurs qu'où l'on va.
 */

/** Deux mètres quatre-vingt-dix : la hauteur qui distingue une villa d'une maison. */
const HAUTEUR = 2.9;

export const VILLA_ROOMS: PlanRoom[] = [
  {
    id: 'sejour',
    name: 'Séjour & cuisine',
    height: HAUTEUR,
    points: [
      { x: 0, y: 0 },
      { x: 5.6, y: 0 },
      { x: 5.6, y: 10.8 },
      { x: 0, y: 10.8 },
    ],
  },
  {
    id: 'entree',
    name: 'Entrée',
    height: HAUTEUR,
    points: [
      { x: 5.6, y: 0 },
      { x: 9.8, y: 0 },
      { x: 9.8, y: 4.3 },
      { x: 5.6, y: 4.3 },
    ],
  },
  {
    id: 'salle-de-bain',
    name: 'Salle de bain',
    height: HAUTEUR,
    points: [
      { x: 9.8, y: 0 },
      { x: 13, y: 0 },
      { x: 13, y: 4.3 },
      { x: 9.8, y: 4.3 },
    ],
  },
  {
    id: 'chambre-2',
    name: 'Chambre double',
    height: HAUTEUR,
    points: [
      { x: 13, y: 0 },
      { x: 17.6, y: 0 },
      { x: 17.6, y: 4.3 },
      { x: 13, y: 4.3 },
    ],
  },
  {
    id: 'galerie',
    name: 'Galerie',
    height: HAUTEUR,
    points: [
      { x: 5.6, y: 4.3 },
      { x: 17.6, y: 4.3 },
      { x: 17.6, y: 5.7 },
      { x: 5.6, y: 5.7 },
    ],
  },
  {
    id: 'chambre-3',
    name: 'Chambre sur terrasse',
    height: HAUTEUR,
    points: [
      { x: 5.6, y: 5.7 },
      { x: 10.4, y: 5.7 },
      { x: 10.4, y: 10.8 },
      { x: 5.6, y: 10.8 },
    ],
  },
  {
    id: 'suite',
    name: 'Suite parentale',
    height: HAUTEUR,
    points: [
      { x: 10.4, y: 5.7 },
      { x: 14.8, y: 5.7 },
      { x: 14.8, y: 10.8 },
      { x: 10.4, y: 10.8 },
    ],
  },
  {
    id: 'bain-suite',
    name: 'Salle d’eau de la suite',
    height: HAUTEUR,
    points: [
      { x: 14.8, y: 5.7 },
      { x: 17.6, y: 5.7 },
      { x: 17.6, y: 10.8 },
      { x: 14.8, y: 10.8 },
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
): PlanDoor => ({ id, planId: 'villa', from, to, a, b, kind, height, sill });

/** Un point de la façade sud, celle de la terrasse. Quatre ouvertures y sont
 *  posées ; écrire `10.8` huit fois, c'est se tromper une fois. */
const sud = (x: number) => ({ x, y: 10.8 });

export const VILLA_DOORS: PlanDoor[] = [
  // La porte d'entrée, sur la façade rue. `to` vide : elle ne mène à aucune
  // pièce du plan, et c'est ce qui la désigne comme porte d'entrée.
  opening('porte', 'entree', '', { x: 7, y: 0 }, { x: 8.2, y: 0 }, 'door', 2.4, 0),

  /* L'entrée ouvre sur deux choses, et c'est tout le plan de la villa : à
     gauche le séjour, en grand et sans battant ; en face la galerie, qui mène
     aux chambres. On voit donc le volume avant les couloirs. */
  opening('d-sejour', 'entree', 'sejour', { x: 5.6, y: 1.4 }, { x: 5.6, y: 3.6 }, 'opening', 2.5, 0),
  opening('d-galerie', 'entree', 'galerie', { x: 6.4, y: 4.3 }, { x: 7.6, y: 4.3 }, 'opening', 2.5, 0),

  opening('d-bain', 'salle-de-bain', 'galerie', { x: 10.9, y: 4.3 }, { x: 11.7, y: 4.3 }, 'door', 2.3, 0),
  opening('d-chambre-2', 'chambre-2', 'galerie', { x: 13.4, y: 4.3 }, { x: 14.3, y: 4.3 }, 'door', 2.3, 0),
  opening('d-chambre-3', 'chambre-3', 'galerie', { x: 6.2, y: 5.7 }, { x: 7.1, y: 5.7 }, 'door', 2.3, 0),
  opening('d-suite', 'suite', 'galerie', { x: 13.4, y: 5.7 }, { x: 14.4, y: 5.7 }, 'door', 2.3, 0),
  /* La salle d'eau ne s'ouvre que sur la suite. Elle touche pourtant la
     galerie — elle pourrait donc y avoir une seconde porte — et c'est
     exactement ce qui la ferait cesser d'être une suite. */
  opening('d-bain-suite', 'bain-suite', 'suite', { x: 14.8, y: 6.4 }, { x: 14.8, y: 7.3 }, 'door', 2.3, 0),

  /* Les trois baies du sud, sur la même terrasse. Allèges à quinze
     centimètres : de l'intérieur, la ligne d'eau de la piscine est dans le
     champ, et c'est l'argument de la villa. */
  opening('baie-sejour', 'sejour', '', sud(1), sud(4.8), 'window', 2.6, 0.1),
  opening('baie-chambre-3', 'chambre-3', '', sud(6.6), sud(9.4), 'window', 2.55, 0.15),
  opening('baie-suite', 'suite', '', sud(11.2), sud(13.8), 'window', 2.55, 0.15),
  opening('f-bain-suite', 'bain-suite', '', sud(15.6), sud(16.8), 'window', 2.3, 1.3),

  // Le pignon ouest et la façade rue.
  opening('f-sejour-ouest', 'sejour', '', { x: 0, y: 2.2 }, { x: 0, y: 4.6 }, 'window', 2.5, 0.5),
  /* Pas de fenêtre dans l'entrée, et c'est un choix de cadrage autant que
     d'architecture. Une pièce qui a un jour se cadre sur son jour ; une pièce
     qui n'en a pas se cadre sur ce qu'elle ouvre. Un sas de villa n'a rien à
     montrer de lui-même — ce qu'il a à dire est qu'à gauche il y a soixante
     mètres carrés de séjour et en face une galerie de onze mètres. Avec son
     imposte latérale, la caméra regardait poliment le petit carreau, à cent dix
     degrés de l'axe qui traverse la maison. */
  opening('f-bain', 'salle-de-bain', '', { x: 10.6, y: 0 }, { x: 11.8, y: 0 }, 'window', 2.3, 1.3),
  opening('f-chambre-2', 'chambre-2', '', { x: 14.2, y: 0 }, { x: 16.4, y: 0 }, 'window', 2.4, 0.9),
  opening('f-chambre-2-est', 'chambre-2', '', { x: 17.6, y: 1.4 }, { x: 17.6, y: 3.2 }, 'window', 2.4, 0.9),
];

/* ============================================================== mobilier === */

/*
 * L'implantation.
 *
 * Les faces intérieures, une fois retirée la peau de chaque mur — c'est sur
 * elles qu'on se cale, jamais sur les lignes du plan :
 *
 *   séjour          x 0,30 → 5,51     y 0,30 → 10,50
 *   entrée          x 5,69 → 9,71     y 0,30 → 4,21
 *   salle de bain   x 9,89 → 12,91    y 0,30 → 4,21
 *   chambre 2       x 13,09 → 17,30   y 0,30 → 4,21
 *   galerie         x 5,69 → 17,30    y 4,39 → 5,61
 *   chambre 3       x 5,69 → 10,31    y 5,79 → 10,50
 *   suite           x 10,49 → 14,71   y 5,79 → 10,50
 *   salle d'eau     x 14,89 → 17,30   y 5,79 → 10,50
 */
export const VILLA_MASSING: Massing[] = [
  /* ------------------------------------------------------------- séjour --- */
  /* La cuisine tient le pignon nord et le retour ouest ; l'îlot la sépare de
     la salle à manger, qui tient le milieu ; le salon regarde la baie. Trois
     usages sur dix mètres, sans un seul mur entre eux — c'est ce que la villa
     a et que la maison n'a pas, et c'est ce que la visite doit rendre. */
  { roomId: 'sejour', x: 0.62, y: 1.0, w: 0.64, d: 1.2, h: 2.3, shape: 'placard', portes: 2, tone: 'cabinet' },
  { roomId: 'sejour', x: 2.5, y: 0.61, w: 2.9, d: 0.62, h: 0.92, shape: 'placard', portes: 4, tone: 'cabinet' },
  { roomId: 'sejour', x: 2.5, y: 0.62, w: 2.94, d: 0.64, h: 0.05, base: 0.92, tone: 'sombre' },
  { roomId: 'sejour', x: 2.5, y: 0.335, w: 2.94, d: 0.05, h: 0.55, base: 0.97, tone: 'cabinet' },
  { roomId: 'sejour', x: 1.7, y: 0.64, w: 0.55, d: 0.42, h: 0.012, base: 0.958, tone: 'sombre' },
  { roomId: 'sejour', x: 1.7, y: 0.42, w: 0.038, d: 0.038, h: 0.3, base: 0.965, tone: 'laiton' },
  { roomId: 'sejour', x: 1.7, y: 0.52, w: 0.032, d: 0.22, h: 0.032, base: 1.25, tone: 'laiton' },
  { roomId: 'sejour', x: 3.2, y: 0.64, w: 0.7, d: 0.5, h: 0.02, base: 0.965, tone: 'sombre' },
  { roomId: 'sejour', x: 3.2, y: 0.52, w: 0.7, d: 0.44, h: 0.55, base: 1.6, tone: 'cabinet' },
  { roomId: 'sejour', x: 1.75, y: 0.47, w: 1.4, d: 0.34, h: 0.7, base: 1.6, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'sejour', x: 2.6, y: 2.3, w: 2.6, d: 1.0, h: 0.95, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'sejour', x: 2.6, y: 2.3, w: 2.66, d: 1.06, h: 0.05, base: 0.95, tone: 'sombre' },
  { roomId: 'sejour', x: 1.8, y: 3.15, w: 0.38, d: 0.38, h: 0.72, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 3.4, y: 3.15, w: 0.38, d: 0.38, h: 0.72, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 1.9, y: 2.3, w: 0.16, d: 0.16, h: 0.03, base: 2.87, shape: 'rosace', tone: 'platre' },
  { roomId: 'sejour', x: 3.3, y: 2.3, w: 0.16, d: 0.16, h: 0.03, base: 2.87, shape: 'rosace', tone: 'platre' },
  { roomId: 'sejour', x: 1.9, y: 2.3, w: 0.025, d: 0.025, h: 0.55, base: 2.32, tone: 'laiton' },
  { roomId: 'sejour', x: 3.3, y: 2.3, w: 0.025, d: 0.025, h: 0.55, base: 2.32, tone: 'laiton' },
  { roomId: 'sejour', x: 1.9, y: 2.3, w: 0.32, d: 0.32, h: 0.28, base: 2.04, shape: 'suspension', tone: 'laiton' },
  { roomId: 'sejour', x: 3.3, y: 2.3, w: 0.32, d: 0.32, h: 0.28, base: 2.04, shape: 'suspension', tone: 'laiton' },

  /*
   * La salle à manger est décalée de cinquante-cinq centimètres vers le sud,
   * et ce n'est pas une question de composition.
   *
   * La caméra s'arrête aux deux tiers du chemin entre la porte et le centre de
   * la pièce — ici (3,72 ; 4,45), mesuré. Or le centre géométrique d'un séjour
   * de 5,60 × 10,80 est exactement l'endroit où l'on met une table, donc
   * l'endroit où pend une suspension. Le résultat en image était une ellipse
   * dorée en travers du quart supérieur du cadre, à un mètre trente de
   * l'objectif : on ne voyait plus la pièce, on voyait un abat-jour.
   *
   * L'abat-jour rétrécit aussi de 46 à 38 centimètres et monte de dix, ce qui
   * est de toute façon la bonne cote pour une table de six.
   */
  { roomId: 'sejour', x: 2.9, y: 5.95, w: 2.0, d: 1.0, h: 0.76, shape: 'table', tone: 'bois' },
  { roomId: 'sejour', x: 2.2, y: 5.1, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 2.9, y: 5.1, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 3.6, y: 5.1, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 2.2, y: 4.89, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 2.9, y: 4.89, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 3.6, y: 4.89, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 2.2, y: 6.8, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 2.9, y: 6.8, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 3.6, y: 6.8, w: 0.44, d: 0.44, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'sejour', x: 2.2, y: 7.01, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 2.9, y: 7.01, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 3.6, y: 7.01, w: 0.44, d: 0.05, h: 0.44, base: 0.46, tone: 'sombre' },
  { roomId: 'sejour', x: 2.9, y: 5.95, w: 0.16, d: 0.16, h: 0.03, base: 2.87, shape: 'rosace', tone: 'platre' },
  { roomId: 'sejour', x: 2.9, y: 5.95, w: 0.025, d: 0.025, h: 0.45, base: 2.42, tone: 'laiton' },
  { roomId: 'sejour', x: 2.9, y: 5.95, w: 0.38, d: 0.38, h: 0.3, base: 2.12, shape: 'suspension', tone: 'laiton' },

  { roomId: 'sejour', x: 2.7, y: 8.5, w: 3.4, d: 2.6, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'sejour', x: 2.7, y: 7.85, w: 2.9, d: 0.9, h: 0.14, tone: 'sombre' },
  { roomId: 'sejour', x: 2.7, y: 7.85, w: 3.0, d: 1.0, h: 0.34, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 2.7, y: 7.5, w: 3.0, d: 0.3, h: 0.72, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 1.34, y: 7.85, w: 0.28, d: 1.0, h: 0.54, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 4.06, y: 7.85, w: 0.28, d: 1.0, h: 0.54, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 2.0, y: 7.62, w: 0.44, d: 0.18, h: 0.4, base: 0.48, moelleux: true, tone: 'terre' },
  { roomId: 'sejour', x: 3.4, y: 7.62, w: 0.44, d: 0.18, h: 0.4, base: 0.48, moelleux: true, tone: 'terre' },
  { roomId: 'sejour', x: 2.7, y: 9.15, w: 1.3, d: 0.6, h: 0.36, shape: 'table', tone: 'bois' },
  { roomId: 'sejour', x: 0.95, y: 9.0, w: 0.74, d: 0.76, h: 0.13, tone: 'sombre' },
  { roomId: 'sejour', x: 0.95, y: 9.0, w: 0.82, d: 0.84, h: 0.32, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'sejour', x: 0.95, y: 8.62, w: 0.82, d: 0.24, h: 0.58, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'sejour', x: 5.26, y: 6.6, w: 0.5, d: 1.8, h: 0.7, shape: 'placard', portes: 3, tone: 'bois' },
  { roomId: 'sejour', x: 5.475, y: 6.6, w: 0.05, d: 1.1, h: 0.8, base: 1.05, tone: 'bois' },
  { roomId: 'sejour', x: 5.45, y: 6.6, w: 0.02, d: 0.94, h: 0.66, base: 1.12, tone: 'terre' },
  { roomId: 'sejour', x: 5.1, y: 9.4, w: 0.42, d: 0.42, h: 1.5, shape: 'plante', tone: 'terre' },
  { roomId: 'sejour', x: 0.75, y: 10.38, w: 0.24, d: 0.18, h: 2.66, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 5.05, y: 10.38, w: 0.24, d: 0.18, h: 2.66, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 2.9, y: 10.38, w: 4.64, d: 0.03, h: 0.03, base: 2.78, tone: 'laiton' },
  { roomId: 'sejour', x: 0.48, y: 1.95, w: 0.18, d: 0.24, h: 2.6, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 0.48, y: 4.85, w: 0.18, d: 0.24, h: 2.6, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'sejour', x: 0.48, y: 3.4, w: 0.03, d: 3.27, h: 0.03, base: 2.72, tone: 'laiton' },

  /* ------------------------------------------------------------- entrée --- */
  { roomId: 'entree', x: 9.41, y: 0.85, w: 0.6, d: 1.0, h: 2.4, shape: 'placard', portes: 2, tone: 'cabinet' },
  { roomId: 'entree', x: 9.46, y: 2.2, w: 0.5, d: 1.4, h: 0.85, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'entree', x: 9.66, y: 2.2, w: 0.06, d: 1.2, h: 1.1, base: 1.0, tone: 'cabinet' },
  { roomId: 'entree', x: 8.8, y: 3.95, w: 1.4, d: 0.42, h: 0.45, shape: 'table', tone: 'bois' },
  { roomId: 'entree', x: 6.05, y: 3.9, w: 0.4, d: 0.4, h: 1.3, shape: 'plante', tone: 'terre' },
  { roomId: 'entree', x: 7.6, y: 1.5, w: 1.8, d: 1.2, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'entree', x: 7.6, y: 2.2, w: 0.34, d: 0.34, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },

  /* ------------------------------------------------------ salle de bain --- */
  { roomId: 'salle-de-bain', x: 11.2, y: 0.425, w: 1.7, d: 0.11, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 11.2, y: 1.075, w: 1.7, d: 0.11, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 10.405, y: 0.75, w: 0.11, d: 0.76, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 11.995, y: 0.75, w: 0.11, d: 0.76, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 11.2, y: 0.75, w: 1.48, d: 0.54, h: 0.14, tone: 'lin' },
  { roomId: 'salle-de-bain', x: 10.48, y: 0.75, w: 0.05, d: 0.05, h: 0.22, base: 0.58, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 10.62, y: 0.75, w: 0.24, d: 0.04, h: 0.04, base: 0.77, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 12.61, y: 2.3, w: 0.6, d: 1.5, h: 0.88, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'salle-de-bain', x: 12.62, y: 2.3, w: 0.58, d: 1.54, h: 0.05, base: 0.88, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 12.62, y: 1.95, w: 0.42, d: 0.34, h: 0.02, base: 0.91, tone: 'lin' },
  { roomId: 'salle-de-bain', x: 12.62, y: 2.65, w: 0.42, d: 0.34, h: 0.02, base: 0.91, tone: 'lin' },
  { roomId: 'salle-de-bain', x: 12.36, y: 1.95, w: 0.05, d: 0.05, h: 0.26, base: 0.93, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 12.36, y: 2.65, w: 0.05, d: 0.05, h: 0.26, base: 0.93, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 12.48, y: 1.95, w: 0.22, d: 0.04, h: 0.04, base: 1.16, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 12.48, y: 2.65, w: 0.22, d: 0.04, h: 0.04, base: 1.16, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 12.865, y: 2.3, w: 0.05, d: 1.5, h: 1.0, base: 1.1, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 12.35, y: 3.62, w: 1.0, d: 0.9, h: 0.06, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 11.875, y: 3.62, w: 0.045, d: 0.9, h: 2.1, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 12.35, y: 3.1425, w: 1.0, d: 0.045, h: 2.1, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 12.8, y: 3.62, w: 0.06, d: 0.22, h: 1.2, base: 0.9, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 12.6, y: 3.62, w: 0.32, d: 0.24, h: 0.03, base: 2.15, tone: 'laiton' },
  { roomId: 'salle-de-bain', x: 10.15, y: 2.5, w: 0.52, d: 0.4, h: 0.42, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 9.99, y: 2.5, w: 0.2, d: 0.4, h: 0.5, base: 0.42, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 9.935, y: 3.4, w: 0.09, d: 0.6, h: 1.0, base: 0.65, tone: 'cabinet' },
  { roomId: 'salle-de-bain', x: 11.4, y: 2.2, w: 0.9, d: 0.6, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'salle-de-bain', x: 11.4, y: 2.2, w: 0.3, d: 0.3, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },

  /* ---------------------------------------------------------- chambre 2 --- */
  /* Le lit est repoussé de quarante centimètres vers l'est. Là où il était,
     sa face ouest tombait à huit centimètres du point d'arrêt de la caméra,
     (14,87 ; 2,79) : l'image de la chambre était un mur de matelas. Un seul
     chevet, du côté où l'on entre — l'autre n'avait plus la place, et une
     chambre d'amis n'en demande pas deux. */
  { roomId: 'chambre-2', x: 16.2, y: 4.16, w: 1.9, d: 0.1, h: 1.1, tone: 'bois' },
  { roomId: 'chambre-2', x: 16.2, y: 3.05, w: 1.7, d: 2.1, h: 0.36, tone: 'bois' },
  { roomId: 'chambre-2', x: 16.2, y: 3.05, w: 1.65, d: 2.05, h: 0.19, base: 0.36, moelleux: true, tone: 'lin' },
  { roomId: 'chambre-2', x: 16.2, y: 3.3, w: 1.72, d: 1.62, h: 0.21, base: 0.47, moelleux: true, tone: 'petrole' },
  { roomId: 'chambre-2', x: 15.75, y: 2.32, w: 0.66, d: 0.4, h: 0.08, base: 0.6, moelleux: true, tone: 'terre' },
  { roomId: 'chambre-2', x: 16.65, y: 2.32, w: 0.66, d: 0.4, h: 0.08, base: 0.6, moelleux: true, tone: 'terre' },
  { roomId: 'chambre-2', x: 15.0, y: 3.9, w: 0.46, d: 0.46, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-2', x: 15.0, y: 3.9, w: 0.2, d: 0.2, h: 0.28, base: 0.52, tone: 'laiton' },
  { roomId: 'chambre-2', x: 13.5, y: 0.62, w: 0.8, d: 0.64, h: 2.4, shape: 'placard', portes: 2, tone: 'cabinet' },
  { roomId: 'chambre-2', x: 17.0, y: 1.3, w: 0.6, d: 1.2, h: 0.75, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-2', x: 16.35, y: 1.5, w: 0.46, d: 0.46, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'chambre-2', x: 16.35, y: 1.28, w: 0.46, d: 0.05, h: 0.46, base: 0.46, tone: 'sombre' },
  { roomId: 'chambre-2', x: 14.08, y: 0.42, w: 0.24, d: 0.18, h: 2.5, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-2', x: 16.58, y: 0.42, w: 0.24, d: 0.18, h: 2.5, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-2', x: 15.33, y: 0.42, w: 2.78, d: 0.03, h: 0.03, base: 2.62, tone: 'laiton' },
  /* La fenêtre latérale reste nue, et c'est le seul endroit du décor où
     j'accepte une fenêtre sans rideau. Le lit repoussé vers l'est et le bureau
     posé dessous occupent toute la hauteur du tableau : un pan de tissu s'y
     serait enfoncé dans l'un ou dans l'autre. Le mur est habillé par ce qui
     s'y trouve, ce qui est la vraie raison d'habiller un mur. */
  { roomId: 'chambre-2', x: 15.4, y: 2.2, w: 0.32, d: 0.32, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },

  /* ------------------------------------------------------------ galerie --- */
  /* Un mètre vingt-deux de passage sur onze mètres soixante. On ne meuble que
     le cul-de-sac de l'est et les murs : une galerie se traverse, et ce qu'elle
     a à dire est qu'elle mène quelque part. */
  { roomId: 'galerie', x: 17.05, y: 5.0, w: 0.5, d: 1.0, h: 0.8, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'galerie', x: 17.26, y: 5.0, w: 0.06, d: 0.9, h: 1.4, base: 0.9, tone: 'cabinet' },
  /*
   * Les cadres, et où ils ne doivent pas être.
   *
   * La caméra s'arrête à (10,06 ; 4,77) et regarde vers l'est : dans une
   * galerie d'un mètre vingt-deux, un cadre accroché à cette abscisse-là se
   * retrouve à quarante centimètres de l'objectif, et une bordure de cinq
   * centimètres vue par la tranche devient une planche en travers du cadre.
   * On les pose donc en retrait de part et d'autre : deux à l'ouest, qu'on
   * voit en entrant, un loin à l'est, qu'on voit au bout — jamais à hauteur
   * d'épaule de l'arrêt, ni dans l'embrasure par laquelle on arrive.
   *
   * Et chacun porte sa toile. Trois cadres vides étaient trois rectangles
   * beiges : un cadre sans image ne se lit pas comme un cadre.
   */
  { roomId: 'galerie', x: 8.3, y: 4.42, w: 0.6, d: 0.04, h: 0.8, base: 1.15, tone: 'bois' },
  { roomId: 'galerie', x: 8.3, y: 4.442, w: 0.48, d: 0.02, h: 0.66, base: 1.22, tone: 'terre' },
  { roomId: 'galerie', x: 9.2, y: 4.42, w: 0.45, d: 0.04, h: 0.6, base: 1.25, tone: 'bois' },
  { roomId: 'galerie', x: 9.2, y: 4.442, w: 0.35, d: 0.02, h: 0.48, base: 1.31, tone: 'petrole' },
  { roomId: 'galerie', x: 12.6, y: 5.58, w: 0.55, d: 0.04, h: 0.75, base: 1.2, tone: 'bois' },
  { roomId: 'galerie', x: 12.6, y: 5.558, w: 0.43, d: 0.02, h: 0.61, base: 1.27, tone: 'terre' },
  { roomId: 'galerie', x: 8.0, y: 5.0, w: 0.3, d: 0.3, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },
  { roomId: 'galerie', x: 12.0, y: 5.0, w: 0.3, d: 0.3, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },
  { roomId: 'galerie', x: 16.0, y: 5.0, w: 0.3, d: 0.3, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },

  /* ---------------------------------------------------------- chambre 3 --- */
  { roomId: 'chambre-3', x: 10.26, y: 8.1, w: 0.1, d: 1.9, h: 1.15, tone: 'bois' },
  { roomId: 'chambre-3', x: 9.16, y: 8.1, w: 2.1, d: 1.72, h: 0.36, tone: 'bois' },
  { roomId: 'chambre-3', x: 9.16, y: 8.1, w: 2.05, d: 1.66, h: 0.19, base: 0.36, moelleux: true, tone: 'lin' },
  { roomId: 'chambre-3', x: 8.98, y: 8.1, w: 1.66, d: 1.78, h: 0.21, base: 0.47, moelleux: true, tone: 'petrole' },
  { roomId: 'chambre-3', x: 10.0, y: 7.72, w: 0.4, d: 0.66, h: 0.08, base: 0.6, moelleux: true, tone: 'terre' },
  { roomId: 'chambre-3', x: 10.0, y: 8.48, w: 0.4, d: 0.66, h: 0.08, base: 0.6, moelleux: true, tone: 'terre' },
  { roomId: 'chambre-3', x: 9.9, y: 6.8, w: 0.46, d: 0.46, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-3', x: 9.9, y: 9.4, w: 0.46, d: 0.46, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-3', x: 9.9, y: 6.8, w: 0.2, d: 0.2, h: 0.28, base: 0.52, tone: 'laiton' },
  { roomId: 'chambre-3', x: 6.01, y: 8.6, w: 0.64, d: 2.2, h: 2.4, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'chambre-3', x: 8.6, y: 6.09, w: 1.3, d: 0.6, h: 0.76, shape: 'table', tone: 'bois' },
  { roomId: 'chambre-3', x: 8.4, y: 8.4, w: 3.0, d: 2.2, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'chambre-3', x: 6.35, y: 10.38, w: 0.24, d: 0.18, h: 2.6, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-3', x: 9.65, y: 10.38, w: 0.24, d: 0.18, h: 2.6, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre-3', x: 8.0, y: 10.38, w: 3.62, d: 0.03, h: 0.03, base: 2.72, tone: 'laiton' },
  { roomId: 'chambre-3', x: 8.0, y: 8.1, w: 0.32, d: 0.32, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },

  /* -------------------------------------------------------------- suite --- */
  { roomId: 'suite', x: 10.54, y: 8.5, w: 0.1, d: 2.1, h: 1.2, tone: 'bois' },
  { roomId: 'suite', x: 11.66, y: 8.5, w: 2.14, d: 1.9, h: 0.36, tone: 'bois' },
  { roomId: 'suite', x: 11.66, y: 8.5, w: 2.1, d: 1.84, h: 0.19, base: 0.36, moelleux: true, tone: 'lin' },
  { roomId: 'suite', x: 11.9, y: 8.5, w: 1.66, d: 1.96, h: 0.21, base: 0.47, moelleux: true, tone: 'petrole' },
  { roomId: 'suite', x: 10.85, y: 8.1, w: 0.4, d: 0.66, h: 0.08, base: 0.6, moelleux: true, tone: 'terre' },
  { roomId: 'suite', x: 10.85, y: 8.9, w: 0.4, d: 0.66, h: 0.08, base: 0.6, moelleux: true, tone: 'terre' },
  /* Les chevets flanquent la tête du lit, à l'ouest, et non son pied.
     Posés au pied — à (13,05 ; 7,70) — ils tombaient sur le point d'arrêt
     mesuré de la caméra, (13,00 ; 7,47) : elle se plantait littéralement dans
     la table de nuit. Contre la tête, ils sont aussi à leur place réelle. */
  { roomId: 'suite', x: 11.0, y: 7.15, w: 0.46, d: 0.46, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'suite', x: 11.0, y: 9.85, w: 0.46, d: 0.46, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'suite', x: 11.0, y: 7.15, w: 0.2, d: 0.2, h: 0.28, base: 0.52, tone: 'laiton' },
  { roomId: 'suite', x: 11.0, y: 9.85, w: 0.2, d: 0.2, h: 0.28, base: 0.52, tone: 'laiton' },
  { roomId: 'suite', x: 14.45, y: 10.2, w: 0.5, d: 0.5, h: 0.85, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'suite', x: 13.1, y: 10.0, w: 0.72, d: 0.74, h: 0.13, tone: 'sombre' },
  { roomId: 'suite', x: 13.1, y: 10.0, w: 0.8, d: 0.82, h: 0.32, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'suite', x: 13.1, y: 10.29, w: 0.8, d: 0.24, h: 0.58, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'suite', x: 11.9, y: 9.75, w: 2.6, d: 1.3, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'suite', x: 10.95, y: 10.38, w: 0.24, d: 0.18, h: 2.6, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'suite', x: 14.02, y: 10.38, w: 0.24, d: 0.18, h: 2.6, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'suite', x: 12.48, y: 10.38, w: 3.37, d: 0.03, h: 0.03, base: 2.72, tone: 'laiton' },
  { roomId: 'suite', x: 12.2, y: 8.3, w: 0.32, d: 0.32, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },

  /* ------------------------------------------------- salle d'eau (suite) --- */
  { roomId: 'bain-suite', x: 16.65, y: 9.4, w: 1.2, d: 1.6, h: 0.06, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 16.03, y: 9.4, w: 0.045, d: 1.6, h: 2.1, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'bain-suite', x: 16.65, y: 8.62, w: 1.2, d: 0.045, h: 2.1, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'bain-suite', x: 17.15, y: 9.4, w: 0.06, d: 0.24, h: 1.3, base: 0.95, tone: 'laiton' },
  { roomId: 'bain-suite', x: 16.9, y: 9.4, w: 0.34, d: 0.26, h: 0.03, base: 2.28, tone: 'laiton' },
  { roomId: 'bain-suite', x: 15.19, y: 8.05, w: 0.6, d: 1.4, h: 0.88, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'bain-suite', x: 15.2, y: 8.05, w: 0.62, d: 1.44, h: 0.05, base: 0.88, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 15.2, y: 8.05, w: 0.42, d: 0.5, h: 0.02, base: 0.91, tone: 'lin' },
  { roomId: 'bain-suite', x: 14.96, y: 8.05, w: 0.05, d: 0.05, h: 0.26, base: 0.93, tone: 'laiton' },
  { roomId: 'bain-suite', x: 15.08, y: 8.05, w: 0.22, d: 0.04, h: 0.04, base: 1.16, tone: 'laiton' },
  { roomId: 'bain-suite', x: 14.925, y: 8.05, w: 0.05, d: 1.4, h: 1.1, base: 1.05, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 15.19, y: 6.05, w: 0.6, d: 0.4, h: 0.42, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 14.99, y: 6.05, w: 0.2, d: 0.4, h: 0.5, base: 0.42, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 17.255, y: 7.4, w: 0.09, d: 0.6, h: 1.05, base: 0.7, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 16.0, y: 8.1, w: 0.9, d: 0.6, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'bain-suite', x: 16.1, y: 7.6, w: 0.3, d: 0.3, h: 0.06, base: 2.82, shape: 'plafonnier', tone: 'platre' },
];

/* ============================================================== légendes === */

export const VILLA_OPENING: CaptionText = {
  kicker: 'Villa de démonstration · plain-pied',
  title: 'Trois chambres, 190 m²',
  text: 'Faites défiler. La porte s’ouvre et vous entrez.',
};

export const VILLA_CAPTIONS: Record<string, CaptionText> = {
  entree: {
    kicker: 'Entrée',
    title: '18,1 m²',
    text: 'Elle ouvre sur deux choses : le séjour à gauche, sans battant, et la galerie en face. On voit le volume avant les couloirs.',
  },
  sejour: {
    kicker: 'Séjour & cuisine',
    title: '60,5 m²',
    text: 'Dix mètres quatre-vingts de long, trois usages sans un mur entre eux : cuisine et îlot, table de six, salon face à la baie de 3,80 m.',
  },
  galerie: {
    kicker: 'Galerie',
    title: '16,8 m²',
    text: 'Onze mètres soixante qui desservent les cinq autres pièces, et rien d’autre. 1,22 m de passage, sans une marche.',
  },
  'chambre-3': {
    kicker: 'Chambre sur terrasse',
    title: '24,5 m²',
    text: 'Lit en 160, armoire trois portes, bureau, et une baie de 2,80 m qui donne de plain-pied sur la terrasse.',
  },
  suite: {
    kicker: 'Suite parentale',
    title: '22,4 m²',
    text: 'Lit en 180, sa baie sur la piscine, et sa salle d’eau privative — la seule pièce de la villa qui ne s’ouvre pas sur la galerie.',
  },
  'bain-suite': {
    kicker: 'Salle d’eau de la suite',
    title: '14,3 m²',
    text: 'Douche à l’italienne de 1,20 m sous la fenêtre, meuble vasque, WC. On n’y accède que par la suite.',
  },
  'chambre-2': {
    kicker: 'Chambre double',
    title: '19,8 m²',
    text: 'Deux expositions — sud-est et est — un lit en 160, une armoire et un vrai bureau sous la fenêtre latérale.',
  },
  'salle-de-bain': {
    kicker: 'Salle de bain',
    title: '13,8 m²',
    text: 'Baignoire sous la fenêtre, douche à l’italienne, double vasque et WC séparé du couchage par la galerie.',
  },
};

export const VILLA_CLOSING: CaptionText = {
  kicker: 'Voilà',
  title: 'C’est ce que verra votre voyageur',
  text: 'Mêmes murs, mêmes distances : le volume vient du plan relevé, pas d’une image de synthèse improvisée.',
};

/** Ce qui s'affiche autour de la visite : le bien tel qu'on l'annoncerait. */
export const VILLA_IDENTITY = {
  name: 'Villa Sainte-Marguerite',
  city: 'Villa de démonstration — plain-pied avec piscine',
  area: 190.1,
  /* Ni nombre de chambres ni de couchages : `VILLA_LISTING` les porte, et
     c'est de là que la page les lit. Deux endroits qui décrivent le même
     logement finissent par diverger. */
  disclaimer:
    'Villa de démonstration. Les dimensions et la circulation sont cohérentes de bout en bout ; le bien, lui, est fictif — il n’est ni à louer ni à visiter.',
};

/**
 * L'annonce fictive.
 *
 * Mêmes précautions que pour la maison, et elles ne sont pas négociables :
 * rien ici ne se fait passer pour un vrai bien, et il n'y a **ni note, ni
 * avis, ni historique de réservation**. Une note en étoiles inventée est un
 * faux document quelle que soit la mention qui l'accompagne.
 */
export const VILLA_LISTING = {
  nightly: 480,
  cleaning: 180,
  minimumNights: 3,
  /**
   * La surface, écrite une fois.
   *
   * Elle apparaissait à trois endroits — la légende d'ouverture de la visite,
   * la rangée de chiffres de l'annonce, et la phrase de présentation — et la
   * troisième la tirait de `VILLA_IDENTITY.area`, qui porte la valeur exacte au
   * dixième. On lisait donc « 190,1 m² » dans le texte et « 190 m² » deux
   * lignes plus bas. Une annonce arrondit, et elle arrondit partout pareil :
   * la valeur exacte reste dans `area`, où les contrôles la vérifient contre
   * la somme des polygones, et le tableau pièce par pièce la donne au dixième.
   */
  surface: '190 m²',
  facts: [
    { label: 'Voyageurs', value: '6' },
    { label: 'Chambres', value: '3' },
    { label: 'Lits', value: '3' },
    { label: 'Salles d’eau', value: '2' },
  ],
  equipment: [
    {
      group: 'Les volumes',
      items: [
        'Séjour de 60,5 m² traversant, sur 10,80 m',
        'Baie de 3,80 m sur la terrasse',
        'Suite parentale de 22,4 m² avec salle d’eau privative',
        'Deux chambres doubles, 24,5 et 19,8 m²',
        'Galerie de 11,60 m qui dessert tout',
        '2,90 m sous plafond dans toutes les pièces',
      ],
    },
    {
      group: 'Dehors',
      items: [
        'Piscine de 10 × 4 m',
        'Terrasse de plain-pied le long de la façade sud',
        'Trois baies qui donnent sur la même terrasse',
        'Jardin clos',
      ],
    },
    {
      group: 'Le confort',
      items: [
        'Plain-pied intégral, aucune marche',
        'Cuisine à îlot, plan de travail de 2,90 m',
        'Lave-vaisselle, lave-linge, sèche-linge',
        'Wi-Fi fibre',
        'Climatisation réversible',
        'Draps et serviettes fournis',
      ],
    },
  ],
  rules: [
    'Arrivée à partir de 17 h, départ avant 11 h',
    'Trois nuits minimum',
    'Non-fumeur',
    'Fêtes et événements non autorisés',
  ],
};
