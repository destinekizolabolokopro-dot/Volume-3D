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
 * On raisonne donc à largeur constante, et on plafonne : au-delà d'une centaine
 * de degrés de vertical, la déformation aux bords devient plus gênante que le
 * cadrage n'est utile.
 */
const REFERENCE_ASPECT = 16 / 9;
const MAX_VERTICAL_FOV = 96;

export function verticalFov(base: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0 || aspect >= REFERENCE_ASPECT) return base;
  const halfWidth = Math.tan((base * Math.PI) / 360) * REFERENCE_ASPECT;
  const widened = (2 * Math.atan(halfWidth / aspect) * 180) / Math.PI;
  return Math.min(MAX_VERTICAL_FOV, Math.max(base, widened));
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
 * Avec `returnToStart`, on garde le chemin du retour — c'est ce qu'on veut quand
 * la visite se termine par un mot de conclusion, parce que le dernier plan
 * tombe alors dans la plus grande pièce et non dans la salle d'eau. Terminer une
 * visite d'appartement sur trois mètres carrés de salle de bains gâche tout le
 * bénéfice de ce qui précède.
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

  if (!returnToStart) {
    while (legs.length > 1 && legs[legs.length - 1].revisit) legs.pop();
  }
  return legs;
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
  from: PlanPoint,
): PlanPoint {
  const walls = roomWalls(room);
  if (walls.length === 0) return roomCenter(room);
  let best = 0;
  let bestScore = -Infinity;
  for (let index = 0; index < walls.length; index += 1) {
    const wall = walls[index];
    const length = distance(wall.a, wall.b);
    const hasPhoto = photos.some(
      (photo) => photo.roomId === room.id && photo.wallIndex % walls.length === index,
    );
    const hasWindow = doors.some(
      (door) =>
        door.kind === 'window' &&
        (door.from === room.id || door.to === room.id) &&
        nearSegment(midpoint(door.a, door.b), wall.a, wall.b),
    );
    const score = length + (hasPhoto ? 120 : 0) + (hasWindow ? 60 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }

  /* Quatre-vingts pour cent du mur plutôt que son extrémité franche : on veut
     une diagonale, pas un coin de pièce plein cadre. */
  const wall = walls[best];
  const towardB = distance(from, wall.b) > distance(from, wall.a);
  return pointAt(wall, towardB ? 0.82 : 0.18);
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

/** Le milieu du mur le plus éloigné : ce qu'on regarde depuis une embrasure. */
function farthestWall(room: PlanRoom, from: PlanPoint): PlanPoint {
  const walls = roomWalls(room);
  if (walls.length === 0) return roomCenter(room);
  let best = midpoint(walls[0].a, walls[0].b);
  for (const wall of walls) {
    const centre = midpoint(wall.a, wall.b);
    if (distance(from, centre) > distance(from, best)) best = centre;
  }
  return best;
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
        stops.push(passage(along(door, unit(door, roomCenter(previous)), DOOR_MARGIN), legs[index - 1].roomId));
      }
      stops.push(passage(door, leg.roomId));
      arrival = along(door, unit(door, centre), DOOR_MARGIN);
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
      lookAt: first
        ? cramped
          ? farthestWall(room, stand)
          : focusOf(room, doors, photos, from ?? stand)
        : null,
      caption: first ? (options.captions?.[leg.roomId] ?? describeRoom(room, doors)) : null,
      threshold: cramped,
      pitch: first ? ROOM_PITCH : TRAVEL_PITCH,
      fov: first ? ROOM_FOV : TRAVEL_FOV,
    });
    cameFrom = stand;
  });

  if (options.closing && stops.length > 0) {
    const last = stops[stops.length - 1];
    const room = byId.get(last.roomId);
    stops.push({
      point: last.point,
      roomId: last.roomId,
      dwell: DWELL_CLOSING,
      /* Le mot de la fin a besoin d'une cible explicite. Sans elle, le cap se
         calculait entre le dernier sommet et… lui-même — deux points confondus,
         donc un angle indéfini, et la dernière image du site tombait où le
         hasard des flottants la mettait. */
      lookAt: room ? focusOf(room, doors, photos, last.point) : null,
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
 * Le sommet situé au moins `reach` mètres plus loin sur le trajet.
 *
 * Renvoie le dernier sommet quand il n'y a plus assez de chemin devant, et rien
 * du tout si l'on est déjà au bout.
 */
function aheadOf(vertices: Vertex[], from: number, reach: number): Vertex | null {
  let walked = 0;
  for (let index = from + 1; index < vertices.length; index += 1) {
    walked += distance(vertices[index - 1].point, vertices[index].point);
    if (walked >= reach) return vertices[index];
  }
  return vertices.length - 1 > from ? vertices[vertices.length - 1] : null;
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
      view.push({ t: tIn + span * 0.38, yaw: target, pitch, fov, ease: 'smooth' });
      view.push({ t: tIn + span * 0.72, yaw: target, pitch, fov, ease: 'linear' });
    } else {
      view.push({ t: tIn + span * 0.5, yaw: arrival, pitch, fov, ease: 'smooth' });
    }
    view.push({ t: tOut, yaw: outgoing, pitch: TRAVEL_PITCH, fov: TRAVEL_FOV, ease: 'smooth' });

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
