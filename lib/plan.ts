import type { FloorPlan, PlanDoor, PlanOpeningKind, PlanPoint, PlanRoom } from './types';

/**
 * Géométrie des visites reconstruites depuis un plan.
 *
 * Tout ici est pur : des polygones en mètres entrent, des segments de murs
 * sortent. Aucune dépendance au moteur de rendu ni au réseau, donc tout est
 * vérifiable par des tests — ce qui compte, parce que c'est cette géométrie
 * qui décide si le volume affiché correspond au logement réel.
 *
 * Repère : x vers la droite, y vers le bas, comme sur l'image du plan. La
 * conversion en repère 3D (y devient la profondeur, la hauteur monte) est
 * faite au dernier moment, dans le viewer.
 */

/** Tolérance de rattachement d'une ouverture à un mur, en mètres. */
const WALL_SNAP = 0.25;

/** En deçà, deux points sont considérés confondus. */
const EPSILON = 1e-6;

export interface Segment {
  a: PlanPoint;
  b: PlanPoint;
}

export const distance = (a: PlanPoint, b: PlanPoint): number => Math.hypot(b.x - a.x, b.y - a.y);

export const midpoint = (a: PlanPoint, b: PlanPoint): PlanPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Surface du polygone, en m². Formule du lacet, en valeur absolue. */
export function roomArea(room: PlanRoom): number {
  const p = room.points;
  let total = 0;
  for (let i = 0; i < p.length; i += 1) {
    const q = p[(i + 1) % p.length];
    total += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(total) / 2;
}

/**
 * Point d'où le visiteur regarde la pièce.
 *
 * C'est le centroïde de surface, pas la moyenne des sommets : sur une pièce en
 * L, la moyenne des sommets tombe volontiers dans un mur. Si le centroïde sort
 * malgré tout du polygone — cas des formes très concaves — on retombe sur le
 * centre de la boîte englobante, puis sur le premier sommet.
 */
export function roomCenter(room: PlanRoom): PlanPoint {
  const p = room.points;
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < p.length; i += 1) {
    const q = p[(i + 1) % p.length];
    const cross = p[i].x * q.y - q.x * p[i].y;
    twiceArea += cross;
    x += (p[i].x + q.x) * cross;
    y += (p[i].y + q.y) * cross;
  }
  if (Math.abs(twiceArea) > EPSILON) {
    const centroid = { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
    if (containsPoint(room, centroid)) return centroid;
  }
  const box = roomBounds(room);
  const middle = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  return containsPoint(room, middle) ? middle : p[0];
}

export function roomBounds(room: PlanRoom) {
  const xs = room.points.map((p) => p.x);
  const ys = room.points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function planBounds(rooms: PlanRoom[]) {
  const boxes = rooms.map(roomBounds);
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

/** Test d'appartenance par lancer de rayon. */
export function containsPoint(room: PlanRoom, point: PlanPoint): boolean {
  const p = room.points;
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
    const crossesY = p[i].y > point.y !== p[j].y > point.y;
    if (!crossesY) continue;
    const atX = ((p[j].x - p[i].x) * (point.y - p[i].y)) / (p[j].y - p[i].y) + p[i].x;
    if (point.x < atX) inside = !inside;
  }
  return inside;
}

/** Les murs de la pièce, dans l'ordre du polygone. */
export function roomWalls(room: PlanRoom): Segment[] {
  return room.points.map((a, index) => ({ a, b: room.points[(index + 1) % room.points.length] }));
}

/* ------------------------------------------------------- percement des murs */

/** Portion d'un mur, exprimée en fraction de sa longueur. */
export interface Interval {
  from: number;
  to: number;
}

/**
 * Projette une ouverture sur un mur.
 *
 * Rend l'intervalle occupé sur ce mur, ou `null` si l'ouverture est ailleurs :
 * trop loin de la ligne du mur, ou en dehors de ses extrémités. C'est ce test
 * qui rattache une porte lue sur le plan au bon mur de la bonne pièce, sans
 * qu'on ait à le déclarer.
 */
export function projectOnWall(wall: Segment, door: Segment): Interval | null {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < EPSILON) return null;

  const project = (point: PlanPoint) => {
    const t = ((point.x - wall.a.x) * dx + (point.y - wall.a.y) * dy) / lengthSquared;
    const foot = { x: wall.a.x + t * dx, y: wall.a.y + t * dy };
    return { t, gap: distance(point, foot) };
  };

  const first = project(door.a);
  const second = project(door.b);
  if (first.gap > WALL_SNAP || second.gap > WALL_SNAP) return null;

  const from = Math.max(0, Math.min(first.t, second.t));
  const to = Math.min(1, Math.max(first.t, second.t));
  // Une ouverture entièrement hors du mur, ou réduite à un point, ne perce rien.
  if (to - from < EPSILON) return null;
  return { from, to };
}

/** Fusionne les intervalles qui se chevauchent, et les trie. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.from - b.from);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.from <= last.to + EPSILON) last.to = Math.max(last.to, interval.to);
    else merged.push({ ...interval });
  }
  return merged;
}

/** Les portions pleines d'un mur, une fois les ouvertures retirées. */
export function solidSpans(openings: Interval[]): Interval[] {
  const spans: Interval[] = [];
  let cursor = 0;
  for (const hole of mergeIntervals(openings)) {
    if (hole.from - cursor > EPSILON) spans.push({ from: cursor, to: hole.from });
    cursor = Math.max(cursor, hole.to);
  }
  if (1 - cursor > EPSILON) spans.push({ from: cursor, to: 1 });
  return spans;
}

export const pointAt = (wall: Segment, t: number): PlanPoint => ({
  x: wall.a.x + (wall.b.x - wall.a.x) * t,
  y: wall.a.y + (wall.b.y - wall.a.y) * t,
});

/* ------------------------------------------------------------ déplacement */

/** Distance d'un point à un segment, en mètres. */
export function distanceToSegment(point: PlanPoint, segment: Segment): number {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < EPSILON) return distance(point, segment.a);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared),
  );
  return distance(point, { x: segment.a.x + t * dx, y: segment.a.y + t * dy });
}

/**
 * Vrai si le visiteur peut se tenir là.
 *
 * Il ne suffit pas d'être dans le polygone : il faut aussi ne pas avoir le nez
 * dans le mur. La marge représente l'encombrement du visiteur — sans elle, on
 * peut avancer jusqu'à traverser la cloison et voir la pièce d'à côté.
 */
export function canStandAt(room: PlanRoom, point: PlanPoint, margin = 0.35): boolean {
  if (!containsPoint(room, point)) return false;
  return roomWalls(room).every((wall) => distanceToSegment(point, wall) >= margin);
}

/**
 * Ramène un déplacement à ce qui est franchissable.
 *
 * On tente le pas complet ; s'il est bloqué, on tente chaque axe séparément.
 * C'est ce qui permet de glisser le long d'un mur au lieu de s'y coller net,
 * comportement attendu de n'importe quelle visite où l'on marche.
 */
export function slideMove(room: PlanRoom, from: PlanPoint, to: PlanPoint, margin = 0.35): PlanPoint {
  if (canStandAt(room, to, margin)) return to;
  const alongX = { x: to.x, y: from.y };
  if (canStandAt(room, alongX, margin)) return alongX;
  const alongY = { x: from.x, y: to.y };
  if (canStandAt(room, alongY, margin)) return alongY;
  return from;
}

/**
 * Point atteignable le plus avancé sur le trajet vers une cible.
 *
 * Une tape tombe souvent au-delà d'un mur — dans une pièce de quatre mètres,
 * c'est même le cas le plus fréquent. Ne rien faire donnerait l'impression que
 * la commande est cassée : on avance donc aussi loin que possible dans cette
 * direction, ce qui est exactement ce qu'on attend en tapant sur un mur.
 *
 * Recherche par dichotomie sur le segment, ce qui converge au centimètre en une
 * douzaine d'essais quelle que soit la distance.
 */
export function reachableToward(
  room: PlanRoom,
  from: PlanPoint,
  to: PlanPoint,
  margin = 0.35,
  precision = 0.01,
): PlanPoint | null {
  // Le point de départ d'abord : si le visiteur n'est pas dans la pièce, rien
  // ne doit le téléporter à l'intérieur.
  if (!canStandAt(room, from, margin)) return null;
  if (canStandAt(room, to, margin)) return to;

  let low = 0;
  let high = 1;
  const at = (t: number) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  const span = distance(from, to);
  if (span < precision) return null;

  while ((high - low) * span > precision) {
    const middle = (low + high) / 2;
    if (canStandAt(room, at(middle), margin)) low = middle;
    else high = middle;
  }
  const result = at(low);
  // Un pas de moins d'un centimètre ne vaut pas la peine d'être joué.
  return distance(from, result) < precision ? null : result;
}

/**
 * Vrai si l'on peut se tenir en ce point, dans le logement pris comme un tout.
 *
 * `canStandAt` raisonne pièce par pièce, ce qui convient à une visite où l'on
 * saute d'une pièce à l'autre. Une visite libre, elle, traverse : la contrainte
 * devient « rester dans le logement ». Reste le cas du seuil — on y frôle les
 * jambages par construction, et appliquer la marge habituelle interdirait de
 * franchir la moindre porte. On l'autorise donc à condition d'être réellement
 * dans l'une des deux pièces que la porte relie.
 */
export function standableAnywhere(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  point: PlanPoint,
  /* Plus généreuse que celle de la marche pièce par pièce (0,35 m), et pour une
     raison de cadrage : collé à trente centimètres d'une cloison, on ne voit
     plus qu'un aplat. Quarante-cinq centimètres, c'est la distance à laquelle un
     mur reste un mur. Le dégagement en garde cinquante de large, de quoi
     passer. */
  margin = 0.45,
): boolean {
  if (rooms.some((room) => canStandAt(room, point, margin))) return true;

  const passage = doors.find(
    (door) => door.kind !== 'window' && distanceToSegment(point, { a: door.a, b: door.b }) < 0.6,
  );
  if (!passage) return false;
  return rooms.some(
    (room) => (room.id === passage.from || room.id === passage.to) && containsPoint(room, point),
  );
}

/**
 * Le déplacement le plus proche de celui demandé, sans traverser de cloison.
 *
 * Même principe que `slideMove` — on tente le pas entier, puis chaque axe — mais
 * à l'échelle du logement, seuils compris.
 */
export function slideAnywhere(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  from: PlanPoint,
  to: PlanPoint,
  margin = 0.45,
): PlanPoint {
  if (standableAnywhere(rooms, doors, to, margin)) return to;
  const alongX = { x: to.x, y: from.y };
  if (standableAnywhere(rooms, doors, alongX, margin)) return alongX;
  const alongY = { x: from.x, y: to.y };
  if (standableAnywhere(rooms, doors, alongY, margin)) return alongY;
  return from;
}

/**
 * Le point le plus avancé qu'on puisse atteindre en ligne droite, dans tout le
 * logement.
 *
 * Une tape au sol tombe très souvent au-delà d'un mur — dans un séjour de cinq
 * mètres c'est même le cas le plus fréquent, et sur un téléphone tenu debout
 * c'est presque systématique parce que le bas de l'écran vise loin. Ne rien
 * faire donnerait l'impression que la commande est cassée ; on avance donc aussi
 * loin que le trajet le permet.
 *
 * **On avance pas à pas, et surtout pas par dichotomie.** La dichotomie suppose
 * que « atteignable » est vrai jusqu'à un point puis faux — c'est le cas dans
 * une pièce convexe (`reachableToward`), ça ne l'est pas dans un logement : le
 * rayon traverse une cloison, puis retombe dans la pièce d'à côté, qui est
 * atteignable elle aussi. La recherche par dichotomie trouvait alors ce point-là
 * et faisait passer la caméra à travers le mur. La marche, elle, s'arrête au
 * premier obstacle rencontré, ce qui est la seule lecture correcte.
 */
export function reachableAnywhere(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  from: PlanPoint,
  to: PlanPoint,
  margin = 0.45,
  step = 0.04,
): PlanPoint | null {
  const span = distance(from, to);
  if (span < step) return null;

  const direction = { x: (to.x - from.x) / span, y: (to.y - from.y) / span };
  let travelled = 0;
  let last: PlanPoint | null = null;
  let blocked = false;
  while (travelled + step <= span) {
    travelled += step;
    const probe = { x: from.x + direction.x * travelled, y: from.y + direction.y * travelled };
    if (!standableAnywhere(rooms, doors, probe, margin)) {
      blocked = true;
      break;
    }
    last = probe;
  }
  // Rien n'a bloqué et la cible elle-même tient : on la rend telle quelle,
  // plutôt qu'au dernier multiple du pas.
  if (!blocked && standableAnywhere(rooms, doors, to, margin)) return to;
  return last;
}

/** La pièce qui contient un point, s'il y en a une. */
export const roomAt = (rooms: PlanRoom[], point: PlanPoint): PlanRoom | null =>
  rooms.find((room) => containsPoint(room, point)) ?? null;

/* ------------------------------------------------------------- navigation */

/** Les pièces accessibles depuis une pièce donnée, via une ouverture franchissable. */
export function exitsFrom(roomId: string, doors: PlanDoor[]): { door: PlanDoor; targetId: string }[] {
  const exits: { door: PlanDoor; targetId: string }[] = [];
  for (const door of doors) {
    // Une fenêtre ne mène nulle part, et une ouverture sans destination non plus.
    if (door.kind === 'window') continue;
    if (door.from === roomId && door.to) exits.push({ door, targetId: door.to });
    else if (door.to === roomId && door.from) exits.push({ door, targetId: door.from });
  }
  return exits;
}

/* --------------------------------------------------------------- contrôle */

export class PlanError extends Error {}

/**
 * Vérifie qu'un plan est exploitable avant de le montrer à qui que ce soit.
 *
 * Ces contrôles ne sont pas décoratifs : le plan vient d'une lecture
 * automatique, qui peut se tromper. Mieux vaut refuser un plan incohérent que
 * publier un logement dont les dimensions sont fausses.
 */
export function assertPlanIsUsable(rooms: PlanRoom[], doors: PlanDoor[]): void {
  if (rooms.length === 0) throw new PlanError('Aucune pièce n’a été trouvée sur le plan.');

  const seen = new Set<string>();
  for (const room of rooms) {
    if (!room.id) throw new PlanError('Une pièce est sans identifiant.');
    if (seen.has(room.id)) throw new PlanError(`Deux pièces portent l’identifiant « ${room.id} ».`);
    seen.add(room.id);

    if (room.points.length < 3) throw new PlanError(`La pièce « ${room.name} » n’a pas de contour.`);
    // Une pièce de moins d'un mètre carré est une erreur de lecture, pas un placard.
    if (roomArea(room) < 1) throw new PlanError(`La pièce « ${room.name} » fait moins d’un m².`);
    if (room.height < 1.8 || room.height > 6) {
      throw new PlanError(`Hauteur sous plafond irréaliste pour « ${room.name} » : ${room.height} m.`);
    }
  }

  for (const door of doors) {
    if (!seen.has(door.from)) throw new PlanError(`Une ouverture part d’une pièce inconnue : « ${door.from} ».`);
    if (door.to && !seen.has(door.to)) {
      throw new PlanError(`Une ouverture mène vers une pièce inconnue : « ${door.to} ».`);
    }
    const width = distance(door.a, door.b);
    if (width < 0.4 || width > 6) throw new PlanError(`Largeur d’ouverture irréaliste : ${width.toFixed(2)} m.`);
  }
}

/**
 * Recale le plan sur la surface annoncée par le propriétaire.
 *
 * Une lecture automatique donne des proportions justes mais une échelle
 * incertaine : le modèle déduit les mètres des cotes écrites sur le plan, qui
 * sont parfois absentes ou illisibles. La surface totale, elle, le propriétaire
 * la connaît — c'est le chiffre de son annonce. On s'en sert comme mètre étalon.
 */
export function rescaleToArea(rooms: PlanRoom[], doors: PlanDoor[], declaredArea: number) {
  const measured = rooms.reduce((total, room) => total + roomArea(room), 0);
  if (declaredArea <= 0 || measured <= 0) return { rooms, doors, factor: 1 };

  const factor = Math.sqrt(declaredArea / measured);
  // Sous 2 % d'écart, recaler n'apporte rien et brouille les cotes d'origine.
  if (Math.abs(factor - 1) < 0.02) return { rooms, doors, factor: 1 };

  const scalePoint = (p: PlanPoint): PlanPoint => ({ x: p.x * factor, y: p.y * factor });
  return {
    rooms: rooms.map((room) => ({ ...room, points: room.points.map(scalePoint) })),
    doors: doors.map((door) => ({ ...door, a: scalePoint(door.a), b: scalePoint(door.b) })),
    factor,
  };
}

/** Surface totale du logement, en m², telle que mesurée sur le plan. */
export const totalArea = (rooms: PlanRoom[]): number => rooms.reduce((sum, room) => sum + roomArea(room), 0);

/** Les pièces d'un plan, dans l'ordre où on veut les proposer au visiteur. */
export function orderedRooms(plan: FloorPlan): PlanRoom[] {
  return [...plan.rooms].sort((a, b) => roomArea(b) - roomArea(a));
}


/* ==========================================================================
   Lecture d'un relevé

   Le modèle qui lit le plan rend du JSON ; ces fonctions le transforment en
   géométrie utilisable, ou refusent. Elles sont ici, avec le reste de la
   logique pure, et non dans le module qui appelle l'API : c'est là que se
   prennent les décisions, donc c'est là que portent les tests.
   ========================================================================== */

export interface PlanReading {
  rooms: PlanRoom[];
  doors: Omit<PlanDoor, 'planId'>[];
  /** Facteur appliqué pour recaler le plan sur la surface annoncée. */
  scaleFactor: number;
  /** Surface obtenue après recalage, en m². */
  area: number;
  model: string;
}

export interface PhotoAssignment {
  photoId: string;
  roomId: string;
  wallIndex: number;
}

const OPENING_KINDS: PlanOpeningKind[] = ['door', 'opening', 'window'];

/* ------------------------------------------------------------- validation */

const isPoint = (value: unknown): value is PlanPoint => {
  const point = value as PlanPoint;
  return (
    typeof point === 'object' &&
    point !== null &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
};

/** Identifiant utilisable comme clé et comme fragment d'URL. */
const cleanId = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/**
 * Transforme la réponse du modèle en géométrie utilisable, ou échoue.
 *
 * Séparé de l'appel réseau pour être testable sans clé d'API : c'est ici que se
 * trouvent les décisions, l'appel n'est qu'un transport.
 */
export function parsePlanReading(raw: unknown, declaredArea: number, model = 'inconnu'): PlanReading {
  const payload = raw as { rooms?: unknown; doors?: unknown; note?: unknown };
  if (!Array.isArray(payload?.rooms)) throw new PlanError('Le relevé ne contient aucune pièce.');
  if (payload.rooms.length === 0) {
    const note = typeof payload.note === 'string' && payload.note ? ` ${payload.note}` : '';
    throw new PlanError(`Aucune pièce n’a pu être relevée sur ce document.${note}`);
  }

  const rooms: PlanRoom[] = payload.rooms.map((entry, index) => {
    const room = entry as Partial<PlanRoom>;
    const points = Array.isArray(room.points) ? room.points.filter(isPoint) : [];
    const id = cleanId(room.id) || `piece-${index + 1}`;
    return {
      id,
      name: String(room.name ?? id).slice(0, 60) || id,
      // Une hauteur absente ou farfelue est ramenée au standard français.
      height: Number.isFinite(room.height) && room.height! >= 1.8 && room.height! <= 6 ? room.height! : 2.5,
      points,
    };
  });

  const known = new Set(rooms.map((room) => room.id));
  const doors: Omit<PlanDoor, 'planId'>[] = (Array.isArray(payload.doors) ? payload.doors : [])
    .map((entry, index) => {
      const door = entry as Partial<PlanDoor>;
      const kind = OPENING_KINDS.includes(door.kind as PlanOpeningKind) ? (door.kind as PlanOpeningKind) : 'door';
      const from = cleanId(door.from);
      const to = cleanId(door.to);
      return {
        id: `ouverture-${index + 1}`,
        from,
        // Une destination inconnue vaut « extérieur » : mieux vaut une ouverture
        // qui ne mène nulle part qu'un passage vers une pièce inexistante.
        to: known.has(to) ? to : '',
        kind,
        height: Number.isFinite(door.height) && door.height! > 1.4 ? door.height! : kind === 'window' ? 2.2 : 2.05,
        sill: Number.isFinite(door.sill) && door.sill! >= 0 ? door.sill! : kind === 'window' ? 0.9 : 0,
        a: isPoint(door.a) ? door.a : { x: 0, y: 0 },
        b: isPoint(door.b) ? door.b : { x: 0, y: 0 },
      };
    })
    // Une ouverture rattachée à une pièce inconnue n'a nulle part où exister.
    .filter((door) => known.has(door.from));

  const scaled = rescaleToArea(rooms, doors as PlanDoor[], declaredArea);
  assertPlanIsUsable(scaled.rooms, scaled.doors);

  return {
    rooms: scaled.rooms,
    doors: scaled.doors,
    scaleFactor: scaled.factor,
    area: totalArea(scaled.rooms),
    model,
  };
}


/** Validation du rattachement, isolée pour être testable sans appel réseau. */
export function parseAssignments(raw: unknown, rooms: PlanRoom[], photoIds: string[]): PhotoAssignment[] {
  const payload = raw as { assignments?: unknown };
  if (!Array.isArray(payload?.assignments)) return [];
  const known = new Map(rooms.map((room) => [room.id, room.points.length]));
  const wanted = new Set(photoIds);

  const seen = new Set<string>();
  const result: PhotoAssignment[] = [];
  for (const entry of payload.assignments) {
    const assignment = entry as Partial<PhotoAssignment>;
    const photoId = String(assignment.photoId ?? '');
    const roomId = cleanId(assignment.roomId);
    const walls = known.get(roomId);
    // On écarte tout ce qui ne correspond pas à une photo et à une pièce
    // réellement présentes, ainsi que les doublons.
    if (!wanted.has(photoId) || seen.has(photoId) || walls === undefined) continue;
    seen.add(photoId);
    const index = Number(assignment.wallIndex);
    result.push({
      photoId,
      roomId,
      wallIndex: Number.isInteger(index) && index >= 0 ? index % walls : 0,
    });
  }
  return result;
}
