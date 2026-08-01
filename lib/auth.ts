import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'v3d_session';
const SESSION_DAYS = 30;

/**
 * Authentification à un seul compte : l'administrateur du service.
 * Il n'y a volontairement pas de comptes clients — les propriétaires reçoivent
 * un simple lien public, sans inscription.
 */

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "AUTH_SECRET manquant ou trop court. Ajoutez une chaîne aléatoire d'au moins 16 caractères dans .env.local",
    );
  }
  return value;
}

function adminPassword(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) {
    throw new Error('ADMIN_PASSWORD manquant. Ajoutez votre mot de passe administrateur dans .env.local');
  }
  return value;
}

/** Comparaison à durée constante, pour ne pas laisser fuiter le mot de passe caractère par caractère. */
export function checkPassword(candidate: string): boolean {
  const expected = Buffer.from(adminPassword(), 'utf8');
  const given = Buffer.from(candidate, 'utf8');
  // timingSafeEqual exige deux longueurs identiques : on hache d'abord pour
  // ramener les deux valeurs à une taille fixe.
  const hash = (buffer: Buffer) => createHmac('sha256', secret()).update(buffer).digest();
  return timingSafeEqual(hash(expected), hash(given));
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Jeton de session : "expiration.signature". Aucune donnée sensible dedans. */
export function issueToken(now = Date.now()): string {
  const expiry = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expiry);
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload), 'utf8');
  const given = Buffer.from(signature, 'utf8');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const expiry = Number(payload);
  return Number.isFinite(expiry) && expiry > now;
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
