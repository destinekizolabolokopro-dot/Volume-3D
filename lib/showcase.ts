/**
 * L'appartement de démonstration.
 *
 * Il vit **dans le code**, pas dans la base. C'est délibéré : la page d'accueil
 * est la visite, et une page d'accueil qui dépend du contenu d'une base peut se
 * retrouver vide. Ici, le premier déploiement sur une base neuve montre déjà
 * quelque chose, et le logement d'un client n'est jamais exposé.
 *
 * **C'est le vaisseau amiral, et il a changé de standing.** Le décor précédent
 * était un deux-pièces de 39,8 m² dans le Marais : honnête, bien coté, et le
 * bien le moins désirable des trois qu'on montre — placé en première image du
 * site. Un visiteur qui découvre un service de visites 3D pour de la location
 * saisonnière juge en trois secondes, et ce qu'il jugeait était un studio.
 *
 * Celui-ci est un haussmannien d'angle de 165 m² au quatrième étage : 3,25 m
 * sous plafond, enfilade salon / salle à manger en double porte, galerie de
 * distribution, suite avec sa salle d'eau, balcon filant sur rue. Ce n'est pas
 * de la surenchère — c'est le seul type de bien où **la visite au défilement
 * apporte quelque chose qu'une galerie de photographies ne donne pas** : dans
 * un deux-pièces, quatre photos suffisent ; dans 165 m² en enfilade, aucune
 * photo ne dit qu'on voit la salle à manger depuis le salon.
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

/*
 * Le plan, en une image.
 *
 *        0        4,6      9,0    12,6      16,5
 *   0    ┌─────────┬────────┬──────┬─────────┐
 *        │         │ SALLE  │CHAM- │         │  ← rue, balcon filant
 *        │  SALON  │   À    │ BRE  │ SUITE   │
 *        │ DOUBLE  │ MANGER │      │         │
 *   4,6  │         ├────────┴──────┤         │
 *   5,9  ├─────────┴──GALERIE──────┼─────────┤
 *        │         │        │      │  SALLE  │
 *        │ CUISINE │ ENTRÉE │SALLE │  D'EAU  │
 *        │         │        │ DE   │   DE LA │
 *  10,0  └─────────┴────────┴BAINS─┴─ SUITE ─┘  ← cour, palier
 *
 * Trois choses font le haussmannien, et elles sont dans le plan avant d'être
 * dans le décor :
 *
 *  · **l'enfilade.** Le salon et la salle à manger communiquent par une double
 *    porte de 2,20 m, en plus de leurs portes sur la galerie. C'est la
 *    signature du plan bourgeois, et c'est aussi le seul endroit du site où la
 *    visite au défilement montre quelque chose d'irréductible à une photo : on
 *    voit une pièce à travers une autre ;
 *  · **la galerie**, qui dessert les chambres sans traverser les pièces de
 *    réception ;
 *  · **la suite**, qui prend l'angle et tient les deux bandes — c'est la seule
 *    pièce du plan à toucher à la fois la rue et la cour.
 */

/** Trois mètres vingt-cinq : la cote qui dit « haussmannien » avant tout décor. */
const HAUTEUR = 3.25;

export const SHOWCASE_ROOMS: PlanRoom[] = [
  {
    id: 'salon',
    name: 'Salon double',
    height: HAUTEUR,
    points: [
      { x: 0, y: 0 },
      { x: 4.6, y: 0 },
      { x: 4.6, y: 5.9 },
      { x: 0, y: 5.9 },
    ],
  },
  {
    id: 'salle-a-manger',
    name: 'Salle à manger',
    height: HAUTEUR,
    points: [
      { x: 4.6, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 4.6 },
      { x: 4.6, y: 4.6 },
    ],
  },
  {
    id: 'chambre',
    name: 'Chambre',
    height: HAUTEUR,
    points: [
      { x: 9, y: 0 },
      { x: 12.6, y: 0 },
      { x: 12.6, y: 4.6 },
      { x: 9, y: 4.6 },
    ],
  },
  {
    id: 'suite',
    name: 'Suite parentale',
    height: HAUTEUR,
    points: [
      { x: 12.6, y: 0 },
      { x: 16.5, y: 0 },
      { x: 16.5, y: 5.9 },
      { x: 12.6, y: 5.9 },
    ],
  },
  {
    id: 'galerie',
    name: 'Galerie',
    height: HAUTEUR,
    points: [
      { x: 4.6, y: 4.6 },
      { x: 12.6, y: 4.6 },
      { x: 12.6, y: 5.9 },
      { x: 4.6, y: 5.9 },
    ],
  },
  {
    id: 'cuisine',
    name: 'Cuisine',
    height: HAUTEUR,
    points: [
      { x: 0, y: 5.9 },
      { x: 4.6, y: 5.9 },
      { x: 4.6, y: 10 },
      { x: 0, y: 10 },
    ],
  },
  {
    id: 'entree',
    name: 'Entrée',
    height: HAUTEUR,
    points: [
      { x: 4.6, y: 5.9 },
      { x: 8.6, y: 5.9 },
      { x: 8.6, y: 10 },
      { x: 4.6, y: 10 },
    ],
  },
  {
    id: 'salle-de-bains',
    name: 'Salle de bains',
    height: HAUTEUR,
    points: [
      { x: 8.6, y: 5.9 },
      { x: 12.2, y: 5.9 },
      { x: 12.2, y: 10 },
      { x: 8.6, y: 10 },
    ],
  },
  {
    id: 'bain-suite',
    name: 'Salle d’eau de la suite',
    height: HAUTEUR,
    points: [
      { x: 12.2, y: 5.9 },
      { x: 16.5, y: 5.9 },
      { x: 16.5, y: 10 },
      { x: 12.2, y: 10 },
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
  opening('porte', 'entree', '', { x: 6, y: 10 }, { x: 7.1, y: 10 }, 'door', 2.6, 0),

  /* La double porte de l'enfilade : 2,20 m entre le salon et la salle à
     manger. Elle n'est pas là pour le décor — c'est par elle qu'on voit une
     pièce à travers une autre, et c'est la seule chose de ce plan qu'une
     galerie de photographies ne peut pas rendre. */
  opening('enfilade', 'salon', 'salle-a-manger', { x: 4.6, y: 1 }, { x: 4.6, y: 3.2 }, 'opening', 2.75, 0),

  opening('d-salon', 'salon', 'galerie', { x: 4.6, y: 4.85 }, { x: 4.6, y: 5.65 }, 'door', 2.6, 0),
  opening('d-sam', 'salle-a-manger', 'galerie', { x: 6.6, y: 4.6 }, { x: 7.8, y: 4.6 }, 'opening', 2.6, 0),
  opening('d-chambre', 'chambre', 'galerie', { x: 10.2, y: 4.6 }, { x: 11.1, y: 4.6 }, 'door', 2.5, 0),
  opening('d-suite', 'suite', 'galerie', { x: 12.6, y: 4.85 }, { x: 12.6, y: 5.65 }, 'door', 2.5, 0),
  opening('d-galerie', 'entree', 'galerie', { x: 5.6, y: 5.9 }, { x: 6.8, y: 5.9 }, 'opening', 2.6, 0),
  /*
   * La cuisine ouvre sur le salon, et **pas** sur l'entrée.
   *
   * Deux raisons, et la seconde est la vraie. La première : dans un
   * haussmannien rénové, la cuisine s'ouvre sur la réception — c'est même à
   * peu près la seule chose qu'on change dans ces appartements-là.
   *
   * La seconde tient à l'ordre de la visite. Le parcours prend, à chaque
   * embranchement, la plus grande pièce d'abord — « on montre le séjour avant
   * le cellier ». Avec une porte de service entre l'entrée et la cuisine, le
   * vestibule avait deux sorties : la cuisine (18,9 m²) et la galerie
   * (10,4 m²). La cuisine gagnait, et la visite d'un appartement de 165 m²
   * commençait par la cuisine. La règle n'est pas fausse — elle ne regarde
   * qu'un pas en avant, et derrière la galerie il y a le salon de 27 m².
   * Retirer la porte de service règle le cas sans toucher à la règle, et donne
   * un plan plus juste par-dessus le marché.
   */
  opening('d-cuisine', 'cuisine', 'salon', { x: 1.6, y: 5.9 }, { x: 2.6, y: 5.9 }, 'door', 2.5, 0),
  opening('d-bains', 'salle-de-bains', 'galerie', { x: 10.5, y: 5.9 }, { x: 11.3, y: 5.9 }, 'door', 2.5, 0),
  /* La salle d'eau ne s'ouvre que sur la suite, et c'est ce qui en fait une
     suite. Elle touche pourtant la galerie sur quarante centimètres — une
     seconde porte y tiendrait, et elle ruinerait tout. */
  opening('d-bain-suite', 'bain-suite', 'suite', { x: 13.6, y: 5.9 }, { x: 14.4, y: 5.9 }, 'door', 2.5, 0),

  /* Les portes-fenêtres sur rue, allège à 35 cm : c'est ce qui donne le
     balcon filant, et c'est la cote haussmannienne. */
  opening('pf-salon-1', 'salon', '', { x: 0.8, y: 0 }, { x: 2, y: 0 }, 'window', 2.9, 0.35),
  opening('pf-salon-2', 'salon', '', { x: 2.8, y: 0 }, { x: 4, y: 0 }, 'window', 2.9, 0.35),
  opening('pf-sam-1', 'salle-a-manger', '', { x: 5.4, y: 0 }, { x: 6.6, y: 0 }, 'window', 2.9, 0.35),
  opening('pf-sam-2', 'salle-a-manger', '', { x: 7.2, y: 0 }, { x: 8.4, y: 0 }, 'window', 2.9, 0.35),
  opening('f-chambre', 'chambre', '', { x: 9.8, y: 0 }, { x: 11.8, y: 0 }, 'window', 2.7, 0.9),
  opening('f-suite', 'suite', '', { x: 13.6, y: 0 }, { x: 15.6, y: 0 }, 'window', 2.7, 0.9),

  // L'angle : le salon et la suite prennent chacun un second jour.
  opening('f-salon-ouest', 'salon', '', { x: 0, y: 1.6 }, { x: 0, y: 3.4 }, 'window', 2.7, 0.9),
  opening('f-suite-est', 'suite', '', { x: 16.5, y: 1.4 }, { x: 16.5, y: 3.2 }, 'window', 2.7, 0.9),

  // Sur cour.
  opening('f-cuisine-ouest', 'cuisine', '', { x: 0, y: 7 }, { x: 0, y: 8.6 }, 'window', 2.5, 1),
  opening('f-cuisine', 'cuisine', '', { x: 1.2, y: 10 }, { x: 2.6, y: 10 }, 'window', 2.5, 1),
  opening('f-bains', 'salle-de-bains', '', { x: 9.6, y: 10 }, { x: 10.8, y: 10 }, 'window', 2.4, 1.4),
  opening('f-bain-suite', 'bain-suite', '', { x: 14, y: 10 }, { x: 15.2, y: 10 }, 'window', 2.4, 1.4),
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
   * `bloc` : une masse pleine, pour ce qui touche le sol — canapé, plan de
   * travail. `table` : un plateau sur quatre pieds. `placard` : une armoire,
   * avec sa plinthe en retrait et le joint entre ses deux portes.
   * `radiateur` : un radiateur en fonte à colonnes, sous une fenêtre.
   * `rosace` : une rosace de plafond, sous laquelle pend le luminaire.
   *
   * Les deux derniers ne sont pas du décor. Un radiateur en fonte sous la
   * fenêtre et une rosace au plafond sont les deux objets qui font qu'on
   * reconnaît un appartement haussmannien en une image — plus sûrement que la
   * hauteur sous plafond, qu'on ne peut pas juger sur un écran.
   *
   * La distinction n'est pas cosmétique. Une table rendue en bloc plein
   * ressemble à une caisse posée au milieu de la pièce, et comme elle occupe le
   * premier plan quand la caméra passe à côté, c'est elle qu'on regarde. Quatre
   * pieds de six centimètres suffisent à ce que l'œil lise « table » et passe à
   * autre chose.
   */
  shape?: 'bloc' | 'table' | 'placard' | 'radiateur' | 'rosace' | 'suspension' | 'rideau' | 'plante' | 'vitrage' | 'plafonnier';
  /**
   * Rembourré : l'arête s'arrondit franchement au lieu de recevoir le chanfrein
   * de deux millimètres du mobilier menuisé.
   *
   * C'est le défaut le plus visible qu'un contrôle en image ait révélé, et il
   * ne tenait pas au nombre de pièces modélisées. Le lit était déjà fait d'un
   * sommier, d'un matelas, d'une couette, d'un pli et de deux oreillers — six
   * volumes — et il se lisait quand même comme une dalle turquoise, parce que
   * les six avaient des arêtes vives. Ce qui distingue un textile d'un panneau
   * n'est pas sa découpe, c'est son arête : une couette roule sur le bord du
   * matelas, un oreiller n'a pas de coin. Un rayon franc sur ces volumes-là
   * coûte quelques triangles et rend le meuble d'un coup.
   *
   * Le drapeau est explicite plutôt que déduit de la teinte : `lin` habille
   * aussi bien un oreiller qu'une planche à découper, et arrondir la seconde
   * l'aurait transformée en savonnette.
   */
  moelleux?: boolean;
  /**
   * Nombre de vantaux d'un `placard`. Deux par défaut ; un caisson de cuisine
   * en demande trois ou quatre, et un vantail de soixante centimètres est ce
   * qui donne l'échelle d'une cuisine sans qu'on ait à la mesurer.
   */
  portes?: number;
  /** Une teinte du nuancier étudié (`lib/palette.ts`), jamais une valeur libre. */
  tone: FurnitureTone;
}



/*
 * L'implantation.
 *
 * Les faces intérieures, une fois retirée la peau de chaque mur — trente
 * centimètres contre une façade, neuf contre une cloison. C'est sur elles qu'on
 * se cale, jamais sur les lignes du plan :
 *
 *   salon           x 0,30 → 4,51     y 0,30 → 5,81
 *   salle à manger  x 4,69 → 8,91     y 0,30 → 4,51
 *   chambre         x 9,09 → 12,51    y 0,30 → 4,51
 *   suite           x 12,69 → 16,20   y 0,30 → 5,81
 *   galerie         x 4,69 → 12,51    y 4,69 → 5,81
 *   cuisine         x 0,30 → 4,51     y 5,99 → 9,70
 *   entrée          x 4,69 → 8,51     y 5,99 → 9,70
 *   salle de bains  x 8,69 → 12,11    y 5,99 → 9,70
 *   salle d'eau     x 12,29 → 16,20   y 5,99 → 9,70
 *
 * Et les neuf points où la caméra s'arrête, qui se calculent et se mesurent
 * avant de poser le premier meuble. Rien de haut ne doit s'en approcher à
 * moins de soixante centimètres, sinon la légende d'une pièce se lit devant un
 * dossier de fauteuil :
 *
 *   entrée (6,58 ; 8,73)      galerie (7,89 ; 5,44)    salon (3,03 ; 3,68)
 *   salle à manger (6,17 ; 2,24)                       cuisine (2,24 ; 7,38)
 *   suite (13,94 ; 3,66)      salle d'eau (14,25 ; 7,38)
 *   chambre (10,76 ; 2,97)    salle de bains (10,23 ; 7,37)
 */
export const SHOWCASE_MASSING: Massing[] = [
  /* -------------------------------------------------------------- salon --- */
  /* Le canapé tourne le dos aux fenêtres et regarde la cheminée : c'est
     l'organisation d'un salon bourgeois, et c'est aussi ce qui laisse le champ
     libre entre l'objectif et les portes-fenêtres. */
  { roomId: 'salon', x: 2.0, y: 3.4, w: 3.2, d: 3.2, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'salon', x: 2.0, y: 2.05, w: 2.3, d: 0.9, h: 0.14, tone: 'sombre' },
  { roomId: 'salon', x: 2.0, y: 2.05, w: 2.4, d: 1.0, h: 0.36, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'salon', x: 2.0, y: 1.71, w: 2.4, d: 0.32, h: 0.76, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'salon', x: 0.94, y: 2.05, w: 0.28, d: 1.0, h: 0.58, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'salon', x: 3.06, y: 2.05, w: 0.28, d: 1.0, h: 0.58, base: 0.14, moelleux: true, tone: 'petrole' },
  { roomId: 'salon', x: 1.45, y: 1.94, w: 0.46, d: 0.18, h: 0.42, base: 0.5, moelleux: true, tone: 'terre' },
  { roomId: 'salon', x: 2.55, y: 1.94, w: 0.46, d: 0.18, h: 0.42, base: 0.5, moelleux: true, tone: 'terre' },
  { roomId: 'salon', x: 1.7, y: 3.35, w: 1.1, d: 0.65, h: 0.38, shape: 'table', tone: 'bois' },
  { roomId: 'salon', x: 1.07, y: 4.75, w: 0.74, d: 0.76, h: 0.13, tone: 'sombre' },
  { roomId: 'salon', x: 1.07, y: 4.75, w: 0.86, d: 0.88, h: 0.34, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'salon', x: 1.45, y: 4.75, w: 0.24, d: 0.88, h: 0.6, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'salon', x: 1.15, y: 3.5, w: 0.74, d: 0.76, h: 0.13, tone: 'sombre' },
  { roomId: 'salon', x: 1.15, y: 3.5, w: 0.86, d: 0.88, h: 0.34, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'salon', x: 1.53, y: 3.5, w: 0.24, d: 0.88, h: 0.6, base: 0.13, moelleux: true, tone: 'lin' },
  /* La cheminée de marbre et sa glace. Avec la rosace et le radiateur en
     fonte, c'est l'objet qui dit « haussmannien » avant qu'on ait pu juger la
     hauteur sous plafond — laquelle ne se juge pas sur un écran. */
  { roomId: 'salon', x: 0.42, y: 4.85, w: 0.24, d: 1.3, h: 1.15, tone: 'platre' },
  { roomId: 'salon', x: 0.34, y: 4.85, w: 0.06, d: 1.1, h: 1.3, base: 1.2, tone: 'cabinet' },
  { roomId: 'salon', x: 2.4, y: 0.48, w: 0.75, d: 0.36, h: 0.85, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'salon', x: 2.4, y: 0.34, w: 0.7, d: 0.06, h: 1.4, base: 1.05, tone: 'cabinet' },
  { roomId: 'salon', x: 1.4, y: 0.4, w: 1.0, d: 0.12, h: 0.68, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'salon', x: 3.4, y: 0.4, w: 1.0, d: 0.12, h: 0.68, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'salon', x: 4.2, y: 0.75, w: 0.42, d: 0.42, h: 1.5, shape: 'plante', tone: 'terre' },
  { roomId: 'salon', x: 0.58, y: 0.45, w: 0.34, d: 0.2, h: 2.95, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'salon', x: 4.22, y: 0.45, w: 0.34, d: 0.2, h: 2.95, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'salon', x: 2.4, y: 0.45, w: 3.98, d: 0.03, h: 0.03, base: 3.05, tone: 'laiton' },
  { roomId: 'salon', x: 0.48, y: 1.38, w: 0.2, d: 0.34, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'salon', x: 0.48, y: 3.62, w: 0.2, d: 0.34, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'salon', x: 0.48, y: 2.5, w: 0.03, d: 2.58, h: 0.03, base: 3.05, tone: 'laiton' },
  { roomId: 'salon', x: 1.9, y: 2.7, w: 0.5, d: 0.5, h: 0.06, base: 3.19, shape: 'rosace', tone: 'platre' },
  { roomId: 'salon', x: 1.9, y: 2.7, w: 0.03, d: 0.03, h: 0.55, base: 2.64, tone: 'laiton' },
  { roomId: 'salon', x: 1.9, y: 2.7, w: 0.62, d: 0.62, h: 0.34, base: 2.3, shape: 'suspension', tone: 'laiton' },

  /* ----------------------------------------------------- salle à manger --- */
  /* La table occupe les deux tiers est : l'arrêt de la caméra tombe à
     (6,17 ; 2,24), c'est-à-dire dans le tiers ouest, et une table centrée sur
     la pièce l'aurait avalée. Pas de chaise côté ouest pour la même raison. */
  { roomId: 'salle-a-manger', x: 7.55, y: 2.4, w: 2.0, d: 1.05, h: 0.76, shape: 'table', tone: 'bois' },
  { roomId: 'salle-a-manger', x: 6.95, y: 1.5, w: 0.46, d: 0.46, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 8.15, y: 1.5, w: 0.46, d: 0.46, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 6.95, y: 1.29, w: 0.46, d: 0.05, h: 0.48, base: 0.46, tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 8.15, y: 1.29, w: 0.46, d: 0.05, h: 0.48, base: 0.46, tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 6.95, y: 3.3, w: 0.46, d: 0.46, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 8.15, y: 3.3, w: 0.46, d: 0.46, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 6.95, y: 3.51, w: 0.46, d: 0.05, h: 0.48, base: 0.46, tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 8.15, y: 3.51, w: 0.46, d: 0.05, h: 0.48, base: 0.46, tone: 'sombre' },
  { roomId: 'salle-a-manger', x: 8.66, y: 3.7, w: 0.5, d: 1.2, h: 0.85, shape: 'placard', portes: 3, tone: 'bois' },
  { roomId: 'salle-a-manger', x: 8.88, y: 3.7, w: 0.06, d: 1.0, h: 1.3, base: 1.0, tone: 'cabinet' },
  { roomId: 'salle-a-manger', x: 6.0, y: 0.4, w: 1.0, d: 0.12, h: 0.68, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'salle-a-manger', x: 7.8, y: 0.4, w: 1.0, d: 0.12, h: 0.68, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'salle-a-manger', x: 5.15, y: 0.45, w: 0.34, d: 0.2, h: 2.95, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'salle-a-manger', x: 8.65, y: 0.45, w: 0.34, d: 0.2, h: 2.95, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'salle-a-manger', x: 6.9, y: 0.45, w: 3.84, d: 0.03, h: 0.03, base: 3.05, tone: 'laiton' },
  { roomId: 'salle-a-manger', x: 5.0, y: 4.2, w: 0.42, d: 0.42, h: 1.4, shape: 'plante', tone: 'terre' },
  { roomId: 'salle-a-manger', x: 7.55, y: 2.4, w: 0.5, d: 0.5, h: 0.06, base: 3.19, shape: 'rosace', tone: 'platre' },
  { roomId: 'salle-a-manger', x: 7.55, y: 2.4, w: 0.03, d: 0.03, h: 0.6, base: 2.59, tone: 'laiton' },
  { roomId: 'salle-a-manger', x: 7.55, y: 2.4, w: 0.58, d: 0.58, h: 0.32, base: 2.27, shape: 'suspension', tone: 'laiton' },

  /* ------------------------------------------------------------ chambre --- */
  { roomId: 'chambre', x: 9.14, y: 1.45, w: 0.1, d: 1.9, h: 1.2, tone: 'bois' },
  { roomId: 'chambre', x: 10.24, y: 1.45, w: 2.1, d: 1.7, h: 0.38, tone: 'bois' },
  { roomId: 'chambre', x: 10.24, y: 1.45, w: 2.05, d: 1.65, h: 0.2, base: 0.38, moelleux: true, tone: 'lin' },
  { roomId: 'chambre', x: 10.46, y: 1.45, w: 1.65, d: 1.76, h: 0.22, base: 0.5, moelleux: true, tone: 'petrole' },
  { roomId: 'chambre', x: 9.55, y: 1.05, w: 0.42, d: 0.68, h: 0.08, base: 0.64, moelleux: true, tone: 'terre' },
  { roomId: 'chambre', x: 9.55, y: 1.85, w: 0.42, d: 0.68, h: 0.08, base: 0.64, moelleux: true, tone: 'terre' },
  { roomId: 'chambre', x: 9.7, y: 2.6, w: 0.46, d: 0.46, h: 0.54, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 9.7, y: 2.6, w: 0.2, d: 0.2, h: 0.3, base: 0.54, tone: 'laiton' },
  { roomId: 'chambre', x: 12.19, y: 2.6, w: 0.64, d: 1.9, h: 2.6, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'chambre', x: 11.0, y: 0.4, w: 0.9, d: 0.12, h: 0.68, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'chambre', x: 9.58, y: 0.45, w: 0.34, d: 0.2, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre', x: 12.02, y: 0.45, w: 0.34, d: 0.2, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre', x: 10.8, y: 0.45, w: 2.78, d: 0.03, h: 0.03, base: 2.85, tone: 'laiton' },
  { roomId: 'chambre', x: 10.6, y: 1.6, w: 0.44, d: 0.44, h: 0.06, base: 3.19, shape: 'rosace', tone: 'platre' },
  { roomId: 'chambre', x: 10.6, y: 1.6, w: 0.03, d: 0.03, h: 0.5, base: 2.69, tone: 'laiton' },
  { roomId: 'chambre', x: 10.6, y: 1.6, w: 0.46, d: 0.46, h: 0.3, base: 2.39, shape: 'suspension', tone: 'laiton' },

  /* -------------------------------------------------------------- suite --- */
  { roomId: 'suite', x: 12.74, y: 2.1, w: 0.1, d: 2.14, h: 1.3, tone: 'bois' },
  { roomId: 'suite', x: 13.86, y: 2.1, w: 2.14, d: 1.94, h: 0.38, tone: 'bois' },
  { roomId: 'suite', x: 13.86, y: 2.1, w: 2.09, d: 1.89, h: 0.2, base: 0.38, moelleux: true, tone: 'lin' },
  { roomId: 'suite', x: 14.08, y: 2.1, w: 1.65, d: 2.0, h: 0.22, base: 0.5, moelleux: true, tone: 'petrole' },
  { roomId: 'suite', x: 13.15, y: 1.7, w: 0.42, d: 0.7, h: 0.08, base: 0.64, moelleux: true, tone: 'terre' },
  { roomId: 'suite', x: 13.15, y: 2.5, w: 0.42, d: 0.7, h: 0.08, base: 0.64, moelleux: true, tone: 'terre' },
  { roomId: 'suite', x: 12.95, y: 0.8, w: 0.46, d: 0.46, h: 0.54, shape: 'table', tone: 'bois' },
  { roomId: 'suite', x: 13.0, y: 3.45, w: 0.46, d: 0.46, h: 0.54, shape: 'table', tone: 'bois' },
  { roomId: 'suite', x: 12.95, y: 0.8, w: 0.2, d: 0.2, h: 0.3, base: 0.54, tone: 'laiton' },
  { roomId: 'suite', x: 15.9, y: 2.3, w: 0.6, d: 1.4, h: 0.76, shape: 'table', tone: 'bois' },
  { roomId: 'suite', x: 15.1, y: 1.05, w: 0.78, d: 0.8, h: 0.13, tone: 'sombre' },
  { roomId: 'suite', x: 15.1, y: 1.05, w: 0.86, d: 0.88, h: 0.34, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'suite', x: 15.1, y: 0.67, w: 0.86, d: 0.24, h: 0.6, base: 0.13, moelleux: true, tone: 'lin' },
  { roomId: 'suite', x: 15.4, y: 5.5, w: 1.4, d: 0.5, h: 0.9, shape: 'placard', portes: 3, tone: 'bois' },
  { roomId: 'suite', x: 15.4, y: 5.78, w: 1.1, d: 0.06, h: 1.2, base: 1.05, tone: 'cabinet' },
  { roomId: 'suite', x: 14.2, y: 3.8, w: 2.6, d: 1.8, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'suite', x: 14.6, y: 0.4, w: 0.9, d: 0.12, h: 0.68, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'suite', x: 13.38, y: 0.45, w: 0.34, d: 0.2, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'suite', x: 15.82, y: 0.45, w: 0.34, d: 0.2, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'suite', x: 14.6, y: 0.45, w: 2.78, d: 0.03, h: 0.03, base: 2.85, tone: 'laiton' },
  { roomId: 'suite', x: 15.96, y: 1.18, w: 0.2, d: 0.34, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'suite', x: 15.96, y: 3.42, w: 0.2, d: 0.34, h: 2.75, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'suite', x: 15.99, y: 2.3, w: 0.03, d: 2.58, h: 0.03, base: 2.85, tone: 'laiton' },
  { roomId: 'suite', x: 14.4, y: 2.4, w: 0.5, d: 0.5, h: 0.06, base: 3.19, shape: 'rosace', tone: 'platre' },
  { roomId: 'suite', x: 14.4, y: 2.4, w: 0.03, d: 0.03, h: 0.55, base: 2.64, tone: 'laiton' },
  { roomId: 'suite', x: 14.4, y: 2.4, w: 0.52, d: 0.52, h: 0.32, base: 2.32, shape: 'suspension', tone: 'laiton' },

  /* ------------------------------------------------------------ galerie --- */
  /* Un mètre douze de passage sur près de huit mètres. On ne meuble que le
     cul-de-sac de l'est et les murs, et jamais à l'abscisse de l'arrêt : dans
     une galerie, un cadre accroché là se retrouve à quarante centimètres de
     l'objectif et sa bordure vue par la tranche barre l'image. */
  { roomId: 'galerie', x: 8.9, y: 4.87, w: 1.0, d: 0.36, h: 0.85, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'galerie', x: 8.9, y: 4.72, w: 0.9, d: 0.06, h: 1.4, base: 1.0, tone: 'cabinet' },
  { roomId: 'galerie', x: 4.95, y: 4.72, w: 0.45, d: 0.04, h: 0.62, base: 1.25, tone: 'bois' },
  { roomId: 'galerie', x: 4.95, y: 4.742, w: 0.35, d: 0.02, h: 0.5, base: 1.31, tone: 'terre' },
  { roomId: 'galerie', x: 11.8, y: 5.78, w: 0.5, d: 0.04, h: 0.7, base: 1.2, tone: 'bois' },
  { roomId: 'galerie', x: 11.8, y: 5.758, w: 0.4, d: 0.02, h: 0.58, base: 1.26, tone: 'terre' },
  { roomId: 'galerie', x: 6.2, y: 5.25, w: 0.3, d: 0.3, h: 0.06, base: 3.17, shape: 'plafonnier', tone: 'platre' },
  { roomId: 'galerie', x: 9.0, y: 5.25, w: 0.3, d: 0.3, h: 0.06, base: 3.17, shape: 'plafonnier', tone: 'platre' },
  { roomId: 'galerie', x: 11.5, y: 5.25, w: 0.3, d: 0.3, h: 0.06, base: 3.17, shape: 'plafonnier', tone: 'platre' },

  /* ------------------------------------------------------------ cuisine --- */
  { roomId: 'cuisine', x: 3.3, y: 9.39, w: 2.2, d: 0.62, h: 0.92, shape: 'placard', portes: 4, tone: 'cabinet' },
  { roomId: 'cuisine', x: 3.3, y: 9.39, w: 2.24, d: 0.62, h: 0.05, base: 0.92, tone: 'sombre' },
  { roomId: 'cuisine', x: 3.3, y: 9.13, w: 2.24, d: 0.05, h: 0.6, base: 0.97, tone: 'cabinet' },
  { roomId: 'cuisine', x: 2.6, y: 9.42, w: 0.5, d: 0.42, h: 0.012, base: 0.958, tone: 'sombre' },
  { roomId: 'cuisine', x: 2.6, y: 9.21, w: 0.038, d: 0.038, h: 0.3, base: 0.965, tone: 'laiton' },
  { roomId: 'cuisine', x: 2.6, y: 9.31, w: 0.032, d: 0.2, h: 0.032, base: 1.25, tone: 'laiton' },
  { roomId: 'cuisine', x: 3.9, y: 9.42, w: 0.62, d: 0.5, h: 0.02, base: 0.965, tone: 'sombre' },
  { roomId: 'cuisine', x: 3.9, y: 9.3, w: 0.62, d: 0.44, h: 0.55, base: 1.65, tone: 'cabinet' },
  { roomId: 'cuisine', x: 4.19, y: 6.32, w: 0.64, d: 0.66, h: 2.6, shape: 'placard', portes: 2, tone: 'cabinet' },
  { roomId: 'cuisine', x: 4.2, y: 7.8, w: 0.62, d: 2.2, h: 0.92, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'cuisine', x: 4.19, y: 7.8, w: 0.64, d: 2.24, h: 0.05, base: 0.92, tone: 'sombre' },
  { roomId: 'cuisine', x: 4.34, y: 7.8, w: 0.34, d: 1.8, h: 0.72, base: 1.65, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'cuisine', x: 1.15, y: 7.8, w: 1.0, d: 1.4, h: 0.76, shape: 'table', tone: 'bois' },
  { roomId: 'cuisine', x: 1.15, y: 6.85, w: 0.46, d: 0.46, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'cuisine', x: 1.15, y: 6.64, w: 0.46, d: 0.05, h: 0.48, base: 0.46, tone: 'sombre' },
  { roomId: 'cuisine', x: 1.15, y: 8.75, w: 0.46, d: 0.46, h: 0.46, shape: 'table', tone: 'sombre' },
  { roomId: 'cuisine', x: 1.15, y: 8.96, w: 0.46, d: 0.05, h: 0.48, base: 0.46, tone: 'sombre' },
  { roomId: 'cuisine', x: 2.4, y: 7.8, w: 0.3, d: 0.3, h: 0.06, base: 3.17, shape: 'plafonnier', tone: 'platre' },

  /* ------------------------------------------------------------- entrée --- */
  { roomId: 'entree', x: 5.01, y: 7.4, w: 0.64, d: 1.8, h: 2.6, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'entree', x: 8.26, y: 7.6, w: 0.5, d: 1.4, h: 0.85, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'entree', x: 8.46, y: 7.6, w: 0.06, d: 1.2, h: 1.5, base: 1.0, tone: 'cabinet' },
  { roomId: 'entree', x: 5.35, y: 9.4, w: 1.1, d: 0.42, h: 0.45, shape: 'table', tone: 'bois' },
  { roomId: 'entree', x: 7.9, y: 9.3, w: 0.44, d: 0.44, h: 1.4, shape: 'plante', tone: 'terre' },
  { roomId: 'entree', x: 6.55, y: 8.2, w: 1.8, d: 1.4, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'entree', x: 6.6, y: 7.8, w: 0.34, d: 0.34, h: 0.06, base: 3.17, shape: 'plafonnier', tone: 'platre' },

  /* ----------------------------------------------------- salle de bains --- */
  { roomId: 'salle-de-bains', x: 10.15, y: 8.955, w: 1.7, d: 0.11, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 10.15, y: 9.605, w: 1.7, d: 0.11, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 9.355, y: 9.28, w: 0.11, d: 0.76, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 10.945, y: 9.28, w: 0.11, d: 0.76, h: 0.58, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 10.15, y: 9.28, w: 1.48, d: 0.54, h: 0.14, tone: 'lin' },
  { roomId: 'salle-de-bains', x: 9.43, y: 9.28, w: 0.05, d: 0.05, h: 0.22, base: 0.58, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 9.57, y: 9.28, w: 0.24, d: 0.04, h: 0.04, base: 0.77, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 11.81, y: 7.2, w: 0.6, d: 1.6, h: 0.88, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'salle-de-bains', x: 11.82, y: 7.2, w: 0.58, d: 1.64, h: 0.05, base: 0.88, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 11.82, y: 6.8, w: 0.42, d: 0.34, h: 0.02, base: 0.91, tone: 'lin' },
  { roomId: 'salle-de-bains', x: 11.82, y: 7.6, w: 0.42, d: 0.34, h: 0.02, base: 0.91, tone: 'lin' },
  { roomId: 'salle-de-bains', x: 11.98, y: 6.8, w: 0.05, d: 0.05, h: 0.26, base: 0.93, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 11.98, y: 7.6, w: 0.05, d: 0.05, h: 0.26, base: 0.93, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 11.86, y: 6.8, w: 0.22, d: 0.04, h: 0.04, base: 1.16, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 11.86, y: 7.6, w: 0.22, d: 0.04, h: 0.04, base: 1.16, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 12.08, y: 7.2, w: 0.05, d: 1.6, h: 1.2, base: 1.1, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 9.3, y: 6.6, w: 1.2, d: 1.1, h: 0.06, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 9.8775, y: 6.6, w: 0.045, d: 1.1, h: 2.2, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 9.3, y: 7.1275, w: 1.2, d: 0.045, h: 2.2, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 8.78, y: 6.6, w: 0.06, d: 0.24, h: 1.3, base: 0.95, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 9.0, y: 6.6, w: 0.34, d: 0.26, h: 0.03, base: 2.35, tone: 'laiton' },
  { roomId: 'salle-de-bains', x: 8.98, y: 8.6, w: 0.58, d: 0.4, h: 0.42, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 8.79, y: 8.6, w: 0.2, d: 0.4, h: 0.5, base: 0.42, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 12.06, y: 8.8, w: 0.09, d: 0.6, h: 1.1, base: 0.75, tone: 'cabinet' },
  { roomId: 'salle-de-bains', x: 10.4, y: 8.2, w: 0.9, d: 0.6, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'salle-de-bains', x: 10.4, y: 7.8, w: 0.3, d: 0.3, h: 0.06, base: 3.17, shape: 'plafonnier', tone: 'platre' },

  /* --------------------------------------------- salle d'eau de la suite --- */
  { roomId: 'bain-suite', x: 13.45, y: 8.655, w: 1.7, d: 0.11, h: 0.58, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 13.45, y: 9.305, w: 1.7, d: 0.11, h: 0.58, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 12.655, y: 8.98, w: 0.11, d: 0.76, h: 0.58, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 14.245, y: 8.98, w: 0.11, d: 0.76, h: 0.58, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 13.45, y: 8.98, w: 1.48, d: 0.54, h: 0.14, tone: 'lin' },
  { roomId: 'bain-suite', x: 12.73, y: 8.98, w: 0.05, d: 0.05, h: 0.22, base: 0.58, tone: 'laiton' },
  { roomId: 'bain-suite', x: 12.87, y: 8.98, w: 0.24, d: 0.04, h: 0.04, base: 0.77, tone: 'laiton' },
  { roomId: 'bain-suite', x: 15.55, y: 8.95, w: 1.2, d: 1.4, h: 0.06, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 14.9725, y: 8.95, w: 0.045, d: 1.4, h: 2.2, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'bain-suite', x: 15.55, y: 8.2725, w: 1.2, d: 0.045, h: 2.2, base: 0.06, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'bain-suite', x: 16.13, y: 8.95, w: 0.06, d: 0.24, h: 1.3, base: 0.95, tone: 'laiton' },
  { roomId: 'bain-suite', x: 15.9, y: 8.95, w: 0.34, d: 0.26, h: 0.03, base: 2.35, tone: 'laiton' },
  { roomId: 'bain-suite', x: 12.59, y: 6.9, w: 0.6, d: 1.5, h: 0.88, shape: 'placard', portes: 2, tone: 'bois' },
  { roomId: 'bain-suite', x: 12.6, y: 6.9, w: 0.62, d: 1.54, h: 0.05, base: 0.88, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 12.6, y: 6.9, w: 0.44, d: 0.5, h: 0.02, base: 0.91, tone: 'lin' },
  { roomId: 'bain-suite', x: 12.36, y: 6.9, w: 0.05, d: 0.05, h: 0.26, base: 0.93, tone: 'laiton' },
  { roomId: 'bain-suite', x: 12.48, y: 6.9, w: 0.22, d: 0.04, h: 0.04, base: 1.16, tone: 'laiton' },
  { roomId: 'bain-suite', x: 12.32, y: 6.9, w: 0.05, d: 1.5, h: 1.2, base: 1.1, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 15.9, y: 6.6, w: 0.58, d: 0.4, h: 0.42, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 16.09, y: 6.6, w: 0.2, d: 0.4, h: 0.5, base: 0.42, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 16.14, y: 7.6, w: 0.09, d: 0.6, h: 1.1, base: 0.75, tone: 'cabinet' },
  { roomId: 'bain-suite', x: 14.4, y: 8.0, w: 1.0, d: 0.7, h: 0.02, moelleux: true, tone: 'tapis' },
  { roomId: 'bain-suite', x: 14.4, y: 7.6, w: 0.3, d: 0.3, h: 0.06, base: 3.17, shape: 'plafonnier', tone: 'platre' },
];

/* ============================================================== légendes === */

export const SHOWCASE_OPENING: CaptionText = {
  kicker: 'Paris 8ᵉ · plaine Monceau',
  title: 'Cinq pièces, 165 m²',
  text: 'Faites défiler. La porte s’ouvre et vous entrez.',
};

export const SHOWCASE_CAPTIONS: Record<string, CaptionText> = {
  entree: {
    kicker: 'Entrée',
    title: '16,4 m²',
    text: 'Un vestibule, pas un couloir : penderie pleine hauteur, banc, console et glace. La galerie s’ouvre en face.',
  },
  galerie: {
    kicker: 'Galerie',
    title: '10,4 m²',
    text: 'Elle dessert les chambres sans jamais traverser les pièces de réception. C’est tout le principe du plan bourgeois.',
  },
  salon: {
    kicker: 'Salon double',
    title: '27,1 m²',
    text: 'Deux portes-fenêtres sur le balcon filant, cheminée de marbre, 3,25 m sous plafond. La salle à manger s’ouvre en enfilade.',
  },
  'salle-a-manger': {
    kicker: 'Salle à manger',
    title: '20,2 m²',
    text: 'En enfilade du salon par une double porte de 2,20 m. Deux portes-fenêtres, table de six, desserte et glace.',
  },
  cuisine: {
    kicker: 'Cuisine',
    title: '18,9 m²',
    text: 'Ouverte sur la réception, deux jours dont un sur cour, un linéaire de 2,20 m et une table de quatre.',
  },
  suite: {
    kicker: 'Suite parentale',
    title: '23,0 m²',
    text: 'Elle prend l’angle : deux expositions, lit en 180, coiffeuse sous la fenêtre est, et sa salle d’eau privative.',
  },
  'bain-suite': {
    kicker: 'Salle d’eau de la suite',
    title: '17,6 m²',
    text: 'Baignoire îlot, douche à l’italienne de 1,20 m, meuble vasque et WC. On n’y accède que par la suite.',
  },
  chambre: {
    kicker: 'Chambre',
    title: '16,6 m²',
    text: 'Lit en 160 tête contre le mur de refend, armoire pleine hauteur, et 90 cm de passage au pied du lit.',
  },
  'salle-de-bains': {
    kicker: 'Salle de bains',
    title: '14,8 m²',
    text: 'Baignoire sous la fenêtre sur cour, douche à l’italienne, double vasque et WC séparé du couchage par la galerie.',
  },
};

export const SHOWCASE_CLOSING: CaptionText = {
  kicker: 'Voilà',
  title: 'C’est ce que verra votre voyageur',
  text: 'Mêmes murs, mêmes distances : le volume vient du plan relevé, pas d’une image de synthèse improvisée.',
};

/** Ce qui s'affiche autour de la visite : le bien tel qu'on l'annoncerait. */
export const SHOWCASE_IDENTITY = {
  name: 'Appartement Monceau',
  city: 'Paris 8ᵉ — plaine Monceau',
  area: 165,
  /** Au sens français : salon, salle à manger, deux chambres, et la cuisine
   *  qui ne compte pas. Cinq pièces principales. */
  rooms: 5,
  sleeps: 4,
  /** Appartement de démonstration : à dire, toujours, et sans détour. */
  disclaimer:
    'Appartement de démonstration. Les dimensions et la circulation sont cohérentes de bout en bout ; le bien, lui, est fictif tant qu’un vrai logement n’a pas été relevé.',
};
