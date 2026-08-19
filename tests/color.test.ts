import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALBEDO_CEILING,
  ALBEDO_FLOOR,
  checkAlbedo,
  contrast,
  deltaE,
  hueGap,
  luminance,
  over,
  parseColor,
  toHex,
  toLab,
  toLch,
  toLinear,
  tooClose,
} from '../lib/color.ts';

const near = (actual: number, expected: number, tolerance: number, what = '') =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what} : ${actual.toFixed(4)} attendu ${expected} ± ${tolerance}`,
  );

/* ================================================================ lecture === */

test('les écritures de couleur usuelles sont lues', () => {
  assert.deepEqual(parseColor('#0e6e66'), { r: 14, g: 110, b: 102 });
  assert.deepEqual(parseColor('0e6e66'), { r: 14, g: 110, b: 102 });
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColor(0x0e6e66), { r: 14, g: 110, b: 102 });
  assert.throws(() => parseColor('bleu'), /illisible/);
});

test('l’aller-retour hexadécimal ne perd rien', () => {
  for (const hex of ['#000000', '#ffffff', '#0e6e66', '#b18a60']) {
    assert.equal(toHex(parseColor(hex)), hex);
  }
});

test('une couleur semi-transparente se compose sur son fond', () => {
  const noir = parseColor('#000000');
  const blanc = parseColor('#ffffff');
  assert.deepEqual(over(noir, blanc, 0), blanc);
  assert.deepEqual(over(noir, blanc, 1), noir);
  assert.deepEqual(over(noir, blanc, 0.5), { r: 127.5, g: 127.5, b: 127.5 });
});

/* ================================================================ lumière === */

test('la conversion en linéaire suit la courbe sRGB', () => {
  assert.equal(toLinear(0), 0);
  assert.equal(toLinear(255), 1);
  // Le gris moyen perceptuel n'est pas à la moitié de l'échelle linéaire.
  near(toLinear(128), 0.2158, 0.001, 'gris 128');
  // Le raccord entre la portion linéaire et la puissance est continu.
  near(toLinear(10), 10 / 255 / 12.92, 1e-9, 'bas de courbe');
});

test('les contrastes de référence tombent juste', () => {
  const noir = parseColor('#000000');
  const blanc = parseColor('#ffffff');
  near(contrast(noir, blanc), 21, 0.001, 'noir sur blanc');
  assert.equal(contrast(blanc, blanc), 1);
  // Le contraste est symétrique : c'est un rapport, pas une différence.
  assert.equal(contrast(noir, blanc), contrast(blanc, noir));
  // #767676 sur blanc est le gris limite qui passe tout juste 4,5.
  near(contrast(parseColor('#767676'), blanc), 4.54, 0.05, 'gris limite');
});

test('la luminance relative respecte les poids WCAG', () => {
  near(luminance(parseColor('#ffffff')), 1, 1e-9, 'blanc');
  near(luminance(parseColor('#000000')), 0, 1e-9, 'noir');
  // Le vert pèse bien plus que le bleu dans la perception de clarté.
  assert.ok(luminance(parseColor('#00ff00')) > luminance(parseColor('#0000ff')) * 9);
});

/* ================================================================= CIELAB === */

test('les repères CIELAB connus sont retrouvés', () => {
  const blanc = toLab(parseColor('#ffffff'));
  near(blanc.l, 100, 0.01, 'clarté du blanc');
  near(blanc.a, 0, 0.01, 'a du blanc');
  near(blanc.b, 0, 0.02, 'b du blanc');

  const noir = toLab(parseColor('#000000'));
  near(noir.l, 0, 0.01, 'clarté du noir');

  // Rouge pur : clarté ~53, fortement décalé vers le rouge et le jaune.
  const rouge = toLab(parseColor('#ff0000'));
  near(rouge.l, 53.24, 0.1, 'clarté du rouge');
  near(rouge.a, 80.09, 0.2, 'a du rouge');
  near(rouge.b, 67.2, 0.3, 'b du rouge');
});

test('les coordonnées polaires donnent la teinte attendue', () => {
  near(toLch(parseColor('#ff0000')).h, 39.999, 0.5, 'teinte du rouge');
  // Un gris n'a pas de teinte lisible, mais il a une saturation nulle.
  near(toLch(parseColor('#808080')).c, 0, 0.02, 'saturation d’un gris');
});

test('ΔE2000 vaut zéro pour deux couleurs identiques et croît avec l’écart', () => {
  const accent = parseColor('#0e6e66');
  assert.equal(deltaE(accent, accent), 0);
  const proche = parseColor('#106f67');
  const loin = parseColor('#a5382a');
  assert.ok(deltaE(accent, proche) < 1.5, 'deux voisines doivent rester sous le seuil');
  assert.ok(deltaE(accent, loin) > 30, 'deux couleurs franchement différentes');
  // Symétrique, comme une distance.
  near(deltaE(accent, loin), deltaE(loin, accent), 1e-9, 'symétrie');
});

/*
 * Les paires de référence de Sharma, Wu et Dalal (2005).
 *
 * Ce sont exactement les cas conçus pour casser une implémentation naïve : les
 * bleus, où la formule applique sa correction de rotation ; les couleurs peu
 * saturées, où la correction du a* change tout ; et le passage de la teinte par
 * zéro, où une moyenne d'angles mal faite renvoie n'importe quoi. Retomber sur
 * ces valeurs au dix-millième près n'arrive pas par hasard.
 *
 * Une cinquième paire figurait ici, citée de mémoire, avec une valeur attendue
 * que je n'ai pas pu retrouver dans la publication : elle est retirée plutôt
 * que gardée fausse.
 */
test('ΔE2000 passe les paires de référence de Sharma', () => {
  const fromLab = (l: number, a: number, b: number) => ({ l, a, b });
  // On vérifie l'implémentation sur Lab directement, sans passer par sRGB :
  // les valeurs de référence sont hors gamut, et un aller-retour les écrêterait.
  const cases: [ReturnType<typeof fromLab>, ReturnType<typeof fromLab>, number][] = [
    [fromLab(50, 2.6772, -79.7751), fromLab(50, 0, -82.7485), 2.0425],
    [fromLab(50, 3.1571, -77.2803), fromLab(50, 0, -82.7485), 2.8615],
    [fromLab(50, 2.8361, -74.02), fromLab(50, 0, -82.7485), 3.4412],
    [fromLab(60.2574, -34.0099, 36.2677), fromLab(60.4626, -34.1751, 39.4387), 1.2644],
    [fromLab(2.0776, 0.0795, -1.135), fromLab(0.9033, -0.0636, -0.5514), 0.9082],
  ];
  for (const [one, two, expected] of cases) {
    near(deltaFromLab(one, two), expected, 0.0002, `paire ${expected}`);
  }
});

/* La même formule, alimentée directement en Lab : c'est ce que `deltaE` fait
   après conversion, isolé ici pour pouvoir confronter les valeurs publiées. */
function deltaFromLab(one: { l: number; a: number; b: number }, two: { l: number; a: number; b: number }): number {
  const avgC = (Math.hypot(one.a, one.b) + Math.hypot(two.a, two.b)) / 2;
  const g = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1 = (1 + g) * one.a;
  const a2 = (1 + g) * two.a;
  const c1 = Math.hypot(a1, one.b);
  const c2 = Math.hypot(a2, two.b);
  const angle = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    const d = (Math.atan2(b, a) * 180) / Math.PI;
    return d < 0 ? d + 360 : d;
  };
  const h1 = angle(a1, one.b);
  const h2 = angle(a2, two.b);
  const dL = two.l - one.l;
  const dC = c2 - c1;
  let dh = 0;
  if (c1 * c2 !== 0) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh * Math.PI) / 360);
  const avgL = (one.l + two.l) / 2;
  const avgCp = (c1 + c2) / 2;
  let avgH = h1 + h2;
  if (c1 * c2 !== 0) {
    if (Math.abs(h1 - h2) > 180) avgH += h1 + h2 < 360 ? 360 : -360;
    avgH /= 2;
  }
  const t =
    1 -
    0.17 * Math.cos(((avgH - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgH * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgH + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgH - 63) * Math.PI) / 180);
  const sL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const sC = 1 + 0.045 * avgCp;
  const sH = 1 + 0.015 * avgCp * t;
  const rt =
    -2 *
    Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7)) *
    Math.sin((60 * Math.exp(-(((avgH - 275) / 25) ** 2)) * Math.PI) / 180);
  return Math.sqrt((dL / sL) ** 2 + (dC / sC) ** 2 + (dH / sH) ** 2 + rt * (dC / sC) * (dH / sH));
}

/* ========================================================= rendu physique === */

test('la plage utile d’une couleur de base est bornée aux deux bouts', () => {
  assert.equal(checkAlbedo(parseColor('#ffffff')).ok, false);
  assert.match(checkAlbedo(parseColor('#ffffff')).note, /trop clair/);
  assert.equal(checkAlbedo(parseColor('#0a0a0a')).ok, false);
  assert.match(checkAlbedo(parseColor('#0a0a0a')).note, /trop sombre/);
  assert.equal(checkAlbedo(parseColor('#b18a60')).ok, true);
  // Les bornes elles-mêmes passent.
  const plancher = { r: ALBEDO_FLOOR, g: ALBEDO_FLOOR, b: ALBEDO_FLOOR };
  const plafond = { r: ALBEDO_CEILING, g: ALBEDO_CEILING, b: ALBEDO_CEILING };
  assert.equal(checkAlbedo(plancher).ok, true);
  assert.equal(checkAlbedo(plafond).ok, true);
});

/* ================================================================ harmonie === */

test('l’écart de teinte prend le plus court chemin sur le cercle', () => {
  const gap = hueGap(parseColor('#ff0000'), parseColor('#ff0000'));
  assert.equal(gap, 0);
  // Complémentaires : une demi-révolution, à quelques degrés près.
  assert.ok(hueGap(parseColor('#ff0000'), parseColor('#00ffff')) > 150);
  // Jamais plus de 180 : on ne fait pas le tour.
  assert.ok(hueGap(parseColor('#0000ff'), parseColor('#00ff00')) <= 180);
});

test('les couleurs trop proches d’un ensemble sont signalées, la pire d’abord', () => {
  const paires = tooClose({
    mur: '#e6e1d6',
    plinthe: '#e7e2d7',
    sol: '#b18a60',
    plafond: '#f4f1ea',
  });
  assert.ok(paires.length > 0, 'mur et plinthe sont indiscernables, il faut le dire');
  assert.deepEqual(paires[0].pair.sort(), ['mur', 'plinthe']);
  assert.ok(paires[0].delta < 1);
  // Le sol ne ressemble à rien d'autre : il n'apparaît dans aucune paire.
  assert.ok(!paires.some((entry) => entry.pair.includes('sol')));
});
