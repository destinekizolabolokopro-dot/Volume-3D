import 'server-only';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { createHmac } from 'node:crypto';
import { randomId } from './ids';
import { getStore } from './store';
import type { Account, Plan } from './types';

const scrypt = promisify(scryptCallback);

export const OWNER_COOKIE = 'v3d_owner';
const SESSION_DAYS = 30;

/**
 * Comptes clients.
 *
 * Chaque propriétaire ou conciergerie dispose d'un espace où il crée et gère
 * ses propres biens. La formule ne fixe pas un loyer mensuel — le service se
 * paie au logement, une fois — mais le nombre de biens qu'un compte peut
 * tenir : voir `PLAN_LIMITS` plus bas, et `PLAN_OFFERS` dans `lib/content.ts`
 * pour ce qu'on en dit au client. Les mots de passe
 * sont dérivés par scrypt avec un sel par compte : la base ne contient jamais
 * de mot de passe en clair, et deux clients ayant le même mot de passe ont des
 * empreintes différentes.
 */

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET manquant ou trop court (16 caractères minimum).");
  }
  return value;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (expectedBuffer.length !== derived.length) return false;
  return timingSafeEqual(expectedBuffer, derived);
}

/* --------------------------------------------------------------- session --- */

/** Jeton « idDuCompte.expiration.signature ». Aucune donnée sensible dedans. */
export function issueOwnerToken(accountId: string, now = Date.now()): string {
  const payload = `${accountId}.${now + SESSION_DAYS * 24 * 60 * 60 * 1000}`;
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readOwnerToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [accountId, expiry, signature] = parts;
  const expected = createHmac('sha256', secret()).update(`${accountId}.${expiry}`).digest('base64url');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Number(expiry) > now ? accountId : null;
}

export const ownerCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

/** Compte connecté, ou null. Ne lève jamais : une session invalide vaut déconnecté. */
export async function currentAccount(): Promise<Account | null> {
  try {
    const jar = await cookies();
    const accountId = readOwnerToken(jar.get(OWNER_COOKIE)?.value);
    if (!accountId) return null;
    const account = await getStore().get('accounts', accountId);
    return account && account.status !== 'deleted' ? account : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- création --- */

export const PLAN_LABELS: Record<Plan, string> = {
  essentiel: 'Essentiel',
  pro: 'Pro',
  conciergerie: 'Conciergerie',
};

/** Nombre de biens autorisés par formule. `Infinity` pour l'offre conciergerie. */
export const PLAN_LIMITS: Record<Plan, number> = {
  essentiel: 1,
  pro: 5,
  conciergerie: Infinity,
};

export async function findAccountByEmail(email: string): Promise<Account | null> {
  const normalized = email.trim().toLowerCase();
  const accounts = await getStore().list('accounts');
  return accounts.find((account) => account.email.toLowerCase() === normalized) ?? null;
}

export async function createAccount(input: {
  email: string;
  password: string;
  name: string;
  company: string;
  phone: string;
  plan: Plan;
}): Promise<Account> {
  const account: Account = {
    id: randomId(),
    email: input.email.trim().toLowerCase(),
    passwordHash: await hashPassword(input.password),
    name: input.name,
    company: input.company,
    phone: input.phone,
    plan: input.plan,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  await getStore().insert('accounts', account);
  return account;
}
