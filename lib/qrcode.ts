/**
 * Encodeur de QR code.
 *
 * Un propriétaire qui a une visite virtuelle veut la mettre **dans** son
 * logement : sur le livret d'accueil, à côté de la porte, sur le frigo. Un lien
 * ne se tape pas, un QR se scanne. Il en va de même pour le démarchage : une
 * feuille laissée à un propriétaire ne vaut que si la visite est à un scan.
 *
 * Pourquoi l'écrire plutôt que de prendre une bibliothèque : le produit doit
 * fonctionner **hors ligne, dans un seul fichier**, et une dépendance de plus
 * dans le paquet est une dépendance de plus à suivre. Le format est stable
 * depuis 1994 et tient en quatre cents lignes.
 *
 * Portée : mode octet — le seul qui accepte une URL quelconque —, versions 1 à
 * 10, les quatre niveaux de correction. La version 10 en correction moyenne
 * porte 213 octets : plus qu'aucune adresse raisonnable.
 *
 * Références : ISO/IEC 18004. Les tables ci-dessous en sont tirées telles
 * quelles ; une erreur dedans ne se voit pas à l'œil, d'où les tests qui
 * relisent le code produit avec un vrai décodeur.
 */

export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/** Matrice du symbole : `true` = module noir. */
export type QrMatrix = boolean[][];

export class QrError extends Error {}

/* ------------------------------------------------------------------ tables */

/**
 * Structure des blocs, par version puis par niveau.
 *
 * `[octets de correction par bloc, blocs du groupe 1, octets de données du
 * groupe 1, blocs du groupe 2, octets de données du groupe 2]`.
 */
const BLOCKS: Record<ErrorCorrection, number[][]> = {
  L: [
    [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69],
  ],
  M: [
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
  ],
  Q: [
    [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0], [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19], [20, 4, 16, 4, 17], [24, 6, 19, 2, 20],
  ],
  H: [
    [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0], [22, 2, 11, 2, 12],
    [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16],
  ],
};

/** Centres des motifs d'alignement, par version. */
const ALIGNMENT: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

/** Codage du niveau de correction dans l'information de format. */
const EC_BITS: Record<ErrorCorrection, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

const MAX_VERSION = BLOCKS.L.length;

/** Nombre d'octets de données que porte une version à un niveau donné. */
export function dataCapacity(version: number, ec: ErrorCorrection): number {
  const [, blocks1, data1, blocks2, data2] = BLOCKS[ec][version - 1];
  return blocks1 * data1 + blocks2 * data2;
}

/* --------------------------------------------------- corps fini GF(256) --- */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    // Polynôme primitif du format : x⁸ + x⁴ + x³ + x² + 1.
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Polynôme générateur de Reed-Solomon pour `degree` octets de correction. */
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Octets de correction d'un bloc de données. */
function remainder(data: number[], degree: number): number[] {
  const gen = generator(degree);
  const buffer = [...data, ...new Array(degree).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = buffer[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) buffer[i + j] ^= mul(gen[j], factor);
  }
  return buffer.slice(data.length);
}

/* ------------------------------------------------------------- flux de bits */

class BitBuffer {
  readonly bits: number[] = [];

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  get length(): number {
    return this.bits.length;
  }
}

/**
 * Codewords de données, terminateur et remplissage compris.
 *
 * Le compteur de caractères tient sur 8 bits jusqu'à la version 9, sur 16
 * ensuite : une confusion sur ce point produit un code qui se scanne mais rend
 * n'importe quoi.
 */
function encodeData(bytes: Uint8Array, version: number, ec: ErrorCorrection): number[] {
  const capacity = dataCapacity(version, ec);
  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // mode octet
  buffer.put(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) buffer.put(byte, 8);

  const total = capacity * 8;
  if (buffer.length > total) throw new QrError('données trop longues pour cette version');

  // Terminateur : jusqu'à quatre zéros, puis alignement sur l'octet.
  buffer.put(0, Math.min(4, total - buffer.length));
  while (buffer.length % 8 !== 0) buffer.put(0, 1);

  const codewords: number[] = [];
  for (let i = 0; i < buffer.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j];
    codewords.push(byte);
  }
  // Remplissage imposé par la norme, alterné.
  const PAD = [0xec, 0x11];
  for (let i = 0; codewords.length < capacity; i++) codewords.push(PAD[i % 2]);
  return codewords;
}

/** Entrelace blocs de données et blocs de correction, comme l'exige la norme. */
function interleave(codewords: number[], version: number, ec: ErrorCorrection): number[] {
  const [ecPerBlock, blocks1, data1, blocks2, data2] = BLOCKS[ec][version - 1];
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];

  let offset = 0;
  for (let i = 0; i < blocks1 + blocks2; i++) {
    const size = i < blocks1 ? data1 : data2;
    const block = codewords.slice(offset, offset + size);
    offset += size;
    dataBlocks.push(block);
    ecBlocks.push(remainder(block, ecPerBlock));
  }

  const out: number[] = [];
  const longest = Math.max(data1, data2);
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

/* ------------------------------------------------------------- la matrice */

const size = (version: number): number => version * 4 + 17;

/** Motif de repérage 7×7 et sa marge, posé à un coin. */
function placeFinder(matrix: QrMatrix, reserved: boolean[][], row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || x < 0 || y >= matrix.length || x >= matrix.length) continue;
      const onRing = (r === 0 || r === 6) && c >= 0 && c <= 6;
      const onSide = (c === 0 || c === 6) && r >= 0 && r <= 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[y][x] = onRing || onSide || inCore;
      reserved[y][x] = true;
    }
  }
}

function buildFunctionPatterns(version: number): { matrix: QrMatrix; reserved: boolean[][] } {
  const n = size(version);
  const matrix: QrMatrix = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const reserved: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

  placeFinder(matrix, reserved, 0, 0);
  placeFinder(matrix, reserved, 0, n - 7);
  placeFinder(matrix, reserved, n - 7, 0);

  // Lignes de synchronisation, un module sur deux.
  for (let i = 8; i < n - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Motifs d'alignement 5×5, sauf là où ils chevaucheraient un repère.
  const centers = ALIGNMENT[version - 1];
  for (const row of centers) {
    for (const col of centers) {
      const nearFinder =
        (row <= 8 && col <= 8) || (row <= 8 && col >= n - 9) || (row >= n - 9 && col <= 8);
      if (nearFinder) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          matrix[row + r][col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          reserved[row + r][col + c] = true;
        }
      }
    }
  }

  // Module toujours noir, et réservation des zones d'information de format.
  matrix[n - 8][8] = true;
  reserved[n - 8][8] = true;
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][n - 1 - i] = true;
    reserved[n - 1 - i][8] = true;
  }

  // Information de version, à partir de la version 7.
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3);
      const c = n - 11 + (i % 3);
      reserved[r][c] = true;
      reserved[c][r] = true;
    }
  }

  return { matrix, reserved };
}

/** Parcours en zigzag, deux colonnes à la fois, en sautant la colonne 6. */
function placeData(matrix: QrMatrix, reserved: boolean[][], codewords: number[]): void {
  const n = matrix.length;
  let bit = 0;
  const total = codewords.length * 8;
  const read = (): boolean => {
    if (bit >= total) return false;
    const value = (codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1;
    bit += 1;
    return value === 1;
  };

  let upward = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // la colonne de synchronisation ne porte rien
    for (let step = 0; step < n; step++) {
      const y = upward ? n - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y][x]) continue;
        matrix[y][x] = read();
      }
    }
    upward = !upward;
  }
}

/** Les huit masques de la norme. */
const MASKS: Array<(row: number, col: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Information de format : niveau + masque, protégés par un BCH(15,5). */
function formatBits(ec: ErrorCorrection, mask: number): number {
  const data = (EC_BITS[ec] << 3) | mask;
  let value = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((value >>> (10 + i)) & 1) value ^= 0b10100110111 << i;
  }
  return ((data << 10) | value) ^ 0b101010000010010;
}

/** Information de version : six bits protégés par un BCH(18,6). */
function versionBits(version: number): number {
  let value = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((value >>> (12 + i)) & 1) value ^= 0b1111100100101 << i;
  }
  return (version << 12) | value;
}

function applyFormat(matrix: QrMatrix, ec: ErrorCorrection, mask: number): void {
  const n = matrix.length;
  const bits = formatBits(ec, mask);
  for (let i = 0; i < 15; i++) {
    const on = ((bits >>> i) & 1) === 1;
    // Copie autour du repère haut-gauche…
    if (i < 6) matrix[i][8] = on;
    else if (i === 6) matrix[7][8] = on;
    else if (i === 7) matrix[8][8] = on;
    else if (i === 8) matrix[8][7] = on;
    else matrix[8][14 - i] = on;
    // …et sa copie répartie sur les deux autres repères.
    if (i < 8) matrix[8][n - 1 - i] = on;
    else matrix[n - 15 + i][8] = on;
  }
}

function applyVersion(matrix: QrMatrix, version: number): void {
  if (version < 7) return;
  const n = matrix.length;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const on = ((bits >>> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = n - 11 + (i % 3);
    matrix[r][c] = on;
    matrix[c][r] = on;
  }
}

/**
 * Pénalité d'un masque.
 *
 * Les quatre règles de la norme : suites de même couleur, blocs 2×2, motifs
 * ressemblant à un repère, et déséquilibre global. Le masque le moins pénalisé
 * est celui qui se scanne le plus sûrement.
 */
function penalty(matrix: QrMatrix): number {
  const n = matrix.length;
  let score = 0;

  const runScore = (line: boolean[]): number => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) run += 1;
      else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    return total;
  };

  for (let i = 0; i < n; i++) {
    score += runScore(matrix[i]);
    score += runScore(matrix.map((row) => row[i]));
  }

  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) score += 3;
    }
  }

  const PATTERN = [true, false, true, true, true, false, true, false, false, false, false];
  const matches = (line: boolean[], at: number): boolean =>
    PATTERN.every((want, k) => line[at + k] === want);
  const reversed = [...PATTERN].reverse();
  const matchesReversed = (line: boolean[], at: number): boolean =>
    reversed.every((want, k) => line[at + k] === want);

  for (let i = 0; i < n; i++) {
    const row = matrix[i];
    const col = matrix.map((r) => r[i]);
    for (let j = 0; j + 11 <= n; j++) {
      if (matches(row, j) || matchesReversed(row, j)) score += 40;
      if (matches(col, j) || matchesReversed(col, j)) score += 40;
    }
  }

  let dark = 0;
  for (const row of matrix) for (const cell of row) if (cell) dark += 1;
  const ratio = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

/* ------------------------------------------------------------------ public */

export interface QrOptions {
  /** Niveau de correction d'erreur. « M » convient à un QR imprimé. */
  ec?: ErrorCorrection;
  /** Version minimale, quand on veut un symbole d'une taille donnée. */
  minVersion?: number;
}

/** Encode un texte et rend la matrice du symbole. */
export function encodeQr(text: string, options: QrOptions = {}): QrMatrix {
  const ec = options.ec ?? 'M';
  const bytes = new TextEncoder().encode(text);
  if (bytes.length === 0) throw new QrError('rien à encoder');

  let version = Math.max(1, options.minVersion ?? 1);
  // Le compteur de caractères passe de 8 à 16 bits à la version 10 : la
  // capacité utile en dépend, on la recalcule à chaque essai.
  while (version <= MAX_VERSION) {
    const header = 4 + (version <= 9 ? 8 : 16);
    if (dataCapacity(version, ec) * 8 >= header + bytes.length * 8) break;
    version += 1;
  }
  if (version > MAX_VERSION) {
    throw new QrError(`texte trop long : ${bytes.length} octets, maximum ${dataCapacity(MAX_VERSION, ec)}`);
  }

  const codewords = interleave(encodeData(bytes, version, ec), version, ec);
  const { matrix: base, reserved } = buildFunctionPatterns(version);
  placeData(base, reserved, codewords);
  applyVersion(base, version);

  // On essaie les huit masques et on garde le moins pénalisé.
  let best: QrMatrix | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row) => [...row]);
    for (let r = 0; r < candidate.length; r++) {
      for (let c = 0; c < candidate.length; c++) {
        if (!reserved[r][c] && MASKS[mask](r, c)) candidate[r][c] = !candidate[r][c];
      }
    }
    applyFormat(candidate, ec, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best!;
}

export interface QrSvgOptions extends QrOptions {
  /** Côté du symbole en pixels. */
  size?: number;
  /** Marge blanche, en modules. La norme en demande quatre. */
  quiet?: number;
  dark?: string;
  light?: string;
  /** Texte de remplacement. */
  label?: string;
}

/** Le symbole en SVG, prêt à être imprimé ou embarqué. */
export function qrSvg(text: string, options: QrSvgOptions = {}): string {
  const matrix = encodeQr(text, options);
  const quiet = options.quiet ?? 4;
  const modules = matrix.length + quiet * 2;
  const px = options.size ?? 240;
  const dark = options.dark ?? '#0f1418';
  const light = options.light ?? '#ffffff';
  const label = (options.label ?? 'QR code').replace(/[<>&"]/g, '');

  // Un rectangle par ligne de modules noirs contigus : le fichier reste petit
  // et le rendu net à toute taille.
  const rects: string[] = [];
  for (let r = 0; r < matrix.length; r++) {
    let start = -1;
    for (let c = 0; c <= matrix.length; c++) {
      const on = c < matrix.length && matrix[r][c];
      if (on && start === -1) start = c;
      if (!on && start !== -1) {
        rects.push(`<rect x="${start + quiet}" y="${r + quiet}" width="${c - start}" height="1"/>`);
        start = -1;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} ${modules}" ` +
    `width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="${label}">` +
    `<rect width="${modules}" height="${modules}" fill="${light}"/>` +
    `<g fill="${dark}">${rects.join('')}</g>` +
    '</svg>'
  );
}

/** Le symbole en data URI, pour un `<img>`. */
export function qrDataUri(text: string, options: QrSvgOptions = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(text, options))}`;
}
