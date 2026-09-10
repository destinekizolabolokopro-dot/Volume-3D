import 'server-only';
import { cookies } from 'next/headers';
import { randomId } from '../ids';
import {
  emettreJeton,
  hashPassword,
  lireJeton,
  optionsDuCookie,
  sessionsConfigurees,
  verifyPassword,
} from '../sessions';
import { getStore } from '../store';
import type { CompteJuridique } from '../types';

export { hashPassword, sessionsConfigurees, verifyPassword };

/**
 * Les comptes de l'assistant juridique.
 *
 * Ils n'ont rien de commun avec ceux de Volume3D, et c'est tout l'objet de ce
 * fichier. Deux services, deux clientèles, deux facturations : une table à
 * part, un cookie à part, une portée de signature à part. Un jeton émis pour
 * les visites 3D ne valide pas ici, même s'il est signé du même secret — voir
 * `emettreJeton` dans lib/sessions.ts.
 *
 * La même adresse électronique peut donc exister des deux côtés, avec deux
 * mots de passe différents, sans que l'un ouvre l'autre. C'est le
 * comportement voulu : ce sont deux abonnements, pas deux pages d'un même
 * abonnement.
 *
 * Ce qui reste partagé se limite à la mécanique — scrypt, le HMAC, la durée de
 * session. Deux copies d'un code de sécurité, dont une seule serait corrigée
 * le jour où il faudra la corriger, serait la mauvaise sorte de séparation.
 */

export const COOKIE = 'jur_session';

/** Jeton de session juridique. La portée « juridique » entre dans la signature. */
export function emettreSession(compteId: string, now = Date.now()): string {
  return emettreJeton('juridique', compteId, now);
}

export function lireSession(jeton: string | undefined, now = Date.now()): string | null {
  return lireJeton('juridique', jeton, now);
}

export const optionsSession = optionsDuCookie;

/** Le compte connecté, ou null. Ne lève jamais : une session invalide vaut déconnecté. */
export async function compteCourant(): Promise<CompteJuridique | null> {
  try {
    const jar = await cookies();
    const id = lireSession(jar.get(COOKIE)?.value);
    if (!id) return null;
    const compte = await getStore().get('comptesJuridiques', id);
    /* Seul 'active' ouvre. Un compte suspendu garde son cookie trente jours :
       le tester par la négative — « tout sauf supprimé » — laissait la
       suspension sans effet jusqu'à l'expiration, c'est-à-dire sans effet. */
    return compte && compte.statut === 'active' ? compte : null;
  } catch {
    return null;
  }
}

export async function trouverParEmail(email: string): Promise<CompteJuridique | null> {
  const normalise = email.trim().toLowerCase();
  const comptes = await getStore().list('comptesJuridiques');
  return comptes.find((compte) => compte.email.toLowerCase() === normalise) ?? null;
}

export async function creerCompte(entree: {
  email: string;
  motDePasse: string;
  nom: string;
}): Promise<CompteJuridique> {
  const compte: CompteJuridique = {
    id: randomId(),
    email: entree.email.trim().toLowerCase(),
    passwordHash: await hashPassword(entree.motDePasse),
    nom: entree.nom,
    statut: 'active',
    createdAt: new Date().toISOString(),
    /* Tout compte ouvre sur la formule gratuite : on ne demande pas de carte
       pour poser une première question. */
    abonnement: 'decouverte',
    abonnementDepuis: new Date().toISOString(),
    /* Le profil est demandé juste après, sur un écran à lui : trois questions
       à l'inscription font trois occasions d'abandonner. */
    metier: '',
    volume: '',
    usage: '',
  };
  await getStore().insert('comptesJuridiques', compte);
  return compte;
}
