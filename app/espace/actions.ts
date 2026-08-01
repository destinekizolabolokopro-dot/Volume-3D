'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  OWNER_COOKIE,
  PLAN_LIMITS,
  createAccount,
  currentAccount,
  findAccountByEmail,
  issueOwnerToken,
  ownerCookieOptions,
  verifyPassword,
} from '@/lib/accounts';
import { getStore } from '@/lib/store';
import type { Plan } from '@/lib/types';
import { ValidationError, email as emailField, oneOf, text } from '@/lib/validation';

export interface OwnerResult {
  ok: boolean;
  error?: string;
}

async function run(fn: () => Promise<OwnerResult>): Promise<OwnerResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('[espace] action en échec', error);
    return { ok: false, error: 'Opération impossible. Réessayez dans un instant.' };
  }
}

/* =========================================================== compte === */

export async function signup(_previous: OwnerResult | null, formData: FormData): Promise<OwnerResult> {
  return run(async () => {
    const address = emailField(formData.get('email'));
    const password = String(formData.get('password') ?? '');
    if (password.length < 10) {
      throw new ValidationError('Choisissez un mot de passe d’au moins 10 caractères.');
    }
    if (await findAccountByEmail(address)) {
      throw new ValidationError('Un compte existe déjà avec cette adresse. Connectez-vous.');
    }

    const account = await createAccount({
      email: address,
      password,
      name: text(formData.get('name'), 'nom', { max: 140 }),
      company: text(formData.get('company'), 'société', { max: 140, required: false }),
      phone: text(formData.get('phone'), 'téléphone', { max: 40, required: false }),
      plan: oneOf<Plan>(formData.get('plan') ?? 'essentiel', ['essentiel', 'pro', 'conciergerie'], 'formule'),
    });

    const jar = await cookies();
    jar.set(OWNER_COOKIE, issueOwnerToken(account.id), ownerCookieOptions);
    redirect('/espace');
  });
}

export async function signin(_previous: OwnerResult | null, formData: FormData): Promise<OwnerResult> {
  return run(async () => {
    const address = emailField(formData.get('email'));
    const password = String(formData.get('password') ?? '');
    const account = await findAccountByEmail(address);

    // Même message dans les deux cas : ne pas révéler quelles adresses existent.
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new ValidationError('Email ou mot de passe incorrect.');
    }
    if (account.status !== 'active') {
      throw new ValidationError('Ce compte est suspendu. Contactez-nous.');
    }

    const jar = await cookies();
    jar.set(OWNER_COOKIE, issueOwnerToken(account.id), ownerCookieOptions);
    redirect('/espace');
  });
}

export async function signout(): Promise<void> {
  const jar = await cookies();
  jar.delete(OWNER_COOKIE);
  redirect('/espace/connexion');
}

export async function updateAccount(_previous: OwnerResult | null, formData: FormData): Promise<OwnerResult> {
  return run(async () => {
    const account = await currentAccount();
    if (!account) throw new ValidationError('Session expirée. Reconnectez-vous.');

    await getStore().update('accounts', account.id, {
      name: text(formData.get('name'), 'nom', { max: 140 }),
      company: text(formData.get('company'), 'société', { max: 140, required: false }),
      phone: text(formData.get('phone'), 'téléphone', { max: 40, required: false }),
      plan: oneOf<Plan>(formData.get('plan') ?? account.plan, ['essentiel', 'pro', 'conciergerie'], 'formule'),
    });
    return { ok: true };
  });
}

/* ======================================================== quotas === */

/**
 * Vérifie que la formule autorise un bien de plus.
 *
 * La limite est appliquée au moment de la création, pas de la publication :
 * mieux vaut refuser tôt que laisser un client préparer une visite qu'il ne
 * pourra pas mettre en ligne.
 */
export async function remainingSlots(): Promise<{ used: number; limit: number } | null> {
  const account = await currentAccount();
  if (!account) return null;
  const properties = await getStore().list('properties', { accountId: account.id });
  return { used: properties.length, limit: PLAN_LIMITS[account.plan as Plan] ?? 1 };
}
