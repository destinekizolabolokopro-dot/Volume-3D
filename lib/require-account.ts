import 'server-only';
import { redirect } from 'next/navigation';
import { currentAccount } from './accounts';
import type { Account } from './types';

/** À appeler en tête de chaque page de l'espace client. */
export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect('/espace/connexion');
  return account;
}
