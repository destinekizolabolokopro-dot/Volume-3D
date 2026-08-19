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
  opening('deg-bain', 'degagement', 'salle-eau', { x: 6.6, y: 3.3 }, { x: 6.6, y: 4.0 }, 'door', 2.05, 0),
  opening('f-sejour', 'sejour', '', { x: 1, y: 0 }, { x: 3.2, y: 0 }, 'window', 2.25, 0.85),
  opening('f-chambre', 'chambre', '', { x: 10, y: 0.6 }, { x: 10, y: 2 }, 'window', 2.2, 0.9),
  opening('f-bain', 'salle-eau', '', { x: 8.6, y: 3.35 }, { x: 8.6, y: 4.0 }, 'window', 2.1, 1.2),
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
  shape?: 'bloc' | 'table' | 'placard' | 'radiateur' | 'rosace' | 'suspension' | 'rideau' | 'plante' | 'vitrage';
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
  /* Le radiateur en fonte sous la fenêtre sur rue. Il est là parce que c'est
     là qu'il est toujours — sous l'ouverture, là où le froid entre — et il
     dit l'époque du bâtiment plus vite que n'importe quel autre objet. */
  { roomId: 'sejour', x: 2.1, y: 0.365, w: 1.0, d: 0.11, h: 0.62, shape: 'radiateur', tone: 'cabinet' },
  /* Le tapis prend deux centimètres et une arête adoucie : à douze millimètres
     et à angle vif, il ne se distinguait pas d'un rectangle peint sur le sol. */
  { roomId: 'sejour', x: 1.7, y: 2.15, w: 2.6, d: 1.8, h: 0.02, moelleux: true, tone: 'tapis' },
  /*
   * La plante, dans l'angle au bout de la cuisine.
   *
   * Deux placements ont été essayés et écartés en image. À côté du canapé,
   * elle était à un mètre de l'objectif : un mètre quinze de feuillage
   * remplissait le quart bas du champ et se lisait comme un rocher — une
   * plante est un objet de fond de pièce, pas de premier plan. Derrière le
   * canapé, elle était à la bonne distance mais sur le mauvais fond : le
   * feuillage et le dossier partagent le pétrole du nuancier, et les deux
   * masses n'en faisaient plus qu'une. Contre un mur clair, à l'autre bout de
   * la pièce, elle se détache et donne de la profondeur au séjour.
   */
  { roomId: 'sejour', x: 4.85, y: 3.5, w: 0.3, d: 0.3, h: 1.0, shape: 'plante', tone: 'terre' },
  /* Le canapé porte la seule couleur franche de la scène ; les coussins lui
     répondent en terre cuite, presque à l'opposé sur le cercle des teintes.
     Il repose sur un piètement sombre en retrait : sans lui, l'assise descend
     jusqu'au parquet et le canapé se lit comme un bloc de mousse posé là. Le
     retrait de cinq centimètres suffit — c'est l'ombre sous le meuble qu'on
     voit, pas le piètement. */
  { roomId: 'sejour', x: 1.7, y: 2.9, w: 2.0, d: 0.76, h: 0.13, tone: 'sombre' },
  { roomId: 'sejour', x: 1.7, y: 2.9, w: 2.1, d: 0.85, h: 0.32, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 1.7, y: 3.19, w: 2.1, d: 0.28, h: 0.68, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 0.78, y: 2.9, w: 0.26, d: 0.85, h: 0.5, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 2.62, y: 2.9, w: 0.26, d: 0.85, h: 0.5, base: 0.13, moelleux: true, tone: 'petrole' },
  { roomId: 'sejour', x: 1.18, y: 2.99, w: 0.4, d: 0.16, h: 0.36, base: 0.45, moelleux: true, tone: 'terre' },
  { roomId: 'sejour', x: 2.22, y: 2.99, w: 0.4, d: 0.16, h: 0.36, base: 0.45, moelleux: true, tone: 'terre' },
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
  /* La rosace, au-dessus de la suspension : la tige partait du vide. */
  { roomId: 'sejour', x: 4.05, y: 1.15, w: 0.34, d: 0.34, h: 0.04, base: 2.56, shape: 'rosace', tone: 'platre' },
  { roomId: 'sejour', x: 4.05, y: 1.15, w: 0.025, d: 0.025, h: 0.5, base: 2.1, tone: 'laiton' },
  { roomId: 'sejour', x: 4.05, y: 1.15, w: 0.14, d: 0.4, h: 0.24, base: 1.86, shape: 'suspension', tone: 'laiton' },

  /* La cuisine en linéaire. Le plan de travail est d'une autre teinte que les
     caissons — c'est ce qui la fait lire comme une cuisine plutôt que comme un
     bloc, et c'est vrai de presque toutes les cuisines. */
  { roomId: 'sejour', x: 4.31, y: 0.6, w: 1.6, d: 0.6, h: 0.9, shape: 'placard', portes: 3, tone: 'cabinet' },
  { roomId: 'sejour', x: 4.31, y: 0.62, w: 1.6, d: 0.64, h: 0.045, base: 0.9, tone: 'sombre' },
  { roomId: 'sejour', x: 4.0, y: 0.62, w: 0.46, d: 0.38, h: 0.02, base: 0.925, tone: 'lin' },
  /* L'évier et son mitigeur. Le plan de travail portait déjà une plaque de
     cuisson ; sans point d'eau, ce qu'on regardait était un meuble bas avec un
     dessus noir. Le col de cygne est ce qui fait dire « cuisine » avant même
     qu'on ait vu la cuve. */
  { roomId: 'sejour', x: 4.62, y: 0.62, w: 0.42, d: 0.36, h: 0.012, base: 0.938, tone: 'sombre' },
  { roomId: 'sejour', x: 4.62, y: 0.46, w: 0.036, d: 0.036, h: 0.26, base: 0.945, tone: 'laiton' },
  { roomId: 'sejour', x: 4.62, y: 0.55, w: 0.03, d: 0.21, h: 0.03, base: 1.19, tone: 'laiton' },
  { roomId: 'sejour', x: 4.31, y: 0.32, w: 1.6, d: 0.04, h: 0.48, base: 0.945, tone: 'cabinet' },
  { roomId: 'sejour', x: 4.31, y: 0.47, w: 1.6, d: 0.34, h: 0.62, base: 1.45, shape: 'placard', portes: 3, tone: 'cabinet' },
  // Le placard d'entrée, contre la façade.
  { roomId: 'sejour', x: 0.6, y: 1.1, w: 0.6, d: 1.6, h: 2.05, shape: 'placard', tone: 'cabinet' },

  /* ------------------------------------------------------------ chambre --- */
  { roomId: 'chambre', x: 8.4, y: 1.95, w: 1.6, d: 2.0, h: 0.4, tone: 'bois' },
  { roomId: 'chambre', x: 8.4, y: 1.95, w: 1.55, d: 1.95, h: 0.18, base: 0.4, moelleux: true, tone: 'lin' },
  /* La couette reprend la couleur du canapé : c'est ce qui relie les deux
     pièces, et ce qui empêche la chambre de paraître décorée par quelqu'un
     d'autre.
     Elle déborde le matelas de cinq centimètres de chaque côté et redescend
     sous son plan de couchage. C'est la seule chose qui la distingue d'un
     couvercle : une couette à fleur du matelas, si épaisse soit-elle, se lit
     comme une plaque de couleur posée sur une caisse — c'est exactement ce
     qu'on voyait en image avant de la faire retomber. */
  { roomId: 'chambre', x: 8.4, y: 1.62, w: 1.66, d: 1.36, h: 0.2, base: 0.5, moelleux: true, tone: 'petrole' },
  { roomId: 'chambre', x: 8.4, y: 1.12, w: 1.72, d: 0.32, h: 0.075, base: 0.65, moelleux: true, tone: 'terre' },
  { roomId: 'chambre', x: 8.05, y: 2.68, w: 0.62, d: 0.38, h: 0.17, base: 0.58, moelleux: true, tone: 'lin' },
  { roomId: 'chambre', x: 8.75, y: 2.68, w: 0.62, d: 0.38, h: 0.17, base: 0.58, moelleux: true, tone: 'lin' },
  { roomId: 'chambre', x: 8.4, y: 2.99, w: 1.7, d: 0.1, h: 1.0, tone: 'bois' },
  // Sous la fenêtre de la chambre, contre la façade est.
  { roomId: 'chambre', x: 9.645, y: 1.3, w: 0.85, d: 0.11, h: 0.62, yaw: 90, shape: 'radiateur', tone: 'cabinet' },
  { roomId: 'chambre', x: 7.4, y: 2.75, w: 0.4, d: 0.4, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 9.4, y: 2.75, w: 0.4, d: 0.4, h: 0.52, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 7.4, y: 2.75, w: 0.18, d: 0.18, h: 0.26, base: 0.52, tone: 'laiton' },
  { roomId: 'chambre', x: 9.4, y: 2.75, w: 0.18, d: 0.18, h: 0.26, base: 0.52, tone: 'laiton' },
  { roomId: 'chambre', x: 7.0, y: 0.9, w: 0.62, d: 1.2, h: 2.1, shape: 'placard', tone: 'cabinet' },
  { roomId: 'chambre', x: 8.4, y: 0.525, w: 1.1, d: 0.45, h: 0.78, shape: 'table', tone: 'bois' },
  { roomId: 'chambre', x: 8.4, y: 0.34, w: 0.7, d: 0.04, h: 0.45, base: 1.25, tone: 'bois' },
  { roomId: 'chambre', x: 8.4, y: 0.365, w: 0.6, d: 0.02, h: 0.35, base: 1.3, tone: 'petrole' },
  /*
   * Les rideaux, de part et d'autre de la fenêtre sur cour.
   *
   * Une fenêtre nue dans une pièce meublée se lit comme un trou dans le mur :
   * c'est le seul endroit du logement où le regard sort, et il en sort sans
   * rien pour l'y retenir. Deux masses verticales de tissu suffisent — elles
   * encadrent l'ouverture, elles donnent au mur la seule verticale qu'il ait,
   * et elles reçoivent le soleil de biais, donc elles bougent avec lui.
   *
   * La tringle passe vingt centimètres au-dessus du linteau et déborde
   * l'ouverture des deux côtés, comme une vraie : un rideau posé au ras du
   * tableau ferme la fenêtre au lieu de l'ouvrir.
   */
  /* En lin, et plissés. Une première version les donnait en volumes lisses :
     deux capsules identiques, de la couleur du mur, qui se lisaient comme des
     piliers. Éclaircir la teinte n'était pas la réponse — l'étude du nuancier
     mesure le voile clair à 2,2 d'écart du mur, c'est-à-dire invisible dessus.
     Ce qui fait un rideau, ce sont ses plis : une alternance d'avancées et de
     retraits qui accroche la lumière rasante de la fenêtre. */
  { roomId: 'chambre', x: 9.6, y: 0.52, w: 0.17, d: 0.32, h: 2.3, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre', x: 9.6, y: 2.16, w: 0.17, d: 0.32, h: 2.3, base: 0.06, moelleux: true, shape: 'rideau', tone: 'lin' },
  { roomId: 'chambre', x: 9.64, y: 1.34, w: 0.028, d: 1.98, h: 0.028, base: 2.42, tone: 'laiton' },

  /* --------------------------------------------------------- salle d’eau --- */
  /* La douche occupe l'angle le plus éloigné de la porte. Elle était d'abord
     posée dans l'angle d'à côté, c'est-à-dire exactement dans l'axe de son
     ouverture : on entrait dedans. */
  /*
   * La salle d'eau a été redessinée, et pas pour l'esthétique.
   *
   * La douche de 90 était plantée en face de la porte : sa paroi, haute d'un
   * mètre quatre-vingt-dix, se dressait à soixante-dix centimètres du seuil et
   * remplissait tout le cadre. La légende annonçait une douche, un meuble vasque
   * et une fenêtre ; l'image n'en montrait aucun.
   *
   * Le calcul est contraint : 2,00 × 1,80 hors œuvre, moins la peau des
   * cloisons et l'épaisseur de deux façades, laisse 1,61 × 1,41 utiles. Une
   * douche de 90 y occupe plus de la moitié de la profondeur — quelle que soit
   * sa place, elle croise l'axe d'une porte de 80. On a donc ramené la porte au
   * nord du mur, la douche à 80 dans l'angle du fond, et le meuble vasque sous
   * la fenêtre. On entre le long du meuble, la douche est à droite, la fenêtre
   * en face : les trois sont dans le champ et aucun n'est dans le passage.
   */
  /* La douche reste plaquée contre la façade sud : son bac affleure exactement
     le nu intérieur du mur de trente. L'avoir descendue de quinze centimètres
     pour dégager la fenêtre l'enfonçait d'autant dans la maçonnerie — un
     contrôle l'a rattrapé. C'est le montant qui a changé, pas la douche. */
  { roomId: 'salle-eau', x: 7.9, y: 4.3, w: 0.8, d: 0.8, h: 0.07, tone: 'cabinet' },
  { roomId: 'salle-eau', x: 7.5175, y: 4.3, w: 0.035, d: 0.8, h: 1.9, base: 0.07, shape: 'vitrage', tone: 'cabinet' },
  { roomId: 'salle-eau', x: 7.9, y: 3.9175, w: 0.8, d: 0.035, h: 1.9, base: 0.07, shape: 'vitrage', tone: 'cabinet' },
  // Meuble vasque sous la fenêtre, contre la façade.
  { roomId: 'salle-eau', x: 8.075, y: 3.64, w: 0.45, d: 0.7, h: 0.86, shape: 'placard', tone: 'bois' },
  { roomId: 'salle-eau', x: 8.075, y: 3.64, w: 0.34, d: 0.44, h: 0.055, base: 0.86, tone: 'cabinet' },
  // Le miroir passe sur le mur nord : la fenêtre occupe déjà la façade.
  { roomId: 'salle-eau', x: 7.15, y: 3.32, w: 0.55, d: 0.06, h: 0.8, base: 1.15, tone: 'cabinet' },
  { roomId: 'salle-eau', x: 6.72, y: 4.5, w: 0.06, d: 0.4, h: 0.9, base: 0.55, tone: 'laiton' },
  { roomId: 'salle-eau', x: 6.78, y: 4.5, w: 0.045, d: 0.3, h: 0.52, base: 0.72, tone: 'lin' },

  /* --------------------------------------------------------- dégagement --- */
  /* Le placard tient le fond du couloir, et rien d'autre n'y tient : un mètre
     quarante de large ne se meuble pas des deux côtés. */
  { roomId: 'degagement', x: 5.46, y: 3.5, w: 0.34, d: 1.2, h: 2.2, shape: 'placard', tone: 'cabinet' },
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
    text: 'Douche 80 × 80, meuble vasque, et une fenêtre — ce que la moitié des salles d’eau parisiennes n’ont pas.',
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
