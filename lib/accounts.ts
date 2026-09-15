import 'server-only';
import { cookies } from 'next/headers';
import { randomId } from './ids';
import {
  emettreJeton,
  hashPassword,
  lireJeton,
  optionsDuCookie,
  sessionsConfigurees,
  verifyPassword,
} from './sessions';
import { getStore } from './store';
import type { Account, Plan } from './types';

export { hashPassword, sessionsConfigurees, verifyPassword };

export const OWNER_COOKIE = 'v3d_owner';

/**
 * Comptes clients de Volume3D — les visites 3D, et rien d'autre.
 *
 * L'assistant juridique a les siens, dans lib/juridique/comptes.ts : deux
 * services, deux tables, deux cookies. Un compte ouvert ici n'ouvre pas de
 * session là-bas, et réciproquement.
 *
 * Chaque propriétaire ou conciergerie dispose d'un espace où il crée et gère
 * ses propres biens. La formule ne fixe pas un loyer mensuel — le service se
 * paie au logement, une fois — mais le nombre de biens qu'un compte peut
 * tenir : voir `PLAN_LIMITS` plus bas, et `PLAN_OFFERS` dans `lib/content.ts`
 * pour ce qu'on en dit au client. Les mots de passe sont dérivés par scrypt
 * avec un sel par compte : la base ne contient jamais de mot de passe en
 * clair, et deux clients ayant le même mot de passe ont des empreintes
 * différentes.
 */

/* --------------------------------------------------------------- session --- */

/** Jeton de session Volume3D. La portée « v3d » entre dans la signature. */
export function issueOwnerToken(accountId: string, now = Date.now()): string {
  return emettreJeton('v3d', accountId, now);
}

export function readOwnerToken(token: string | undefined, now = Date.now()): string | null {
  return lireJeton('v3d', token, now);
}

export const ownerCookieOptions = optionsDuCookie;

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
