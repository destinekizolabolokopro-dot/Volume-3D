'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { envoyerLaVerification } from '@/lib/acces';
import { estFormuleId, formuleDuCompte } from '@/lib/abonnements';
import { donneAcces, estEtatAbonnement } from '@/lib/facturation';
import { ouvrirLaCaisse, ouvrirLePortail, paiementBranche } from '@/lib/paiement';
import { COOKIE, compteCourant } from '@/lib/comptes';
import { effacerLeCompte } from '@/lib/donnees';
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

/**
 * Supprimer son compte, et tout ce qui va avec.
 *
 * Deux garde-fous, et pas un de plus. Il faut recopier son adresse — ce qui
 * exclut le clic distrait sans transformer la sortie en parcours du
 * combattant —, et la session est fermée juste après, parce qu'un cookie qui
 * désigne un compte effacé promènerait la personne d'écran vide en écran vide.
 *
 * Aucune tentative de retenir qui que ce soit : ni « êtes-vous sûr », ni
 * « voulez-vous plutôt une pause », ni offre de dernière minute. Un droit
 * qu'on exerce en traversant trois écrans de persuasion n'est déjà plus tout
 * à fait un droit.
 */
export async function supprimerMonCompte(formData: FormData): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const saisie = String(formData.get('confirmation') ?? '').trim().toLowerCase();
  if (saisie !== compte.email.toLowerCase()) {
    redirect('/espace/compte/donnees?erreur=adresse');
  }

  await effacerLeCompte(compte.id);

  const jar = await cookies();
  jar.delete(COOKIE);
  redirect('/?efface=1');
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
/**
 * Prendre une formule, ou en changer.
 *
 * Deux mondes, et le même bouton.
 *
 * TANT QU'AUCUN PRESTATAIRE N'EST BRANCHÉ, le changement est immédiat et
 * gratuit. L'écran le dit en toutes lettres plutôt que de simuler une caisse
 * qui n'encaisse rien : c'est la seule chose vraiment malhonnête qu'on
 * pourrait faire à cet endroit.
 *
 * UNE FOIS LE PAIEMENT BRANCHÉ, ce bouton ne donne plus la formule : il
 * ouvre une caisse. C'est Stripe qui, une fois payé, prévient le serveur par
 * un message signé, et c'est ce message-là qui écrit la formule. Sans cette
 * règle, envoyer ce formulaire à la main suffirait à obtenir « Cabinet »
 * gratuitement — il est visible dans n'importe quel navigateur.
 *
 * ET ON NE RETIRE PAS CE QUI EST PAYÉ. Redescendre en Découverte alors qu'un
 * abonnement court ne s'écrit pas dans la base : cela couperait un service
 * encore facturé. Cela se résilie chez Stripe, à la fin de la période, et
 * l'accès tient jusque-là — d'où le renvoi vers le portail.
 */
export async function changerFormule(formData: FormData): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const demandee = formData.get('formule');
  if (!estFormuleId(demandee)) redirect('/abonnement');

  const formule = formuleDuCompte(compte.abonnement);
  if (formule.id === demandee) redirect('/espace/compte');

  /* Une adresse non confirmée n'empêche pas d'entrer ; elle empêche de payer.
     C'est là qu'une adresse fausse devient un problème — pour la facture
     comme pour la reprise en main du compte. */
  if (demandee !== 'decouverte' && !compte.emailVerifieA) {
    redirect('/espace/compte?confirmer=1');
  }

  if (!paiementBranche()) {
    await getStore().update('comptesJuridiques', compte.id, {
      abonnement: demandee,
      abonnementDepuis: new Date().toISOString(),
    });
    redirect('/espace/compte');
  }

  const enregistrerLeClient = async (stripeClientId: string) => {
    await getStore().update('comptesJuridiques', compte.id, { stripeClientId });
  };

  /* Descendre vers la formule gratuite pendant qu'un abonnement court :
     c'est une résiliation, et elle se fait là où elle se voit — avec la date
     de fin, les factures, et la possibilité de revenir en arrière. */
  const etat = estEtatAbonnement(compte.abonnementEtat) ? compte.abonnementEtat : 'clos';
  if (demandee === 'decouverte') {
    if (!donneAcces(etat)) {
      await getStore().update('comptesJuridiques', compte.id, {
        abonnement: 'decouverte',
        abonnementDepuis: new Date().toISOString(),
      });
      redirect('/espace/compte');
    }
    const portail = await ouvrirLePortail(compte, enregistrerLeClient);
    redirect(portail.url);
  }

  /* Changer d'une formule payante à une autre passe aussi par le portail :
     c'est là que Stripe calcule le prorata, et refaire ce calcul ici
     donnerait deux montants pour une seule facture. */
  if (donneAcces(etat) && formule.id !== 'decouverte') {
    const portail = await ouvrirLePortail(compte, enregistrerLeClient);
    redirect(portail.url);
  }

  const caisse = await ouvrirLaCaisse(compte, demandee, enregistrerLeClient);
  redirect(caisse.url);
}

/**
 * La gestion de l'abonnement : carte, factures, résiliation.
 *
 * Tout est chez Stripe, et refaire ces écrans ici reviendrait à en afficher
 * une copie qui peut être fausse — la carte a pu être changée depuis, la
 * facture a pu être rééditée, la date de fin a pu bouger.
 */
export async function gererLAbonnement(): Promise<void> {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');
  if (!paiementBranche()) redirect('/espace/compte');

  const portail = await ouvrirLePortail(compte, async (stripeClientId) => {
    await getStore().update('comptesJuridiques', compte.id, { stripeClientId });
  });
  redirect(portail.url);
}
