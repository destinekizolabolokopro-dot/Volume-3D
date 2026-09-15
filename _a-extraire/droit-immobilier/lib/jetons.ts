import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Les jetons envoyés par courriel : leur fabrication et leur empreinte.
 *
 * Ce fichier ne touche ni la base ni le réseau, et ne porte pas `server-only` :
 * c'est de la cryptographie, elle doit pouvoir être éprouvée par un test —
 * voir tests/jetons.test.ts. Ce qui écrit et relit les lignes vit dans
 * lib/acces.ts.
 *
 * ── Ce que c'est, exactement ───────────────────────────────────────────────
 * Trente-deux octets tirés au sort, écrits en base 64 pour l'URL. C'est tout
 * ce qu'il faut : un lien de réinitialisation n'a pas à être lisible, il a à
 * être imprévisible. 256 bits le sont, et ils passent dans une adresse sans
 * être encodés une seconde fois.
 *
 * ── Ce qui est gardé en base ───────────────────────────────────────────────
 * Le SHA-256, jamais le jeton. Pas de scrypt ici, et ce n'est pas un oubli :
 * scrypt protège un secret que l'humain a choisi et qu'on peut deviner par
 * force brute. Un tirage de 256 bits ne se devine pas — le hachage lent ne
 * protégerait de rien et ferait attendre chaque clic sur un lien.
 */

/** Une heure pour confirmer une adresse ou reprendre un mot de passe. */
export const DUREE_MINUTES = 60;

export type UsageJeton = 'verification' | 'mot-de-passe';

export function fabriquerJeton(): string {
  return randomBytes(32).toString('base64url');
}

export function empreinteDuJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

/**
 * Compare deux empreintes sans laisser fuir où elles diffèrent.
 *
 * La comparaison ordinaire s'arrête au premier octet qui change, et le temps
 * qu'elle met le raconte. Sur une valeur qu'on peut réessayer autant qu'on
 * veut, cela se mesure.
 */
export function memeEmpreinte(a: string, b: string): boolean {
  const gauche = Buffer.from(a, 'utf8');
  const droite = Buffer.from(b, 'utf8');
  if (gauche.length !== droite.length) return false;
  return timingSafeEqual(gauche, droite);
}

export function expirationDepuis(maintenant = new Date()): string {
  return new Date(maintenant.getTime() + DUREE_MINUTES * 60 * 1000).toISOString();
}

export type EtatJeton = 'valide' | 'expire' | 'deja-utilise' | 'inconnu';

/** L'état d'une ligne de jeton, sans rien savoir de la base qui l'a rendue. */
export function etatDuJeton(
  ligne: { expireA: string; utiliseA: string } | null,
  maintenant = new Date(),
): EtatJeton {
  if (!ligne) return 'inconnu';
  if (ligne.utiliseA) return 'deja-utilise';
  if (new Date(ligne.expireA).getTime() <= maintenant.getTime()) return 'expire';
  return 'valide';
}
