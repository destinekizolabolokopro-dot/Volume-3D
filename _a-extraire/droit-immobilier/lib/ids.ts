import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Identifiant aléatoire en base 32 lisible (sans l, o, 0, 1 pour éviter les
 * confusions à la lecture). Utilisé pour les ids internes, les noms de fichiers
 * et les jetons d'aperçu.
 */
export function randomId(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Transforme un nom de logement en fragment d'URL.
 * "Appartement lumineux — Le Marais" → "appartement-lumineux-le-marais"
 */
export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return base || 'logement';
}

/** Ajoute un suffixe court tant que le slug est déjà pris. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const slug = slugify(base);
  if (!used.has(slug)) return slug;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${slug}-${randomId(4)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${slug}-${randomId(10)}`;
}
