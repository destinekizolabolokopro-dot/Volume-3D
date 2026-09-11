'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { envoyerLaVerification } from '@/lib/acces';
import { estFormuleId, formuleDuCompte } from '@/lib/abonnements';
import { COOKIE, compteCourant } from '@/lib/comptes';
import { QUESTIONS } from '@/lib/profils';
import { getStore } from '@/lib/store';

/**
 * Ce qu'on fait une fois entré : son profil, sa formule, sa sortie.
 *
 * Ce qui précède l'entrée — se connecter, ouvrir un compte, reprendre la main
 * sur le sien — vit dans app/entrer/actions.ts. La séparation n'est pas
 * cosmétique : ce fichier suppose un compte et se contente de le relire, celui
 * d'à côté n'en suppose aucun et porte donc tous les garde-fous — frein sur
 * les tentatives, vérification de l'hébergement, messages qui ne révèlent pas
 * qui est client.
 */

/**
 * Enregistrer le profil.
 *
 * Rien n'est obligatoire, et un choix inconnu est ignoré plutôt que refusé :
 * ce formulaire ne garde pas la porte, il renseigne le spécialiste.
 */
export async function enregistrerProfil(formData: FormData): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const reponses: Record<string, string> = {};
  for (const question of QUESTIONS) {
    const donnee = formData.get(question.cle);
    const valide = question.choix.some((choix) => choix.id === donnee);
    reponses[question.cle] = valide ? String(donnee) : '';
  }

  await getStore().update('comptesJuridiques', compte.id, reponses);
  redirect('/espace');
}

export async function deconnexion(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect('/');
}

/** Renvoyer le courriel de confirmation, depuis le bandeau de l'espace. */
export async function renvoyerLaVerification(): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');
  if (!compte.emailVerifieA) await envoyerLaVerification(compte);
  redirect('/espace/compte?renvoye=1');
}

/**
 * Changer de formule.
 *
 * Tant qu'aucun prestataire de paiement n'est branché, le changement est
 * immédiat et gratuit — et chaque écran qui le propose l'écrit. C'est le seul
 * comportement honnête : simuler une page de carte bancaire pour une caisse
 * qui n'existe pas serait pire que de ne rien encaisser du tout.
 *
 * Le jour où `STRIPE_SECRET_KEY` existe, c'est ici que la redirection vers la
 * page de paiement remplace l'écriture directe, et rien d'autre ne bouge :
 * les formules, les quotas et leur application sont déjà en place.
 *
 * ── L'adresse doit être confirmée pour passer au payant ────────────────────
 * Pas pour entrer, pas pour poser une question : seulement ici. C'est le
 * moment où une adresse fausse devient un vrai problème — une facture qui
 * n'arrive pas, un compte payant dont personne ne peut reprendre la main. La
 * formule gratuite, elle, reste ouverte sans rien confirmer.
 */
export async function changerFormule(formData: FormData): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const demandee = formData.get('formule');
  if (!estFormuleId(demandee)) redirect('/abonnement');

  const formule = formuleDuCompte(compte.abonnement);
  if (formule.id === demandee) redirect('/espace/compte');

  const visee = estFormuleId(demandee) ? demandee : null;
  if (visee && visee !== 'decouverte' && !compte.emailVerifieA) {
    redirect('/espace/compte?confirmer=1');
  }

  await getStore().update('comptesJuridiques', compte.id, {
    abonnement: demandee,
    abonnementDepuis: new Date().toISOString(),
  });

  redirect('/espace/compte');
}
