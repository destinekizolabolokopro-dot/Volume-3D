/**
 * Le parcours d'entrée : la timeline que le défilement pilote.
 *
 * Tout ce fichier est pur. Il ne connaît ni le DOM, ni WebGL, ni le scroll : il
 * transforme un plan — des pièces, des ouvertures — en une suite de poses de
 * caméra indexées par un curseur `t` entre 0 et 1. Le composant se contente de
 * fabriquer ce `t` à partir de la position dans la page et de demander la pose
 * correspondante.
 *
 * C'est ce découpage qui rend la chose testable : on peut vérifier qu'à 40 % du
 * défilement la caméra est bien dans la chambre, sans ouvrir un navigateur.
 *
 * Deux pistes séparées, et c'est délibéré :
 *
 *  - **la position** suit une polyligne dense dont les angles sont arrondis, et
 *    elle est parcourue à vitesse constante. Une trajectoire lissée par spline
 *    déborderait dans les murs à chaque passage de porte ; un arrondi de rayon
 *    borné reste, lui, à l'intérieur du triangle de l'angle, donc à l'intérieur
 *    des pièces.
 *  - **le regard** est fait de temps forts : on entre, on tourne la tête vers ce
 *    que la pièce a de plus parlant, on repart. Chaque temps fort s'atteint en
 *    douceur, ce qui donne le mouvement de tête et non le balayage mécanique.
 *
 * Mélanger les deux — lisser aussi la position — donnait une caméra qui ralentit
 * à chaque point de passage. Les garder distinctes donne une marche régulière
 * sous un regard qui, lui, prend son temps.
 */

import {
  canStandAt,
  containsPoint,
  distance,
  exitsFrom,
  midpoint,
  pointAt,
  roomArea,
  roomCenter,
  roomWalls,
} from './plan.ts';
import type { PlanDoor, PlanPoint, PlanRoom } from './types.ts';

/* ============================================================== réglages === */

/** Hauteur de l'œil au-dessus du sol, en mètres. */
export const EYE = 1.6;

/**
 * Durée d'un arrêt, exprimée en « mètres virtuels ».
 *
 * Le curseur avance proportionnellement au chemin parcouru ; pour qu'un arrêt
 * occupe du défilement, il faut lui donner une longueur. Trois mètres, c'est à
 * peu près le temps qu'on met à traverser une pièce — donc à peu près le temps
 * qu'on accepte de rester immobile à la regarder.
 */
const DWELL_ROOM = 3.4;
const DWELL_ENTRANCE = 2.6;
const DWELL_CLOSING = 2.8;

/** Distance à laquelle on se place de part et d'autre d'une ouverture. */
const DOOR_MARGIN = 0.55;

/**
 * Recul depuis lequel on cadre une pièce trop petite pour qu'on y entre.
 *
 * Cinquante-cinq centimètres à l'intérieur, c'était déjà trop. Dans une salle
 * d'eau de trois mètres carrés, ces cinquante-cinq centimètres mettent la
 * caméra à vingt-cinq d'une paroi de douche : l'image est la paroi, et la
 * légende qui parle de douche, de vasque et de fenêtre ne montre aucune des
 * trois. Un photographe d'intérieur, lui, se met *dans l'embrasure* — la porte
 * lui donne le recul que la pièce n'a pas.
 */
const THRESHOLD_MARGIN = 0.12;

/** Recul devant la porte d'entrée, avant qu'elle ne s'ouvre. */
const APPROACH = 2.9;

/**
 * Surface en dessous de laquelle on ne rentre pas au milieu de la pièce.
 *
 * Au centre d'une salle d'eau de trois mètres carrés, la caméra se retrouve à
 * quatre-vingt-dix centimètres de chaque mur : quelle que soit la direction
 * choisie, l'image est un pan de mur en gros plan. Un photographe d'intérieur
 * se met dans l'embrasure et cadre la pièce entière ; on fait pareil.
 */
const SMALL_ROOM = 7;

/**
 * Angle horizontal, en degrés, sous lequel on veut voir le mur qu'on regarde.
 *
 * Le champ horizontal du parcours tourne autour de cent degrés. Un mur qui en
 * occupe soixante remplit le cadre sans le déborder : il reste de la place de
 * part et d'autre pour les murs de côté, et c'est cette place qui fait qu'on lit
 * une pièce et non une surface.
 */
const TARGET_SUBTENSE = 60;

/**
 * Ce que vaut un mur désigné, en degrés d'écart au cadrage idéal.
 *
 * Une photo accrochée à un mur dit que le propriétaire tient à ce mur : elle
 * doit l'emporter sur la géométrie. Mais pas absolument — un mur qu'on ne peut
 * pas cadrer reste un mur qu'on ne peut pas cadrer. Soixante-dix degrés de
 * bonus, c'est assez pour battre un mur bien placé, pas assez pour cadrer une
 * cloison à cinquante centimètres.
 */
const PHOTO_BONUS = 70;
const WINDOW_BONUS = 25;

/** Rayon maximal d'un angle arrondi, et fraction maximale des côtés adjacents. */
const CORNER_RADIUS = 0.6;
const CORNER_SHARE = 0.45;
const CORNER_SAMPLES = 6;

/**
 * Distance à laquelle la caméra porte son regard, en mètres.
 *
 * Viser le point de passage suivant paraît naturel jusqu'au moment où deux
 * points ne sont séparés que d'un demi-mètre : dans un dégagement d'un mètre
 * quarante, la caméra se met alors à fixer le mur qu'elle longe. On regarde où
 * l'on sera dans un mètre et demi — c'est ce que fait quelqu'un qui marche.
 */
const LOOKAHEAD = 1.6;

const TRAVEL_PITCH = -4;
const TRAVEL_FOV = 72;
const ROOM_PITCH = -9;
const ROOM_FOV = 74;
const ENTRANCE_PITCH = -2;
const ENTRANCE_FOV = 58;

/* ================================================================ modèle === */

export interface Pose {
  /** Position au sol, en mètres, dans le repère du plan. */
  x: number;
  y: number;
  /** Cap en degrés : 0 regarde vers le haut du plan, 90 vers la droite. */
  yaw: number;
  /** Inclinaison en degrés. Négatif = vers le sol. */
  pitch: number;
  /** Champ de vision vertical, en degrés. */
  fov: number;
}

export interface PathPoint {
  t: number;
  x: number;
  y: number;
}

/**
 * Un temps fort du regard.
 *
 * `ease` décrit comment on **arrive** sur cette clé depuis la précédente :
 * `linear` pendant la marche, pour que la tête suive le couloir sans à-coups ;
 * `smooth` pour un mouvement volontaire, quand on se tourne vers une fenêtre.
 */
export interface ViewKey {
  t: number;
  yaw: number;
  pitch: number;
  fov: number;
  ease: 'linear' | 'smooth';
}

export interface CaptionText {
  kicker: string;
  title: string;
  text: string;
}

export interface Caption extends CaptionText {
  id: string;
  /** Intervalle de `t` pendant lequel la légende est à l'écran. */
  from: number;
  to: number;
}

export interface Journey {
  path: PathPoint[];
  view: ViewKey[];
  captions: Caption[];
  /** Ordre de traversée des pièces, avec l'instant d'arrivée dans chacune. */
  rooms: { roomId: string; t: number }[];
  /** L'ouverture par laquelle on entre, si le plan en déclare une. */
  entrance: { door: PlanDoor; roomId: string; outside: PlanPoint } | null;
  /** Portion de la timeline pendant laquelle le battant pivote. */
  doorOpens: { from: number; to: number };
  /** Longueur réelle du trajet, en mètres. Sert à dimensionner le défilement. */
  metres: number;
}

export interface JourneyOptions {
  /** Panneau affiché sur le seuil, avant que la porte ne s'ouvre. */
  opening?: CaptionText;
  /** Dernier panneau, la visite finie. */
  closing?: CaptionText;
  /** Légendes écrites à la main, par identifiant de pièce. Priment sur le plan. */
  captions?: Record<string, CaptionText>;
  /** Photos accrochées aux murs : une pièce qui en a une la fait regarder. */
  photos?: { roomId: string; wallIndex: number }[];
}

/* ================================================================= maths === */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Adoucissement classique : dérivée nulle aux deux bouts, donc pas d'à-coup. */
export const smoothstep = (u: number): number => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};

/** Écart signé le plus court entre deux caps, dans ]−180, 180]. */
export function shortestArc(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/** Interpolation d'angle par le plus court chemin : on ne fait jamais le tour. */
export const lerpAngle = (from: number, to: number, u: number): number =>
  from + shortestArc(from, to) * u;

/** Cap qui mène d'un point à un autre, dans le repère du plan. */
export function heading(from: PlanPoint, to: PlanPoint): number {
  return (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
}

const unit = (from: PlanPoint, to: PlanPoint): PlanPoint => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
};

const along = (from: PlanPoint, direction: PlanPoint, metres: number): PlanPoint => ({
  x: from.x + direction.x * metres,
  y: from.y + direction.y * metres,
});

/**
 * Normale d'une ouverture, dirigée vers l'extérieur de la pièce.
 *
 * Le sens n'est pas supposé à partir de l'ordre des points : on essaie une
 * perpendiculaire, et si elle ramène dans la pièce, on prend l'autre. Le sens
 * de parcours des polygones est une convention que rien n'oblige un relevé à
 * respecter, et s'appuyer dessus est le genre d'hypothèse qui tient jusqu'au
 * jour où elle ne tient plus.
 */
export function wallNormal(a: PlanPoint, b: PlanPoint, room: PlanRoom): PlanPoint {
  const angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
  const candidate = { x: Math.cos(angle), y: Math.sin(angle) };
  const probe = along(midpoint(a, b), candidate, 0.05);
  return containsPoint(room, probe) ? { x: -candidate.x, y: -candidate.y } : candidate;
}

/**
 * Le champ vertical à donner à la caméra, pour un format d'écran donné.
 *
 * Une caméra de rendu se règle en champ **vertical**, mais ce qu'on veut tenir
 * dans l'image, c'est une pièce — donc de la largeur. Sur un écran d'ordinateur
 * en 16/9, 74° de vertical donnent une centaine de degrés d'horizontale et la
 * pièce entre. Sur un téléphone tenu debout, les mêmes 74° n'en donnent plus que
 * quarante : on se retrouve le nez sur une fenêtre, et le volume disparaît
 * exactement là où il compte le plus, puisque c'est là que la moitié des
 * visiteurs regarderont.
 *
 * On raisonne donc à largeur constante : quel que soit le format, l'image
 * couvre la même largeur d'angle qu'un 16/9. Et on plafonne le vertical : au-delà
 * d'une centaine de degrés, la déformation aux bords devient plus gênante que le
 * cadrage n'est utile.
 *
 * La règle vaut dans les deux sens, et elle ne le faisait pas. Le calcul
 * s'arrêtait aux formats plus étroits que le 16/9, en se disant qu'un écran
 * large n'a pas de problème de largeur. C'est vrai de la largeur et faux de tout
 * le reste : la scène de la visite livrée fait deux fois et demie sa hauteur, et
 * 72° de vertical y donnaient cent vingt-deux degrés d'horizontale. Une pièce
 * vue à travers un objectif de cent vingt-deux degrés n'est plus une pièce,
 * c'est un couloir courbe — les murs latéraux filent, et un cadre accroché de
 * côté occupe la moitié de l'image.
 */
const REFERENCE_ASPECT = 16 / 9;
/*
 * Le plafond du champ vertical.
 *
 * Il était à 96°, et c'était trop. Sur un téléphone tenu debout, la règle de
 * largeur constante réclamait 136° : ramenés à 96, on voyait encore du sol à
 * quarante-quatre degrés sous l'horizon et du plafond à quarante-quatre
 * au-dessus — c'est-à-dire, dans une pièce de deux mètres soixante, surtout du
 * sol et du plafond, et très peu de mur.
 *
 * Quatre-vingt-quatre degrés laissent cinquante-deux degrés d'horizontale sur
 * un écran de téléphone. C'est moins qu'un ordinateur, et c'est assumé : un
 * téléphone montre moins. Ce qu'il ne doit pas faire, c'est montrer *autre
 * chose* — un plancher et un plafond à la place d'une pièce.
 */
const MAX_VERTICAL_FOV = 84;

export function verticalFov(base: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return base;
  const halfWidth = Math.tan((base * Math.PI) / 360) * REFERENCE_ASPECT;
  const held = (2 * Math.atan(halfWidth / aspect) * 180) / Math.PI;
  return Math.min(MAX_VERTICAL_FOV, held);
}

/*
 * L'assiette du regard suit la forme de l'écran.
 *
 * Sur un téléphone tenu debout, le champ vertical s'ouvre à quatre-vingt-quatre
 * degrés pour garder de la largeur. Le quart haut de l'image tombe alors sur du
 * plafond nu — dans une pièce de deux mètres soixante, tout ce qui est à plus de
 * quatorze degrés au-dessus de l'horizon est du plâtre. Or ce qu'on est venu
 * voir est en dessous : les meubles, le sol, ce qui donne son échelle à la
 * pièce. Un centimètre de plafond de plus n'apprend rien ; un centimètre de sol
 * de plus montre le parquet, le tapis, le pied du lit.
 *
 * On incline donc un peu plus le regard quand le cadre s'allonge. Pas beaucoup :
 * six degrés déplacent l'horizon d'un dixième de la hauteur de l'image, ce qui
 * suffit à faire entrer le mobilier et ne suffit pas à donner l'impression de
 * regarder ses pieds.
 *
 * En dessous du 4/3 seulement — un écran d'ordinateur n'a pas ce problème, et le
 * même supplément d'assiette y ferait pencher une image déjà bien composée.
 */
const TALL_ASPECT = 4 / 3;
const TALL_TILT = 6;

export function viewPitch(base: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return base;
  if (aspect >= TALL_ASPECT) return base;
  /* La bascule est progressive : entre le 4/3 et le format d'un téléphone,
     rien ne justifie un seuil, et un seuil se verrait au redimensionnement. */
  const part = Math.min(1, (TALL_ASPECT - aspect) / (TALL_ASPECT - 0.5));
  return base - TALL_TILT * part;
}

/* ============================================================ lecture t → */

/** Position au sol à l'instant `t`. Vitesse constante entre deux points. */
export function positionAt(path: PathPoint[], t: number): PlanPoint {
  if (path.length === 0) return { x: 0, y: 0 };
  const cursor = clamp01(t);
  if (cursor <= path[0].t) return { x: path[0].x, y: path[0].y };
  const last = path[path.length - 1];
  if (cursor >= last.t) return { x: last.x, y: last.y };

  const index = segmentIndex(path, cursor);
  const a = path[index];
  const b = path[index + 1];
  const span = b.t - a.t;
  const u = span < 1e-9 ? 0 : (cursor - a.t) / span;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

/** Orientation à l'instant `t`. */
export function viewAt(view: ViewKey[], t: number): { yaw: number; pitch: number; fov: number } {
  if (view.length === 0) return { yaw: 0, pitch: TRAVEL_PITCH, fov: TRAVEL_FOV };
  const cursor = clamp01(t);
  const first = view[0];
  if (cursor <= first.t) return { yaw: first.yaw, pitch: first.pitch, fov: first.fov };
  const last = view[view.length - 1];
  if (cursor >= last.t) return { yaw: last.yaw, pitch: last.pitch, fov: last.fov };

  const index = segmentIndex(view, cursor);
  const a = view[index];
  const b = view[index + 1];
  const span = b.t - a.t;
  const raw = span < 1e-9 ? 1 : (cursor - a.t) / span;
  const u = b.ease === 'smooth' ? smoothstep(raw) : raw;
  return {
    yaw: lerpAngle(a.yaw, b.yaw, u),
    pitch: a.pitch + (b.pitch - a.pitch) * u,
    fov: a.fov + (b.fov - a.fov) * u,
  };
}

/** Pose complète à l'instant `t`. C'est la seule fonction dont le rendu a besoin. */
export function sample(journey: Journey, t: number): Pose {
  const position = positionAt(journey.path, t);
  const orientation = viewAt(journey.view, t);
  return { ...position, ...orientation };
}

/** Ouverture du battant à l'instant `t`, de 0 (fermé) à 1 (grand ouvert). */
export function doorOpening(journey: Journey, t: number): number {
  const { from, to } = journey.doorOpens;
  if (to <= from) return 0;
  return smoothstep((clamp01(t) - from) / (to - from));
}

/**
 * Opacité d'une légende.
 *
 * Elle entre vite et sort plus lentement : à la remontée du défilement, une
 * légende qui réapparaît brutalement donne l'impression d'un clignotement.
 *
 * La toute première fait exception et s'affiche pleine dès le premier pixel.
 * Sans cette exception, la page s'ouvre sur une image muette — le fondu
 * d'entrée démarre à zéro, et il n'y a rien avant zéro pour le jouer.
 */
export function captionOpacity(caption: Caption, t: number): number {
  const span = caption.to - caption.from;
  if (span <= 0) return 0;
  const u = (t - caption.from) / span;
  if (u < 0 || u > 1) return 0;
  const rise = caption.from <= 0 ? 1 : smoothstep(u / 0.14);
  const fall = smoothstep((1 - u) / 0.22);
  return Math.min(1, rise, fall);
}

/** Recherche dichotomique du segment qui encadre `t`. */
function segmentIndex(keys: { t: number }[], t: number): number {
  let low = 0;
  let high = keys.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (keys[middle].t <= t) low = middle;
    else high = middle;
  }
  return low;
}

/* ============================================================ description === */

const decimal = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

/** Surface en français, sans décimale inutile : « 20,8 m² », « 12 m² ». */
export function area(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : decimal(rounded, 1)} m²`;
}

/** Longueur en français, toujours au centimètre : « 2,60 m ». */
export const metres = (value: number): string => `${decimal(value, 2)} m`;

/**
 * Ce qu'on peut dire d'une pièce sans rien inventer.
 *
 * Tout vient du relevé : la surface, les ouvertures, la hauteur sous plafond.
 * Aucune formule d'agence, aucun adjectif que le plan ne justifie pas — c'est
 * la même règle que pour le reste du produit, on ne raconte que ce qui a été
 * mesuré. Le propriétaire peut écrire mieux, et sa version prime.
 */
export function describeRoom(room: PlanRoom, doors: PlanDoor[]): CaptionText {
  const windows = doors.filter(
    (door) => door.kind === 'window' && (door.from === room.id || door.to === room.id),
  );
  const parts: string[] = [];
  if (windows.length === 1) {
    parts.push(`Une fenêtre de ${metres(distance(windows[0].a, windows[0].b))}.`);
  } else if (windows.length > 1) {
    const total = windows.reduce((sum, door) => sum + distance(door.a, door.b), 0);
    parts.push(`${windows.length} fenêtres, ${metres(total)} d'ouverture au total.`);
  } else {
    parts.push('Aucune ouverture sur l’extérieur.');
  }
  parts.push(`Hauteur sous plafond : ${metres(room.height)}.`);
  return { kicker: room.name, title: area(roomArea(room)), text: parts.join(' ') };
}

/* ============================================================ traversée === */

interface Leg {
  roomId: string;
  /** Ouverture franchie pour arriver ici. Nulle pour la première pièce. */
  via: PlanDoor | null;
  /** Vrai si on ne fait que repasser : pas d'arrêt, pas de légende. */
  revisit: boolean;
}

/**
 * L'ordre dans lequel on parcourt le logement.
 *
 * On visite en profondeur d'abord, la plus grande pièce en premier à chaque
 * embranchement : c'est ainsi qu'on fait visiter un appartement, on montre le
 * séjour avant le cellier. Les retours sont conservés — pour aller de la
 * chambre à la salle d'eau, il **faut** repasser par le dégagement, et une
 * caméra qui se téléporte détruit en une seconde la crédibilité du volume.
 *
 * Par défaut, le dernier retour est coupé : la visite s'arrête où elle s'arrête.
 * Avec `returnToStart`, on repart vers la plus grande pièce — c'est ce qu'on
 * veut quand la visite se termine par un mot de conclusion. Terminer une visite
 * sur trois mètres carrés de salle de bains gâche tout le bénéfice de ce qui
 * précède.
 *
 * Le drapeau a longtemps signifié « on garde le chemin du retour », ce qui
 * revenait au même **tant que la porte d'entrée ouvrait sur la plus grande
 * pièce** — c'est le cas de l'appartement, dont le séjour est aussi le palier
 * d'arrivée. Ça cesse d'être vrai dès qu'un logement a une entrée : la maison
 * de démonstration terminait son mot de la fin dans neuf mètres carrés de sas,
 * face à un placard. On revient donc explicitement là où le logement est le
 * plus beau, en repassant par les pièces qu'il faut traverser pour y aller.
 */
export function tourOrder(
  startId: string,
  rooms: PlanRoom[],
  doors: PlanDoor[],
  returnToStart = false,
): Leg[] {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  if (!byId.has(startId)) return [];

  const seen = new Set<string>([startId]);
  const legs: Leg[] = [{ roomId: startId, via: null, revisit: false }];

  const visit = (roomId: string) => {
    const exits = exitsFrom(roomId, doors)
      .filter((exit) => byId.has(exit.targetId))
      .sort((a, b) => roomArea(byId.get(b.targetId)!) - roomArea(byId.get(a.targetId)!));
    for (const exit of exits) {
      // Relu ici et non au filtrage : une branche voisine a pu prendre cette
      // pièce entre-temps.
      if (seen.has(exit.targetId)) continue;
      seen.add(exit.targetId);
      legs.push({ roomId: exit.targetId, via: exit.door, revisit: false });
      visit(exit.targetId);
      legs.push({ roomId, via: exit.door, revisit: true });
    }
  };
  visit(startId);

  // Les retours de fin de branche ne mènent nulle part : on les coupe, puis on
  // décide nous-même où la visite doit se terminer.
  while (legs.length > 1 && legs[legs.length - 1].revisit) legs.pop();
  if (!returnToStart) return legs;

  const finale = [...rooms].sort((a, b) => roomArea(b) - roomArea(a))[0]?.id ?? startId;
  for (const leg of walkBack(legs[legs.length - 1].roomId, finale, rooms, doors)) legs.push(leg);
  return legs;
}

/**
 * Le plus court chemin d'une pièce à une autre, porte par porte.
 *
 * Un simple parcours en largeur sur le graphe des ouvertures. Il ne sert qu'au
 * retour : la caméra doit franchir chaque porte qui sépare les deux pièces, et
 * une caméra qui se téléporte détruit en une seconde la crédibilité du volume.
 */
function walkBack(fromId: string, toId: string, rooms: PlanRoom[], doors: PlanDoor[]): Leg[] {
  if (fromId === toId) return [];
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const cameBy = new Map<string, { from: string; door: PlanDoor }>();
  const seen = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === toId) break;
    for (const exit of exitsFrom(id, doors)) {
      if (!byId.has(exit.targetId) || seen.has(exit.targetId)) continue;
      seen.add(exit.targetId);
      cameBy.set(exit.targetId, { from: id, door: exit.door });
      queue.push(exit.targetId);
    }
  }

  const back: Leg[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = cameBy.get(cursor);
    // Pièce inatteignable : mieux vaut s'arrêter où l'on est que sauter un mur.
    if (!step) return [];
    back.unshift({ roomId: cursor, via: step.door, revisit: true });
    cursor = step.from;
  }
  return back;
}

/* ================================================================ montage === */

interface Stop {
  point: PlanPoint;
  roomId: string;
  /** Arrêt, en mètres virtuels. Zéro = simple point de passage. */
  dwell: number;
  /** Ce qu'on regarde pendant l'arrêt. Nul = on regarde où l'on va. */
  lookAt: PlanPoint | null;
  caption: CaptionText | null;
  /** Un seuil est frôlé par les murs : ni arrondi, ni contrôle d'intérieur. */
  threshold: boolean;
  pitch: number;
  fov: number;
}

/**
 * Ce qu'on regarde en entrant dans une pièce.
 *
 * Deux décisions, et la seconde compte plus que la première.
 *
 * **Quel mur** : celui qui porte une photo du propriétaire, sinon une fenêtre,
 * sinon le plus long.
 *
 * **Quel point de ce mur** : pas son milieu — son extrémité la plus éloignée de
 * l'endroit d'où l'on arrive. Viser le milieu d'un mur donne une vue frontale,
 * c'est-à-dire un aplat : la pièce se réduit à la surface qu'on a en face, et
 * tout ce qui est sur les côtés sort du cadre. Viser vers le fond donne une
 * diagonale — deux murs, la plus grande profondeur disponible, et le volume qui
 * se lit d'un coup. C'est ce que fait n'importe quel photographe d'intérieur, et
 * pour cette raison exactement.
 */
function focusOf(
  room: PlanRoom,
  doors: PlanDoor[],
  photos: { roomId: string; wallIndex: number }[],
  /** Là où la caméra se tiendra — pas par où elle est entrée. C'est de ce point
   *  que le mur sera vu, donc c'est de ce point qu'il faut le juger. */
  from: PlanPoint,
): PlanPoint {
  const walls = roomWalls(room);
  if (walls.length === 0) return roomCenter(room);
  let best = 0;
  let bestScore = -Infinity;
  let bestWindow: PlanDoor | null = null;
  for (let index = 0; index < walls.length; index += 1) {
    const wall = walls[index];
    const length = distance(wall.a, wall.b);
    const hasPhoto = photos.some(
      (photo) => photo.roomId === room.id && photo.wallIndex % walls.length === index,
    );
    const window =
      doors.find(
        (door) =>
          door.kind === 'window' &&
          (door.from === room.id || door.to === room.id) &&
          nearSegment(midpoint(door.a, door.b), wall.a, wall.b),
      ) ?? null;
    /* L'angle sous lequel le mur se présente, et non sa longueur.
       Le plus long mur d'un couloir est celui qu'on longe : à soixante-dix
       centimètres, il occupe cent trente degrés et l'image devient un pan de
       peinture. Ce qu'on cherche est le mur qui *tient dans le cadre* — celui
       du fond. */
    const away = Math.max(0.4, distance(from, midpoint(wall.a, wall.b)));
    const subtense = (2 * Math.atan(length / 2 / away) * 180) / Math.PI;
    const score =
      -Math.abs(subtense - TARGET_SUBTENSE) +
      (hasPhoto ? PHOTO_BONUS : 0) +
      (window ? WINDOW_BONUS : 0);
    if (score > bestScore) {
      bestScore = score;
      best = index;
      bestWindow = window;
    }
  }

  /* Une fenêtre est le point du mur qu'on est venu voir : on la vise elle, et
     non les quatre-vingt-deux pour cent du mur. Dans une salle d'eau de trois
     mètres carrés, la différence est celle entre la fenêtre et la paroi de
     douche qui se trouve à l'autre bout du même mur. */
  if (bestWindow) return midpoint(bestWindow.a, bestWindow.b);

  const wall = walls[best];
  const towardB = distance(from, wall.b) > distance(from, wall.a);
  return pointAt(wall, towardB ? 0.82 : 0.18);
}


/* --------------------------------------------------- la dernière image --- */

/**
 * La direction dans laquelle le regard porte le plus loin, depuis un point.
 *
 * La visite se terminait là où elle s'arrêtait : dans la plus petite pièce du
 * logement — c'est toujours la dernière desservie — face au mur le mieux cadré
 * de cette pièce, à un mètre quarante. Tenue sur un dixième du défilement, cette
 * image est la dernière que le visiteur emporte du bien.
 *
 * On la remplace par le regard en arrière : depuis le seuil, on cherche l'axe
 * qui traverse le plus de logement — le couloir, les portes alignées, le séjour
 * au fond. C'est le plan de fin de toutes les vidéos d'agence, et pour une bonne
 * raison : c'est le seul qui montre que les pièces communiquent.
 *
 * Trois rayons plutôt qu'un — l'axe et ses deux flancs — pour ne pas élire un
 * enfilement qui passerait par le trou d'une serrure : ce qui compte est ce qui
 * reste ouvert sur toute la largeur du cadre, pas la plus longue aiguille.
 */
const OPEN_SAMPLES = 72;
const OPEN_SPREAD = 12;
const OPEN_STEP = 0.1;
const OPEN_MAX = 14;
/** Jeu admis entre le point de franchissement et le segment de la porte. */
const PASSAGE_JEU = 0.12;

/** La pièce qui contient un point, ou `null` si le point est hors du logement. */
function roomAt(rooms: PlanRoom[], point: PlanPoint): PlanRoom | null {
  for (const room of rooms) if (containsPoint(room, point)) return room;
  return null;
}

/** Distance d'un point au segment [a, b]. */
function toSegment(point: PlanPoint, a: PlanPoint, b: PlanPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const carre = dx * dx + dy * dy;
  const t = carre === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / carre));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Y a-t-il une ouverture entre ces deux pièces, à cet endroit-là du mur ? */
function passeParUneOuverture(
  doors: PlanDoor[],
  a: string,
  b: string,
  point: PlanPoint,
): boolean {
  for (const door of doors) {
    if (door.kind === 'window') continue;
    const relie = (door.from === a && door.to === b) || (door.from === b && door.to === a);
    if (!relie) continue;
    if (toSegment(point, door.a, door.b) <= PASSAGE_JEU) return true;
  }
  return false;
}

/**
 * Jusqu'où porte le regard, murs compris.
 *
 * La première version s'arrêtait quand le rayon sortait du logement, et c'est
 * une erreur qu'une image a fini par montrer : deux pièces mitoyennes partagent
 * leur ligne de plan, donc un rayon tiré du dégagement vers la salle d'eau
 * passait à travers la cloison sans rien rencontrer. Le calcul annonçait deux
 * mètres trente-cinq de dégagement là où il y avait un mur à soixante-dix
 * centimètres — et le cadrage, qui élit l'axe le plus ouvert, élisait donc ce
 * mur-là. À l'écran : un aplat de peinture plein cadre, en pleine marche.
 *
 * Le contrôle automatique censé attraper exactement ce défaut partageait le
 * même rayon, ce qui explique qu'il passait. Il appelle maintenant cette
 * fonction-ci, pour qu'il n'y ait qu'une définition de « voir loin ».
 *
 * Franchir une cloison n'est permis qu'au droit d'une ouverture reliant
 * réellement les deux pièces. Les fenêtres ne comptent pas : elles donnent sur
 * la rue, et une enfilade qui se termine dehors n'est pas une enfilade.
 */
export function freeRun(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  from: PlanPoint,
  yaw: number,
): number {
  const dx = Math.sin((yaw * Math.PI) / 180);
  const dy = -Math.cos((yaw * Math.PI) / 180);
  let reach = 0;
  let courante = roomAt(rooms, from);
  for (let step = OPEN_STEP; step <= OPEN_MAX; step += OPEN_STEP) {
    const point = { x: from.x + dx * step, y: from.y + dy * step };
    const ici = roomAt(rooms, point);
    if (!ici) break;
    if (courante && ici !== courante && !passeParUneOuverture(doors, courante.id, ici.id, point)) {
      break;
    }
    courante = ici;
    reach = step;
  }
  return reach;
}

/**
 * Le cap, entre deux autres, qui laisse le plus de champ.
 *
 * Un arrêt dans une pièce est fait de deux mouvements : on arrive en regardant
 * devant soi, on tourne la tête vers ce qu'on est venu voir. Entre les deux, le
 * regard balaie — et dans une chambre de onze mètres carrés, le balayage passe
 * par un mur à un mètre quatre-vingts, qui remplit alors tout le cadre. Le
 * visiteur qui s'arrête de faire défiler à cet instant a devant lui un aplat de
 * peinture, sans plinthe ni corniche pour lui dire ce qu'il regarde.
 *
 * On pose donc une clé au milieu du virage, sur le cap le plus dégagé de l'arc
 * effectivement parcouru. Le mouvement de tête reste le même ; ce qu'il traverse
 * change.
 */
function throughOpen(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  from: PlanPoint,
  a: number,
  b: number,
): number | null {
  const arc = shortestArc(a, b);
  if (Math.abs(arc) < 25) return null;
  let best = a + arc / 2;
  let bestRun = -1;
  const steps = 8;
  for (let index = 1; index < steps; index += 1) {
    const yaw = a + (arc * index) / steps;
    const run = freeRun(rooms, doors, from, yaw);
    if (run > bestRun) {
      bestRun = run;
      best = yaw;
    }
  }
  return best;
}

/**
 * @param prefer Cap de la marche en cours, s'il y en a une. L'axe le plus long
 *   part souvent en arrière — dans un couloir, c'est la pièce qu'on vient de
 *   quitter. Regarder derrière soi se paie deux fois : le plan raconte le
 *   contraire du parcours, et il faut ensuite pivoter de cent quatre-vingts
 *   degrés pour repartir, ce qui fait un à-coup. Un axe en arrière ne vaut donc
 *   que la moitié de sa longueur.
 */
export function openDirection(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  from: PlanPoint,
  prefer?: number,
): PlanPoint {
  let bestYaw = 0;
  let best = -1;
  for (let index = 0; index < OPEN_SAMPLES; index += 1) {
    const yaw = (index * 360) / OPEN_SAMPLES;
    const run = Math.min(
      freeRun(rooms, doors, from, yaw),
      freeRun(rooms, doors, from, yaw - OPEN_SPREAD),
      freeRun(rooms, doors, from, yaw + OPEN_SPREAD),
    );
    const aligned =
      prefer === undefined
        ? 1
        : 0.55 + 0.45 * Math.cos((shortestArc(prefer, yaw) * Math.PI) / 180);
    if (run * aligned > best) {
      best = run * aligned;
      bestYaw = yaw;
    }
  }
  best = Math.min(
    freeRun(rooms, doors, from, bestYaw),
    freeRun(rooms, doors, from, bestYaw - OPEN_SPREAD),
    freeRun(rooms, doors, from, bestYaw + OPEN_SPREAD),
  );
  const dx = Math.sin((bestYaw * Math.PI) / 180);
  const dy = -Math.cos((bestYaw * Math.PI) / 180);
  const span = Math.max(best, 0.6);
  return { x: from.x + dx * span, y: from.y + dy * span };
}

/**
 * Le point d'où l'on regarde une pièce dans laquelle on vient d'entrer.
 *
 * Aux deux tiers du chemin entre l'arrivée et le centre, et jamais plus près
 * d'un mur que la marge de marche : sur un plan biscornu, ce recul pourrait
 * tomber dans une cloison.
 */
function backOff(room: PlanRoom, arrival: PlanPoint, centre: PlanPoint): PlanPoint {
  const candidate = {
    x: arrival.x + (centre.x - arrival.x) * 0.62,
    y: arrival.y + (centre.y - arrival.y) * 0.62,
  };
  return canStandAt(room, candidate) ? candidate : centre;
}

/**
 * Ce qu'on regarde depuis un point donné d'une pièce.
 *
 * C'est la décision de cadrage complète, sortie de la construction du parcours
 * pour une raison précise : la visite livrée au voyageur — celle qui se
 * parcourt librement — avait sa propre version, et c'était l'ancienne, celle
 * qui élisait le mur le plus long. Dans un couloir, le mur le plus long est
 * celui qu'on longe. Les deux surfaces cadrent maintenant pareil, parce
 * qu'elles appellent le même code.
 *
 * @param depuis D'où l'on vient, si on vient de quelque part. Sert à préférer
 *   l'axe qui continue la marche plutôt que celui qui revient en arrière.
 */
export function lookTarget(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  photos: { roomId: string; wallIndex: number }[],
  room: PlanRoom,
  from: PlanPoint,
  depuis?: PlanPoint | null,
): PlanPoint {
  if (onTraverse(room, doors)) {
    return openDirection(rooms, doors, from, depuis ? heading(depuis, from) : undefined);
  }
  return focusOf(room, doors, photos, from);
}

/**
 * Une pièce de circulation : elle en dessert au moins deux autres.
 *
 * La distinction commande le cadrage, et elle est plus sûre qu'un seuil de
 * surface. Un dégagement d'un mètre quarante et une salle d'eau de trois mètres
 * carrés sont tous deux trop petits pour qu'on y cadre un mur — mais ce qu'on
 * vient y voir n'est pas la même chose. La salle d'eau, on la montre : sa
 * douche, son meuble, sa fenêtre. Le couloir, on ne le montre pas, on le
 * *traverse* — ce qui s'en dit est qu'il mène quelque part, et cela se voit en
 * regardant dans sa longueur, à travers ses portes.
 *
 * Cadré comme une pièce, le dégagement du logement d'essai donnait un mur à
 * quatre-vingt-dix centimètres tenu pendant tout l'arrêt.
 *
 * Deux signes, et il en suffit d'un.
 *
 * **Elle en dessert au moins trois autres**, ce qui est la définition d'un
 * couloir. Le seuil était à deux, et deux ne suffit pas : une suite parentale
 * ouvre sur la galerie et sur sa propre salle d'eau, donc elle desservait
 * « deux autres pièces » et se retrouvait cadrée comme un couloir — regardée
 * dans l'axe le plus dégagé, c'est-à-dire vers la porte de la salle de bains,
 * au lieu de sa baie sur la piscine. La légende parlait d'un lit en 180 et
 * d'une vue sur le bassin ; l'image montrait une embrasure et un pan de mur à
 * 1,71 m. Une pièce qui mène à **une** autre n'est pas un passage : une chambre
 * avec sa salle d'eau, un séjour ouvert sur sa cuisine, c'est encore une
 * destination.
 *
 * **Ou elle n'a pas de jour.** Ce second signe a été ajouté pour l'entrée de la
 * maison : deux mètres quarante de large, aucune fenêtre, et une seule porte
 * intérieure — donc pas un couloir au sens du premier critère, et pourtant
 * cadrée comme une pièce elle donnait la penderie en gros plan sur la moitié du
 * cadre. Une pièce sans fenêtre n'est pas une pièce qu'on photographie : c'est
 * un sas, et ce qu'il a à dire est ce qu'il ouvre. Le critère est sûr dans
 * l'autre sens aussi — un séjour, une chambre, même une salle d'eau ont un
 * jour, donc aucun d'eux ne bascule par erreur du côté du couloir.
 */
function onTraverse(room: PlanRoom, doors: PlanDoor[]): boolean {
  let served = 0;
  let jour = false;
  for (const door of doors) {
    if (door.from !== room.id && door.to !== room.id) continue;
    if (door.kind === 'window') {
      jour = true;
      continue;
    }
    if (door.from && door.to) served += 1;
  }
  return served >= 3 || (!jour && served >= 1);
}


/** Vrai si un point est posé sur un segment, à deux centimètres près. */
function nearSegment(point: PlanPoint, a: PlanPoint, b: PlanPoint): boolean {
  const length = distance(a, b);
  if (length < 1e-6) return distance(point, a) < 0.02;
  const u = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (length * length);
  const clamped = u < 0 ? 0 : u > 1 ? 1 : u;
  return distance(point, { x: a.x + (b.x - a.x) * clamped, y: a.y + (b.y - a.y) * clamped }) < 0.02;
}

/**
 * Compose le trajet brut : une suite d'arrêts et de points de passage.
 *
 * Chaque tronçon reste à l'intérieur d'une seule pièce, ou franchit une seule
 * ouverture. C'est ce qui garantit qu'une droite entre deux arrêts ne traverse
 * pas de cloison, tant que les pièces sont convexes — ce que produit la lecture
 * de plan, qui rend des polygones rectangulaires.
 */
function layout(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  options: JourneyOptions,
): { stops: Stop[]; entrance: Journey['entrance'] } {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const photos = options.photos ?? [];
  const stops: Stop[] = [];

  // Une porte qui ne mène à aucune pièce connue, c'est la porte palière.
  const front =
    doors.find(
      (door) =>
        door.kind !== 'window' &&
        ((door.from && !byId.has(door.to)) || (door.to && !byId.has(door.from))),
    ) ?? null;

  const startId =
    (front && (byId.has(front.from) ? front.from : front.to)) ||
    [...rooms].sort((a, b) => roomArea(b) - roomArea(a))[0]?.id ||
    '';
  const startRoom = byId.get(startId);
  if (!startRoom) return { stops, entrance: null };

  let entrance: Journey['entrance'] = null;
  if (front) {
    const door = midpoint(front.a, front.b);
    /* On recule **perpendiculairement au mur**, et non « à l'opposé du centre
       de la pièce ». La nuance change tout : la seconde méthode place la caméra
       de trois quarts, et la première image du site montre alors un pan de
       façade avec une porte sur le côté. De face, on voit une porte. */
    const outward = wallNormal(front.a, front.b, startRoom);
    const outside = along(door, outward, APPROACH);
    entrance = { door: front, roomId: startId, outside };
    stops.push({
      point: outside,
      roomId: '',
      dwell: DWELL_ENTRANCE,
      lookAt: door,
      caption: options.opening ?? null,
      threshold: true,
      pitch: ENTRANCE_PITCH,
      fov: ENTRANCE_FOV,
    });
    stops.push({
      point: door,
      roomId: startId,
      dwell: 0,
      lookAt: null,
      caption: null,
      threshold: true,
      pitch: ENTRANCE_PITCH,
      fov: ENTRANCE_FOV,
    });
  }

  const legs = tourOrder(startId, rooms, doors, Boolean(options.closing));

  /* D'où l'on arrive dans la pièce courante. Pour la première, c'est le seuil de
     la porte palière — sans cette référence, le cadrage de la pièce d'entrée
     était calculé depuis son propre centre, donc depuis nulle part, et la
     caméra s'y plantait au milieu face à un mur. */
  let cameFrom: PlanPoint | null = front ? midpoint(front.a, front.b) : null;

  legs.forEach((leg, index) => {
    const room = byId.get(leg.roomId);
    if (!room) return;
    const centre = roomCenter(room);
    let arrival: PlanPoint | null = null;

    if (leg.via && index > 0) {
      const previous = byId.get(legs[index - 1].roomId);
      const door = midpoint(leg.via.a, leg.via.b);
      if (previous) {
        /*
         * On ne recule pas dans une pièce où l'on n'est pas entré.
         *
         * Ce point d'approche se pose à cinquante-cinq centimètres en avant de
         * la porte, du côté de la pièce qu'on quitte : c'est par lui qu'on se
         * présente devant l'ouverture au lieu de l'aborder de biais. Il n'a de
         * sens que si l'on vient de plus loin.
         *
         * Une petite pièce se regarde depuis son embrasure, à douze
         * centimètres du tableau. Le point d'approche était donc *derrière* la
         * caméra : la salle d'eau se visitait en entrant de quarante
         * centimètres pour aussitôt ressortir, et ce cul-de-sac imposait un
         * demi-tour de cent cinquante-cinq degrés dans une pièce d'un mètre
         * quatre-vingts de large. Quel que soit le chemin choisi par le regard,
         * il passait par un mur à soixante centimètres — mesuré, plein cadre.
         *
         * En supprimant l'aller-retour, le virage se fait en sortant, dans le
         * dégagement, où il y a la place de le faire.
         */
        const depuis = stops[stops.length - 1];
        if (!depuis || distance(depuis.point, door) > DOOR_MARGIN) {
          stops.push(passage(along(door, unit(door, roomCenter(previous)), DOOR_MARGIN), legs[index - 1].roomId));
        }
      }
      stops.push(passage(door, leg.roomId));
      const margin = roomArea(room) < SMALL_ROOM ? THRESHOLD_MARGIN : DOOR_MARGIN;
      arrival = along(door, unit(door, centre), margin);
    }

    /*
     * Où l'on se place pour regarder une pièce.
     *
     * Petite pièce : au seuil, et on la cadre en entier — au centre d'une salle
     * d'eau de trois mètres carrés, on est à quatre-vingt-dix centimètres de
     * chaque mur.
     *
     * Grande pièce : on entre, mais **pas jusqu'au milieu**. Se planter au
     * centre d'un séjour et regarder un mur, c'est l'avoir à deux mètres et
     * plein cadre. On s'arrête aux deux tiers du chemin entre la porte et le
     * centre, ce qui recule d'un mètre et laisse entrer les côtés de la pièce.
     * C'est là que se met un photographe d'intérieur, et c'est pour la même
     * raison.
     */
    const from = arrival ?? cameFrom;
    const cramped = roomArea(room) < SMALL_ROOM && arrival !== null;
    const stand = cramped ? arrival! : from ? backOff(room, from, centre) : centre;
    if (arrival && !cramped && distance(stand, arrival) > 0.3) {
      stops.push(passage(arrival, leg.roomId));
    }

    const first = !leg.revisit;
    stops.push({
      point: stand,
      roomId: leg.roomId,
      dwell: first ? DWELL_ROOM : 0,
      lookAt: first ? lookTarget(rooms, doors, photos, room, stand, cameFrom) : null,
      caption: first ? (options.captions?.[leg.roomId] ?? describeRoom(room, doors)) : null,
      threshold: cramped,
      pitch: first ? ROOM_PITCH : TRAVEL_PITCH,
      fov: first ? ROOM_FOV : TRAVEL_FOV,
    });
    cameFrom = stand;
  });

  if (options.closing && stops.length > 0) {
    const last = stops[stops.length - 1];
    stops.push({
      point: last.point,
      roomId: last.roomId,
      dwell: DWELL_CLOSING,
      /* Le mot de la fin a besoin d'une cible explicite. Sans elle, le cap se
         calculait entre le dernier sommet et… lui-même — deux points confondus,
         donc un angle indéfini, et la dernière image du site tombait où le
         hasard des flottants la mettait.

         Et cette cible n'est pas le mur de la pièce où l'on se trouve : c'est
         l'axe qui traverse le logement. Voir `openDirection`. */
      lookAt: openDirection(rooms, doors, last.point),
      caption: options.closing,
      threshold: false,
      pitch: ROOM_PITCH,
      fov: ROOM_FOV,
    });
  }

  return { stops, entrance };
}

const passage = (point: PlanPoint, roomId: string): Stop => ({
  point,
  roomId,
  dwell: 0,
  lookAt: null,
  caption: null,
  threshold: true,
  pitch: TRAVEL_PITCH,
  fov: TRAVEL_FOV,
});

/* ------------------------------------------------------- angles arrondis --- */

interface Vertex {
  point: PlanPoint;
  /** Index de l'arrêt d'origine, si ce sommet en porte un. */
  stop: number | null;
}

/**
 * Remplace un angle vif par un arc.
 *
 * Le rayon est borné à moins de la moitié du plus court des deux côtés : l'arc
 * reste alors dans le triangle formé par l'angle et ses deux points d'entrée,
 * donc à l'intérieur de la même pièce. On vérifie quand même chaque point de
 * l'arc, et on réduit le rayon tant qu'il sort — un plan relevé peut avoir une
 * pièce non convexe, et une caméra qui traverse un mur ruine tout le reste.
 *
 * Les arrêts ne sont jamais arrondis : on y pivote sur place, l'angle n'existe
 * pas. Les seuils non plus : ils longent les jambages par construction.
 */
function roundCorners(stops: Stop[], rooms: PlanRoom[]): Vertex[] {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const vertices: Vertex[] = [];

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    const previous = stops[index - 1];
    const next = stops[index + 1];
    if (!previous || !next || stop.dwell > 0 || stop.threshold) {
      vertices.push({ point: stop.point, stop: index });
      continue;
    }

    const room = byId.get(stop.roomId);
    const before = distance(previous.point, stop.point);
    const after = distance(stop.point, next.point);
    let radius = Math.min(CORNER_RADIUS, CORNER_SHARE * Math.min(before, after));
    const inward = unit(stop.point, previous.point);
    const outward = unit(stop.point, next.point);

    let arc: PlanPoint[] | null = null;
    for (let attempt = 0; attempt < 4 && radius > 0.05; attempt += 1) {
      const candidate = quadratic(
        along(stop.point, inward, radius),
        stop.point,
        along(stop.point, outward, radius),
      );
      if (!room || candidate.every((point) => containsPoint(room, point))) {
        arc = candidate;
        break;
      }
      radius /= 2;
    }

    if (!arc) {
      vertices.push({ point: stop.point, stop: index });
      continue;
    }
    const middle = Math.floor(arc.length / 2);
    arc.forEach((point, position) => vertices.push({ point, stop: position === middle ? index : null }));
  }

  return vertices;
}

/**
 * Le sommet situé au moins `reach` mètres plus loin sur le trajet, sans franchir
 * le prochain arrêt.
 *
 * Renvoie le dernier sommet atteignable quand il n'y a plus assez de chemin
 * devant, et rien du tout si l'on est déjà au bout.
 *
 * La borne sur l'arrêt n'est pas un détail. Le parcours d'un logement revient
 * sur ses pas — on ressort d'une chambre par où l'on y est entré — et une salle
 * d'eau de trois mètres carrés est plus courte que la portée du regard. Sans
 * cette borne, à l'entrée de la salle d'eau, « devant soi » désignait un sommet
 * du chemin de retour : la caméra regardait derrière elle, à quarante
 * centimètres du chambranle, pendant qu'elle avançait. Un arrêt est la fin d'un
 * mouvement ; on ne regarde pas au-delà.
 */
function aheadOf(vertices: Vertex[], from: number, reach: number): Vertex | null {
  let walked = 0;
  let last: Vertex | null = null;
  for (let index = from + 1; index < vertices.length; index += 1) {
    walked += distance(vertices[index - 1].point, vertices[index].point);
    last = vertices[index];
    if (walked >= reach) return last;
    if (vertices[index].stop !== null) break;
  }
  return last;
}

/** Bézier quadratique échantillonnée, extrémités comprises. */
function quadratic(a: PlanPoint, control: PlanPoint, b: PlanPoint): PlanPoint[] {
  const points: PlanPoint[] = [];
  for (let step = 0; step <= CORNER_SAMPLES; step += 1) {
    const s = step / CORNER_SAMPLES;
    const inverse = 1 - s;
    points.push({
      x: inverse * inverse * a.x + 2 * inverse * s * control.x + s * s * b.x,
      y: inverse * inverse * a.y + 2 * inverse * s * control.y + s * s * b.y,
    });
  }
  return points;
}

/* ==================================================== construction finale === */

/**
 * Fabrique la timeline complète depuis un plan.
 *
 * Aucun parcours n'est écrit à la main : n'importe quel logement relevé produit
 * le sien. C'était la condition pour que le procédé serve à plus d'un bien —
 * sinon chaque nouveau client demanderait de rouvrir le code.
 */
export function buildJourney(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  options: JourneyOptions = {},
): Journey {
  const empty: Journey = {
    path: [],
    view: [],
    captions: [],
    rooms: [],
    entrance: null,
    doorOpens: { from: 0, to: 0 },
    metres: 0,
  };
  if (rooms.length === 0) return empty;

  const { stops, entrance } = layout(rooms, doors, options);
  if (stops.length < 2) return empty;

  const vertices = roundCorners(stops, rooms);

  /* Le coût cumulé mêle les mètres marchés et les arrêts, exprimés dans la même
     unité. C'est lui qui devient `t` : le curseur avance à vitesse constante
     pendant la marche, et continue d'avancer pendant qu'on regarde. */
  let cost = 0;
  let walked = 0;
  const arrive: number[] = [];
  const depart: number[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    if (index > 0) {
      const step = distance(vertices[index - 1].point, vertices[index].point);
      cost += step;
      walked += step;
    }
    arrive[index] = cost;
    const stopIndex = vertices[index].stop;
    const dwell = stopIndex === null ? 0 : stops[stopIndex].dwell;
    cost += dwell;
    depart[index] = cost;
  }
  const total = cost > 0 ? cost : 1;

  const path: PathPoint[] = [];
  const view: ViewKey[] = [];
  const captions: Caption[] = [];
  const visited: { roomId: string; t: number }[] = [];
  let lastHeading = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    const stop = vertex.stop === null ? null : stops[vertex.stop];
    const tIn = arrive[index] / total;
    const tOut = depart[index] / total;

    path.push({ t: tIn, x: vertex.point.x, y: vertex.point.y });
    if (tOut > tIn) path.push({ t: tOut, x: vertex.point.x, y: vertex.point.y });

    /* Deux sommets confondus ne définissent aucune direction — et il y en a :
       un arrêt sur place produit deux sommets au même endroit. On reprend alors
       le dernier cap connu, ou la cible qu'on est venu regarder, plutôt que de
       lire le résultat d'un `atan2(0, 0)`. C'est ce qui décidait, jusqu'ici, de
       l'orientation de la toute dernière image du site. */
    const before = vertices[index - 1];
    const after = aheadOf(vertices, index, LOOKAHEAD);
    const incoming =
      before && distance(before.point, vertex.point) > 1e-6
        ? heading(before.point, vertex.point)
        : lastHeading;
    const forward =
      after && distance(vertex.point, after.point) > 1e-6
        ? heading(vertex.point, after.point)
        : null;
    const target = stop?.lookAt ? heading(vertex.point, stop.lookAt) : null;
    const outgoing = forward ?? target ?? incoming;
    const arrival = before ? incoming : outgoing;
    lastHeading = outgoing;
    const pitch = stop?.pitch ?? TRAVEL_PITCH;
    const fov = stop?.fov ?? TRAVEL_FOV;

    if (tOut <= tIn) {
      // Simple point de passage : on regarde devant soi, sans à-coup.
      view.push({ t: tIn, yaw: outgoing, pitch, fov, ease: 'linear' });
      continue;
    }

    const span = tOut - tIn;
    // Au tout premier sommet il n'y a pas de marche derrière soi : la pose de
    // l'arrêt est aussi la pose de départ, sinon la page s'ouvre sur un
    // recadrage que personne n'a demandé.
    view.push({
      t: tIn,
      yaw: arrival,
      pitch: before ? TRAVEL_PITCH : pitch,
      fov: before ? TRAVEL_FOV : fov,
      ease: 'linear',
    });
    if (target !== null) {
      /* Le virage passe par le cap le plus dégagé, pas par le plus court chemin
         géométrique : voir `throughOpen`. */
      const relay = throughOpen(rooms, doors, vertex.point, arrival, target);
      if (relay !== null) {
        view.push({ t: tIn + span * 0.19, yaw: relay, pitch, fov, ease: 'smooth' });
      }
      view.push({ t: tIn + span * 0.38, yaw: target, pitch, fov, ease: 'smooth' });
      view.push({ t: tIn + span * 0.72, yaw: target, pitch, fov, ease: 'linear' });
    } else {
      view.push({ t: tIn + span * 0.5, yaw: arrival, pitch, fov, ease: 'smooth' });
    }
    /*
     * On repart en tournant, et non l'inverse.
     *
     * La clé de fin d'arrêt portait déjà le cap de la marche suivante : le
     * demi-tour se faisait donc sur place. Dans une chambre de onze mètres
     * carrés, un virage de cent soixante-dix degrés à l'arrêt balaie forcément
     * un mur à un mètre quatre-vingts, et le cadre se remplit de peinture.
     *
     * En gardant ici le cap de l'arrêt, le virage s'étale sur le premier mètre
     * et demi de marche — c'est le sommet suivant qui pose le cap de sortie. Le
     * mur balayé s'éloigne pendant qu'on le balaie, et l'ouverture par laquelle
     * on sort entre dans le cadre avant la fin du virage.
     */
    view.push({
      t: tOut,
      yaw: target ?? outgoing,
      pitch: TRAVEL_PITCH,
      fov: TRAVEL_FOV,
      ease: 'smooth',
    });

    /*
     * La sortie d'arrêt balaie, elle aussi.
     *
     * L'entrée dans une pièce passait déjà par le cap le plus dégagé de son
     * arc ; la sortie, non — elle allait tout droit de ce qu'on regardait vers
     * l'ouverture par laquelle on repart. Dans une salle d'eau de trois mètres
     * et demi, ces deux caps sont à cent cinquante degrés l'un de l'autre et le
     * chemin le plus court passe par le mur mitoyen de la chambre, à soixante
     * centimètres : un contrôle mesure l'aplat de peinture pendant huit
     * millièmes du parcours, et l'œil, lui, le voit.
     *
     * Le relais est posé dans la marche, pas dans l'arrêt : c'est ce qui fait
     * la différence entre un regard qui tourne en avançant et un demi-tour sur
     * place. On le calcule depuis le point de l'arrêt, dont la caméra ne s'est
     * pas encore beaucoup éloignée à cet instant.
     */
    const tSuivant = index + 1 < vertices.length ? arrive[index + 1] / total : null;
    if (tSuivant !== null && tSuivant > tOut) {
      const sortie = throughOpen(rooms, doors, vertex.point, target ?? outgoing, outgoing);
      if (sortie !== null) {
        view.push({
          t: tOut + (tSuivant - tOut) * 0.4,
          yaw: sortie,
          pitch: TRAVEL_PITCH,
          fov: TRAVEL_FOV,
          ease: 'smooth',
        });
      }
    }

    if (stop?.caption) {
      captions.push({
        id: `${stop.roomId || 'seuil'}-${captions.length}`,
        ...stop.caption,
        from: tIn,
        // La légende survit un peu au départ : on relit en marchant, et une
        // disparition pile au moment où l'on repart passe pour un bug. Un peu
        // seulement : à 35 %, le nom du dégagement tenait encore l'écran alors
        // que la chambre était déjà en vue.
        to: Math.min(1, tOut + span * 0.2),
      });
    }
    if (stop && stop.roomId && !visited.some((entry) => entry.roomId === stop.roomId)) {
      visited.push({ roomId: stop.roomId, t: tIn });
    }
  }

  /* Le battant s'ouvre entre le moment où l'on quitte le seuil et celui où on
     le franchit : il est grand ouvert à l'instant exact du passage, et il reste
     fermé pendant qu'on lit le panneau d'accueil, devant. */
  const threshold = vertices.findIndex((vertex) => vertex.stop === 1);
  const doorOpens =
    entrance && threshold > 0
      ? { from: depart[0] / total, to: arrive[threshold] / total }
      : { from: 0, to: 0 };

  return { path, view, captions, rooms: visited, entrance, doorOpens, metres: walked };
}
