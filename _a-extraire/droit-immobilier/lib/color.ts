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
 *  3. **Ces deux teintes appartiennent-elles à la même famille ?** Écart de
 *     teinte en degrés. Des neutres et un accent qui partagent la même teinte
 *     donnent une page où rien ne se détache de rien.
 *
 * Rien ici ne dépend du DOM ni du navigateur : ce sont des mathématiques, elles
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
 * La plage utile d'une couleur de base, en rendu.
 *
 * Convention admise en rendu physique : au-dessus de 240 en sRGB, une surface
 * renvoie presque toute la lumière et sa teinte disparaît dans le blanc ; en
 * dessous de 50, elle n'en renvoie plus assez pour éclairer ses voisines et
 * l'image s'éteint. C'est ce qui explique qu'un intérieur peint en « blanc
 * pur » rende systématiquement plat.
 */
export function hueGap(first: Rgb, second: Rgb): number {
  const a = toLch(first).h;
  const b = toLch(second).h;
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

