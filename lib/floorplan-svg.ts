import {
  distance,
  midpoint,
  planBounds,
  pointAt,
  projectOnWall,
  roomArea,
  roomBounds,
  roomCenter,
  roomWalls,
  solidSpans,
  totalArea,
  type Interval,
} from './plan.ts';
import type { FloorPlan, PlanDoor, PlanPoint, PlanRoom } from './types';

/**
 * Le plan du logement, redessiné proprement.
 *
 * Le propriétaire envoie une photo de son plan — souvent un scan gris, tordu,
 * illisible sur un téléphone. Le relevé en a tiré une géométrie exacte. Autant
 * la lui rendre sous une forme qu'il peut **publier** : Airbnb affiche les plans,
 * et un plan net rassure un voyageur autant qu'une photo.
 *
 * Tout est déterministe. Aucun modèle n'intervient ici : on dessine ce que le
 * relevé contient, et rien d'autre. Les surfaces affichées sont calculées, pas
 * recopiées d'une annonce.
 *
 * Le tracé suit les conventions du dessin d'architecture : murs épais, portes
 * en arc de cercle sur leur battement, fenêtres en trait fin double, cotes en
 * mètres. Un architecte le lit sans mode d'emploi, un voyageur aussi.
 */

export interface FloorPlanStyle {
  /** Couleur du trait des murs. */
  ink: string;
  /** Remplissage des pièces. */
  fill: string;
  /** Trait des ouvertures et des cotes. */
  hint: string;
  /** Fond de la feuille. */
  paper: string;
  /** Accent, réservé au titre et à l'échelle. */
  accent: string;
}

export const DEFAULT_STYLE: FloorPlanStyle = {
  ink: '#0f1418',
  fill: '#f1f3f6',
  hint: '#8b95a3',
  paper: '#ffffff',
  accent: '#1a63dc',
};

export interface FloorPlanOptions {
  /** Largeur du dessin en pixels. La hauteur suit les proportions du plan. */
  width?: number;
  style?: Partial<FloorPlanStyle>;
  /** Titre en haut à gauche. Vide pour n'en mettre aucun. */
  title?: string;
  /** Affiche le nom et la surface de chaque pièce. */
  labels?: boolean;
}

/** Épaisseur d'un mur au dessin, en mètres. */
const WALL = 0.11;

/** Marge autour du plan, en mètres. */
const MARGIN = 0.9;

/** Place laissée en haut pour le titre, en mètres. */
const HEADER = 1.1;

/** Place laissée en bas pour l'échelle, en mètres. */
const FOOTER = 1.0;

const round = (value: number): number => Math.round(value * 100) / 100;

/** Échappe le texte : un nom de pièce peut contenir « & » ou « < ». */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Surface en français : « 20,8 m² ». */
export function formatArea(area: number): string {
  return `${area.toFixed(1).replace('.', ',')} m²`;
}

/**
 * Ouvertures posées sur un mur donné, quelle que soit la pièce qui les déclare.
 *
 * Une porte est déclarée une seule fois, entre deux pièces ; elle doit percer
 * les deux. C'est le même principe que dans le viewer 3D.
 */
function openingsOnWall(wall: [PlanPoint, PlanPoint], doors: PlanDoor[]): Array<Interval & { door: PlanDoor }> {
  const found: Array<Interval & { door: PlanDoor }> = [];
  for (const door of doors) {
    const span = projectOnWall({ a: wall[0], b: wall[1] }, { a: door.a, b: door.b });
    if (span) found.push({ ...span, door });
  }
  return found;
}

/** Vecteur unitaire le long d'un mur, et sa normale. */
function frame(a: PlanPoint, b: PlanPoint) {
  const length = distance(a, b) || 1;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  return { length, ux, uy, nx: -uy, ny: ux };
}

/**
 * Dessine le plan.
 *
 * Rend une chaîne SVG autonome : elle s'ouvre dans un navigateur, se colle dans
 * un document, et se convertit en PNG sans rien installer.
 */
export function renderFloorPlan(
  plan: FloorPlan,
  doors: PlanDoor[],
  options: FloorPlanOptions = {},
): string {
  const rooms = plan.rooms;
  if (rooms.length === 0) return '';

  const style = { ...DEFAULT_STYLE, ...(options.style ?? {}) };
  const showLabels = options.labels !== false;
  const bounds = planBounds(rooms);

  // Repère du dessin : mètres du plan → unités SVG, origine en haut à gauche.
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const sheetW = contentW + MARGIN * 2;
  const sheetH = contentH + MARGIN * 2 + HEADER + FOOTER;

  const pxWidth = options.width ?? 1200;
  const scale = pxWidth / sheetW;
  const pxHeight = Math.round(sheetH * scale);

  /** Un point du plan dans le repère du dessin. */
  const X = (x: number) => round((x - bounds.minX + MARGIN) * scale);
  const Y = (y: number) => round((y - bounds.minY + MARGIN + HEADER) * scale);
  /** Une longueur en mètres, en pixels. */
  const L = (metres: number) => round(metres * scale);

  const parts: string[] = [];

  // --- fond ---
  parts.push(`<rect width="${pxWidth}" height="${pxHeight}" fill="${style.paper}"/>`);

  // --- sols ---
  for (const room of rooms) {
    const path = room.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
    parts.push(`<polygon points="${path}" fill="${style.fill}"/>`);
  }

  // --- murs, percés par les ouvertures ---
  const wallStroke = L(WALL);
  for (const room of rooms) {
    for (const wall of roomWalls(room)) {
      const segment: [PlanPoint, PlanPoint] = [wall.a, wall.b];
      const openings = openingsOnWall(segment, doors);
      // `Interval` est exprimé en fraction de la longueur du mur : c'est ce qui
      // permet de percer la même porte des deux côtés sans la redéclarer.
      for (const span of solidSpans(openings)) {
        const from = pointAt(wall, span.from);
        const to = pointAt(wall, span.to);
        parts.push(
          `<line x1="${X(from.x)}" y1="${Y(from.y)}" x2="${X(to.x)}" y2="${Y(to.y)}" ` +
            `stroke="${style.ink}" stroke-width="${wallStroke}" stroke-linecap="square"/>`,
        );
      }
    }
  }

  // --- ouvertures ---
  for (const door of doors) {
    const { length, ux, uy, nx, ny } = frame(door.a, door.b);

    if (door.kind === 'window') {
      // Fenêtre : deux traits fins dans l'épaisseur du mur.
      const off = WALL * 0.28;
      for (const sign of [-1, 1]) {
        const ax = door.a.x + nx * off * sign;
        const ay = door.a.y + ny * off * sign;
        const bx = door.b.x + nx * off * sign;
        const by = door.b.y + ny * off * sign;
        parts.push(
          `<line x1="${X(ax)}" y1="${Y(ay)}" x2="${X(bx)}" y2="${Y(by)}" ` +
            `stroke="${style.ink}" stroke-width="${L(0.022)}"/>`,
        );
      }
      continue;
    }

    if (door.kind === 'opening') {
      // Passage sans porte : rien à dessiner, le mur est déjà interrompu.
      continue;
    }

    // Porte : le battant, puis l'arc de son débattement. Le sens est arbitraire
    // — le relevé ne dit pas de quel côté la porte s'ouvre — mais il rend le
    // plan lisible, et c'est la convention du dessin d'architecture.
    const hinge = door.a;
    const leafEnd = { x: hinge.x + nx * length, y: hinge.y + ny * length };
    parts.push(
      `<line x1="${X(hinge.x)}" y1="${Y(hinge.y)}" x2="${X(leafEnd.x)}" y2="${Y(leafEnd.y)}" ` +
        `stroke="${style.ink}" stroke-width="${L(0.03)}"/>`,
    );
    const arcEnd = { x: hinge.x + ux * length, y: hinge.y + uy * length };
    parts.push(
      `<path d="M ${X(leafEnd.x)} ${Y(leafEnd.y)} A ${L(length)} ${L(length)} 0 0 1 ${X(arcEnd.x)} ${Y(arcEnd.y)}" ` +
        `fill="none" stroke="${style.hint}" stroke-width="${L(0.018)}" stroke-dasharray="${L(0.09)} ${L(0.07)}"/>`,
    );
  }

  // --- noms et surfaces ---
  if (showLabels) {
    for (const room of rooms) {
      const center = roomCenter(room);
      const area = roomArea(room);
      const box = roomBounds(room);
      // Un dégagement fait 1,4 m de large : un libellé à taille fixe en déborde.
      // On part de la largeur réellement disponible et on estime celle du texte
      // — 0,62 em par caractère pour une graisse demi-grasse, mesure suffisante
      // pour un ajustement, et qui évite d'embarquer les métriques de la fonte.
      const usable = Math.max(0.6, (box.maxX - box.minX) * 0.88);
      const fit = (text: string, wanted: number) =>
        Math.min(wanted, usable / Math.max(1, text.length * 0.62));

      const nameSize = L(fit(room.name, 0.24));
      const areaText = formatArea(area);
      const areaSize = L(fit(areaText, 0.19));

      // En dessous d'une taille lisible, le nom encombre plus qu'il n'informe :
      // la surface seule suffit, un plan se lit aussi par ses proportions.
      const nameShown = nameSize >= 9.5;
      const cx = X(center.x);
      const cy = Y(center.y);

      if (nameShown) {
        parts.push(
          `<text x="${cx}" y="${round(cy - nameSize * 0.15)}" text-anchor="middle" ` +
            `font-family="Inter, system-ui, sans-serif" font-size="${round(nameSize)}" font-weight="600" ` +
            `fill="${style.ink}">${escapeXml(room.name)}</text>`,
        );
      }
      parts.push(
        `<text x="${cx}" y="${round(cy + (nameShown ? nameSize * 0.95 : areaSize * 0.35))}" text-anchor="middle" ` +
          `font-family="Inter, system-ui, sans-serif" font-size="${round(Math.max(8, areaSize))}" ` +
          `fill="${style.hint}">${areaText}</text>`,
      );
    }
  }

  // --- titre ---
  const title = options.title ?? '';
  if (title) {
    parts.push(
      `<text x="${L(MARGIN)}" y="${L(MARGIN * 0.95)}" font-family="Inter, system-ui, sans-serif" ` +
        `font-size="${round(Math.max(15, L(0.3)))}" font-weight="600" fill="${style.ink}">${escapeXml(title)}</text>`,
    );
  }
  parts.push(
    `<text x="${pxWidth - L(MARGIN)}" y="${L(MARGIN * 0.95)}" text-anchor="end" ` +
      `font-family="Inter, system-ui, sans-serif" font-size="${round(Math.max(12, L(0.22)))}" ` +
      `fill="${style.hint}">${rooms.length} pièces · ${formatArea(totalArea(rooms))}</text>`,
  );

  // --- échelle ---
  const baseY = pxHeight - L(FOOTER * 0.55);
  const barEnd = L(MARGIN) + L(1);
  parts.push(
    `<line x1="${L(MARGIN)}" y1="${round(baseY)}" x2="${round(barEnd)}" y2="${round(baseY)}" ` +
      `stroke="${style.ink}" stroke-width="${round(Math.max(1.5, L(0.02)))}"/>`,
  );
  for (const x of [L(MARGIN), barEnd]) {
    parts.push(
      `<line x1="${round(x)}" y1="${round(baseY - L(0.08))}" x2="${round(x)}" y2="${round(baseY + L(0.08))}" ` +
        `stroke="${style.ink}" stroke-width="${round(Math.max(1.5, L(0.02)))}"/>`,
    );
  }
  parts.push(
    `<text x="${round(barEnd + L(0.16))}" y="${round(baseY + L(0.07))}" ` +
      `font-family="Inter, system-ui, sans-serif" font-size="${round(Math.max(11, L(0.2)))}" ` +
      `fill="${style.hint}">1 m</text>`,
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pxWidth} ${pxHeight}" ` +
    `width="${pxWidth}" height="${pxHeight}" role="img" ` +
    `aria-label="Plan du logement, ${rooms.length} pièces, ${formatArea(totalArea(rooms))}">` +
    parts.join('') +
    '</svg>'
  );
}

/** Le SVG en data URI, pour un `<img>` ou un lien de téléchargement. */
export function floorPlanDataUri(plan: FloorPlan, doors: PlanDoor[], options?: FloorPlanOptions): string {
  const svg = renderFloorPlan(plan, doors, options);
  if (!svg) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Nom de fichier proposé au téléchargement. */
export function floorPlanFileName(propertyName: string): string {
  const slug = propertyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `plan-${slug || 'logement'}.svg`;
}

/** Réexport pratique : le point milieu sert aux appelants qui annotent le plan. */
export { midpoint };
