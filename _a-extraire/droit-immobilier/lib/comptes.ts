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
import type { CompteJuridique } from './types';

export { hashPassword, sessionsConfigurees, verifyPassword };

/**
 * Les comptes.
 *
 * Un compte sert à trois choses, et pas une de plus : retrouver ses
 * consultations passées, porter une formule, et compter les questions du mois.
 * On n'y range ni téléphone, ni société, ni adresse — ce qu'on ne demande pas
 * ne fuit pas, et rien de tout cela ne changerait une réponse de droit.
 *
 * La signature du jeton est portée (voir lib/sessions.ts) : un cookie émis par
 * un autre service partageant le même AUTH_SECRET ne vaut rien ici.
 */

export const COOKIE = 'jur_session';

/** Jeton de session. La portée entre dans la signature — voir lib/sessions.ts. */
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

/**
 * Le compte portant cette adresse, ou null.
 *
 * La recherche est faite PAR LA BASE, sur l'égalité de l'adresse. Elle listait
 * tous les comptes du site pour filtrer ensuite en mémoire, ce qui marche
 * jusqu'au millier de lignes — le plafond d'une lecture Postgres — et se met
 * alors à répondre « cette adresse est libre » à quelqu'un qui a déjà un
 * compte. Deux comptes sur la même adresse, et personne ne comprend pourquoi
 * la connexion échoue.
 *
 * L'adresse est écrite en minuscules à la création, et normalisée ici de la
 * même façon : les deux valeurs comparées ont toujours la même forme.
 */
export async function trouverParEmail(email: string): Promise<CompteJuridique | null> {
  const normalise = email.trim().toLowerCase();
  if (!normalise) return null;
  const trouves = await getStore().list('comptesJuridiques', { email: normalise });
  return trouves[0] ?? null;
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
    /* L'adresse n'est pas confirmée, et cela n'empêche rien tout de suite :
       l'espace gratuit s'ouvre, un bandeau rappelle de confirmer, et la
       confirmation n'est exigée qu'au moment de prendre une formule payante.
       Voir `emailVerifieA` dans lib/types.ts. */
    emailVerifieA: '',
    /* Le profil est demandé juste après, sur un écran à lui : trois questions
       à l'inscription font trois occasions d'abandonner. */
    metier: '',
    volume: '',
    usage: '',
  };
  await getStore().insert('comptesJuridiques', compte);
  return compte;
}
