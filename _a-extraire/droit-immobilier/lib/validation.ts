/** Helpers de validation partagés entre les routes API. */

export class ValidationError extends Error {}

export function text(value: unknown, field: string, { max = 500, required = true } = {}): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    if (required) throw new ValidationError(`Le champ « ${field} » est obligatoire.`);
    return '';
  }
  if (raw.length > max) throw new ValidationError(`Le champ « ${field} » est trop long (${max} caractères maximum).`);
  return raw;
}

/**
 * Validation d'email volontairement permissive : on vérifie la forme générale
 * plutôt que d'exclure des adresses valides mais exotiques.
 */
export function email(value: unknown, field = 'email'): string {
  const raw = text(value, field, { max: 200 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) {
    throw new ValidationError('Cette adresse email ne semble pas valide.');
  }
  return raw;
}

export function number(value: unknown, field: string, { min = -Infinity, max = Infinity } = {}): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new ValidationError(`Le champ « ${field} » doit être un nombre.`);
  return Math.min(max, Math.max(min, parsed));
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ValidationError(`Valeur inattendue pour « ${field} ».`);
}
