/**
 * Mesure des couleurs.
 *
 * On ne juge pas une palette à l'œil sur un écran calibré au hasard : on la
 * mesure. Ce module donne de quoi répondre à trois questions, et ce sont les
 * trois seules qui décident vraiment.
 *
 *  1. **Ce texte est-il lisible sur ce fond ?** Contraste WCAG 2.1, seuils
 *     4,5 pour le corps de texte, 3,0 pour les grands caractères et les
 *     bordures d'éléments d'interface.
 *  2. **Ces deux surfaces voisines se distinguent-elles ?** Écart ΔE2000 en
 *     CIELAB. Deux murs à ΔE < 2 forment un aplat quelle que soit la lumière ;
 *     c'est le défaut qui fait qu'une pièce en trois dimensions ne se lit pas
 *     comme une pièce.
 *  3. **Cette couleur tient-elle dans la plage utile d'un moteur de rendu ?**
 *     La règle admise en rendu physique borne les non-métaux entre 60 et 240
 *     en sRGB : au-delà on ne renvoie plus de couleur, en deçà on éteint la
 *     lumière rebondie et tout devient noir.
 *
 * Rien ici ne dépend du DOM ni de three.js : ce sont des mathématiques, elles
 * se testent.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface Lch {
  l: number;
  c: number;
  h: number;
}

/* =============================================================== lecture === */

const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

/** « #0e6e66 », « #fff », « 0x0e6e66 » ou un entier. */
export function parseColor(value: string | number): Rgb {
  if (typeof value === 'number') {
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }
  let text = value.trim().replace(/^#/, '').replace(/^0x/i, '');
  if (text.length === 3) text = text.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(text)) throw new Error(`Couleur illisible : ${value}`);
  const number = Number.parseInt(text, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

export const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

/**
 * Compose une couleur semi-transparente sur son fond.
 *
 * Indispensable : la moitié des couleurs d'une interface sont posées avec une
 * opacité, et mesurer la couleur nominale plutôt que celle qu'on voit revient à
 * mesurer autre chose que ce que lit l'utilisateur.
 */
export const over = (top: Rgb, bottom: Rgb, alpha: number): Rgb => ({
  r: top.r * alpha + bottom.r * (1 - alpha),
  g: top.g * alpha + bottom.g * (1 - alpha),
  b: top.b * alpha + bottom.b * (1 - alpha),
});

/* ============================================================== lumière === */

/** Canal sRGB (0–255) vers sa valeur linéaire (0–1). */
export function toLinear(channel: number): number {
  const v = clamp(channel, 0, 255) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative au sens WCAG. */
export const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/**
 * Rapport de contraste WCAG 2.1, entre 1 (identiques) et 21 (noir sur blanc).
 *
 * Seuils : 4,5 pour du texte courant, 3,0 pour du texte à partir de 18,66 px
 * gras ou 24 px normal, et 3,0 aussi pour la limite visible d'un élément avec
 * lequel on interagit — une bordure de champ, par exemple.
 */
export function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/* =============================================================== CIELAB === */

/** Blanc de référence D65, l'illuminant du sRGB. */
const WHITE = { x: 0.95047, y: 1.0, z: 1.08883 };

export function toXyz(rgb: Rgb): { x: number; y: number; z: number } {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return {
    x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    y: r * 0.2126729 + g * 0.7151522 + b * 0.072175,
    z: r * 0.0193339 + g * 0.119192 + b * 0.9503041,
  };
}

export function toLab(rgb: Rgb): Lab {
  const { x, y, z } = toXyz(rgb);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389 / 27 + 16) / 116);
  const fx = f(x / WHITE.x);
  const fy = f(y / WHITE.y);
  const fz = f(z / WHITE.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Lab en coordonnées polaires : clarté, saturation, teinte en degrés. */
export function toLch(rgb: Rgb): Lch {
  const { l, a, b } = toLab(rgb);
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: hue < 0 ? hue + 360 : hue };
}

/**
 * Écart perceptuel ΔE2000.
 *
 * L'implémentation est verbeuse parce que la formule l'est : c'est une suite de
 * corrections empiriques qui rattrapent les défauts de CIELAB, notamment dans
 * les bleus et pour les couleurs peu saturées. Elle vaut la peine — un simple
 * écart euclidien en Lab classerait comme « bien séparés » des gris que l'œil
 * confond.
 *
 * Repères d'usage : 1 est le seuil de perception dans des conditions idéales,
 * 2 à 3 est un écart qu'on voit côte à côte, au-delà de 10 ce sont deux
 * couleurs différentes.
 */
export function deltaE(first: Rgb, second: Rgb): number {
  const one = toLab(first);
  const two = toLab(second);

  const avgC = (Math.hypot(one.a, one.b) + Math.hypot(two.a, two.b)) / 2;
  const g = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));

  const a1 = (1 + g) * one.a;
  const a2 = (1 + g) * two.a;
  const c1 = Math.hypot(a1, one.b);
  const c2 = Math.hypot(a2, two.b);

  const angle = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    const degrees = (Math.atan2(b, a) * 180) / Math.PI;
    return degrees < 0 ? degrees + 360 : degrees;
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

  return Math.sqrt(
    (dL / sL) ** 2 + (dC / sC) ** 2 + (dH / sH) ** 2 + rt * (dC / sC) * (dH / sH),
  );
}

/* ======================================================== rendu physique === */

/**
 * La plage utile d'une couleur de base, en rendu.
 *
 * Convention admise en rendu physique : au-dessus de 240 en sRGB, une surface
 * renvoie presque toute la lumière et sa teinte disparaît dans le blanc ; en
 * dessous de 50, elle n'en renvoie plus assez pour éclairer ses voisines et
 * l'image s'éteint. C'est ce qui explique qu'un intérieur peint en « blanc
 * pur » rende systématiquement plat.
 */
export const ALBEDO_FLOOR = 50;
export const ALBEDO_CEILING = 240;

export interface AlbedoCheck {
  ok: boolean;
  min: number;
  max: number;
  note: string;
}

export function checkAlbedo(color: Rgb): AlbedoCheck {
  const min = Math.min(color.r, color.g, color.b);
  const max = Math.max(color.r, color.g, color.b);
  if (max > ALBEDO_CEILING) {
    return { ok: false, min, max, note: `trop clair (${Math.round(max)} > ${ALBEDO_CEILING})` };
  }
  if (min < ALBEDO_FLOOR) {
    return { ok: false, min, max, note: `trop sombre (${Math.round(min)} < ${ALBEDO_FLOOR})` };
  }
  return { ok: true, min, max, note: 'dans la plage' };
}

/* ============================================================== harmonie === */

/** Écart de teinte le plus court entre deux couleurs, en degrés. */
export function hueGap(first: Rgb, second: Rgb): number {
  const a = toLch(first).h;
  const b = toLch(second).h;
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/**
 * Les couleurs d'un ensemble trop proches pour se distinguer.
 *
 * Renvoie les paires sous le seuil, la plus confondue en premier. Sert à
 * vérifier qu'un jeu de matériaux voisins — un sol, un mur, une plinthe — ne
 * s'effondre pas en un seul aplat.
 */
export function tooClose(
  palette: Record<string, string | number>,
  threshold = 3,
): { pair: [string, string]; delta: number }[] {
  const names = Object.keys(palette);
  const found: { pair: [string, string]; delta: number }[] = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const delta = deltaE(parseColor(palette[names[i]]), parseColor(palette[names[j]]));
      if (delta < threshold) found.push({ pair: [names[i], names[j]], delta });
    }
  }
  return found.sort((a, b) => a.delta - b.delta);
}
