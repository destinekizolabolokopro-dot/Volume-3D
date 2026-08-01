import 'server-only';
import { redirect } from 'next/navigation';
import { isAuthenticated } from './auth';

/**
 * À appeler en tête de chaque page du back-office.
 *
 * Les Server Actions vérifient la session de leur côté : la protection ne
 * repose donc pas uniquement sur cette redirection d'affichage.
 */
export async function requireAuth(): Promise<void> {
  let authorized = false;
  try {
    authorized = await isAuthenticated();
  } catch {
    // Variables d'environnement absentes : la page de connexion expliquera quoi faire.
    authorized = false;
  }
  if (!authorized) redirect('/admin/login');
}

/** Vrai si le back-office n'a pas encore été configuré. */
export function isConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && (process.env.AUTH_SECRET ?? '').length >= 16);
}
