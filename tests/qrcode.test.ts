import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { dataCapacity, encodeQr, QrError, qrDataUri, qrSvg, type QrMatrix } from '../lib/qrcode.ts';

/**
 * Un encodeur de QR se vérifie mal à l'œil : une table d'entrelacement fausse
 * produit un symbole d'allure parfaitement normale que rien ne lit. On relit
 * donc chaque code produit avec un **vrai décodeur**, celui d'une bibliothèque
 * tierce, et on compare au texte de départ.
 *
 * Le décodeur n'est qu'une dépendance de développement : si jamais il manque,
 * les vérifications de structure ci-dessous tournent quand même, et le
 * round-trip se signale comme sauté plutôt que de faire échouer la suite.
 */
type Decoder = (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

const require_ = createRequire(import.meta.url);
let decode: Decoder | null = null;
try {
  decode = require_('jsqr') as Decoder;
} catch {
  decode = null;
}

/** Rend la matrice en pixels noirs et blancs, marge comprise. */
function raster(matrix: QrMatrix, scale = 4, quiet = 4) {
  const side = (matrix.length + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (!matrix[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((r + quiet) * scale + dy) * side + ((c + quiet) * scale + dx)) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, side };
}

const roundTrip = (text: string, ec: 'L' | 'M' | 'Q' | 'H'): string | null => {
  if (!decode) return null;
  const { data, side } = raster(encodeQr(text, { ec }));
  return decode(data, side, side)?.data ?? '';
};

test('un décodeur relit ce que l’encodeur produit', { skip: decode ? false : 'jsqr absent' }, () => {
  const cases: Array<[string, 'L' | 'M' | 'Q' | 'H']> = [
    ['A', 'L'],
    ['https://volume3d.fr', 'H'],
    ['https://volume3d.fr/v/appartement-lumineux-le-marais', 'M'],
    ['WIFI:S:Volume3D-Invités;T:WPA;P:bonjour2026;;', 'Q'],
    // Accents et signes typographiques : le mode octet encode de l'UTF-8.
    ['Séjour & cuisine — 20,8 m² · relevé le 3 août', 'M'],
    ['x'.repeat(180), 'M'],
  ];
  for (const [text, ec] of cases) {
    assert.equal(roundTrip(text, ec), text, `${ec} — ${text.slice(0, 30)}`);
  }
});

test('les quatre niveaux de correction produisent un code lisible', { skip: decode ? false : 'jsqr absent' }, () => {
  const text = 'https://volume3d.fr/v/studio-republique';
  for (const ec of ['L', 'M', 'Q', 'H'] as const) {
    assert.equal(roundTrip(text, ec), text, `niveau ${ec}`);
  }
});

test('la version choisie est la plus petite qui suffit', () => {
  // 19 octets tiennent en version 1 au niveau L, 20 non.
  assert.equal(encodeQr('a'.repeat(17), { ec: 'L' }).length, 21, 'version 1 attendue');
  assert.equal(encodeQr('a'.repeat(30), { ec: 'L' }).length, 25, 'version 2 attendue');
  // Une version minimale imposée est respectée.
  assert.equal(encodeQr('a', { ec: 'L', minVersion: 5 }).length, 37);
});

test('la taille du symbole suit la formule de la norme', () => {
  for (const min of [1, 2, 5, 7, 10]) {
    const n = encodeQr('a', { minVersion: min }).length;
    assert.equal(n, min * 4 + 17, `version ${min}`);
  }
});

test('les motifs de repérage sont aux trois coins', () => {
  const m = encodeQr('https://volume3d.fr');
  const n = m.length;
  for (const [row, col] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ]) {
    // Anneau noir extérieur, anneau blanc, cœur noir 3×3.
    assert.equal(m[row][col], true, 'coin du repère');
    assert.equal(m[row + 1][col + 1], false, 'anneau blanc');
    assert.equal(m[row + 3][col + 3], true, 'cœur du repère');
  }
  // Le module toujours noir.
  assert.equal(m[n - 8][8], true);
});

test('la ligne de synchronisation alterne', () => {
  const m = encodeQr('https://volume3d.fr');
  for (let i = 8; i < m.length - 8; i++) {
    assert.equal(m[6][i], i % 2 === 0, `colonne ${i}`);
    assert.equal(m[i][6], i % 2 === 0, `ligne ${i}`);
  }
});

test('un texte vide ou trop long est refusé, avec un message clair', () => {
  assert.throws(() => encodeQr(''), QrError);
  assert.throws(() => encodeQr('x'.repeat(3000)), (error: unknown) => {
    assert.ok(error instanceof QrError);
    assert.match((error as QrError).message, /trop long/);
    return true;
  });
});

test('les capacités annoncées suivent la norme', () => {
  assert.equal(dataCapacity(1, 'L'), 19);
  assert.equal(dataCapacity(1, 'H'), 9);
  assert.equal(dataCapacity(10, 'M'), 216);
  assert.equal(dataCapacity(5, 'Q'), 62);
});

test('le SVG est bien formé, avec sa marge', () => {
  const svg = qrSvg('https://volume3d.fr', { size: 300, quiet: 4 });
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('width="300"'));
  const modules = encodeQr('https://volume3d.fr').length + 8;
  assert.ok(svg.includes(`viewBox="0 0 ${modules} ${modules}"`), svg.slice(0, 200));
  // `crispEdges` : sans lui les modules sont lissés et le code devient illisible
  // à petite taille.
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
});

test('le texte de remplacement ne peut pas injecter de balise', () => {
  const svg = qrSvg('https://volume3d.fr', { label: 'Plan <script>alert(1)</script>' });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('aria-label="Plan scriptalert(1)/script"'));
});

test('le data URI est décodable', () => {
  const uri = qrDataUri('https://volume3d.fr');
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.ok(decodeURIComponent(uri.split(',').slice(1).join(',')).startsWith('<svg '));
});
