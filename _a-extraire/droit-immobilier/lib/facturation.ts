/**
 * Ce qu'un état d'abonnement veut dire pour quelqu'un qui pose une question.
 *
 * Stripe connaît huit statuts. Ce fichier les ramène à quatre, et surtout il
 * tranche la seule question qui compte à l'écran : est-ce que cette personne
 * a le droit d'utiliser sa formule aujourd'hui ?
 *
 * La réponse n'est pas mécanique. Un paiement en retard n'est presque jamais
 * une fraude : c'est une carte expirée, un plafond atteint, une banque qui a
 * refusé une opération à trois heures du matin. Stripe relance pendant
 * plusieurs jours. Couper l'accès au premier échec ferait perdre un client
 * qui voulait payer, pour une somme qui allait rentrer.
 *
 * Ce fichier ne connaît pas Stripe : il reçoit une chaîne, il rend un sens.
 * C'est ce qui permet de le tester sans clé, et de changer de prestataire
 * sans réécrire la règle d'accès.
 */

export type EtatAbonnement =
  /** Payé, à jour. */
  | 'actif'
  /** Période d'essai en cours. */
  | 'essai'
  /** Un paiement a échoué, les relances sont en cours. L'accès tient. */
  | 'retard'
  /** Terminé, résilié, ou jamais abouti. Retour à la formule gratuite. */
  | 'clos';

/**
 * Le statut Stripe ramené à un sens.
 *
 * Un statut inconnu — Stripe peut en ajouter — est traité comme « clos », et
 * ce choix est délibéré : il ferme par défaut. Un statut nouveau qui
 * ouvrirait l'accès par oubli donnerait la formule Cabinet à qui n'a rien
 * payé, et personne ne s'en apercevrait.
 */
export function etatDuStatut(statut: string): EtatAbonnement {
  switch (statut) {
    case 'active':
      return 'actif';
    case 'trialing':
      return 'essai';
    case 'past_due':
      return 'retard';
    default:
      return 'clos';
  }
}

/** Vrai quand la formule payée s'applique encore. */
export function donneAcces(etat: EtatAbonnement): boolean {
  return etat === 'actif' || etat === 'essai' || etat === 'retard';
}

export function estEtatAbonnement(valeur: unknown): valeur is EtatAbonnement {
  return valeur === 'actif' || valeur === 'essai' || valeur === 'retard' || valeur === 'clos';
}

/**
 * Ce que l'écran dit de cet abonnement, en une phrase.
 *
 * Trois règles tenues ici.
 *
 * Un retard de paiement se dit sans menacer : la personne n'a rien fait de
 * mal, et le message doit lui donner le geste — mettre sa carte à jour —
 * plutôt qu'un compte à rebours.
 *
 * Une résiliation programmée se dit avec sa DATE. « Votre abonnement prendra
 * fin » sans dire quand est la pire version de cette information : elle
 * inquiète sans permettre de décider.
 *
 * Et rien n'est affirmé qu'on ne sache : sans date, la phrase s'arrête avant
 * la date au lieu d'inventer une échéance.
 */
export function phraseDEtat(etat: EtatAbonnement, finDePeriode: string): string {
  const jour = dateLisible(finDePeriode);

  if (etat === 'retard') {
    return 'Le dernier paiement n’a pas abouti. Votre formule reste ouverte le temps que la banque réessaie : mettez votre moyen de paiement à jour depuis la gestion de l’abonnement.';
  }

  if (etat === 'essai') {
    return jour
      ? `Période d’essai, jusqu’au ${jour}.`
      : 'Période d’essai en cours.';
  }

  if (etat === 'clos') {
    return 'Votre abonnement est terminé. Vous êtes revenu à la formule Découverte, et vos consultations sont conservées.';
  }

  return jour ? `Abonnement actif, prochaine échéance le ${jour}.` : 'Abonnement actif.';
}

/**
 * Une date ISO en français, ou une chaîne vide si elle n'est pas lisible.
 *
 * Vide plutôt qu'« Invalid Date » : une phrase amputée reste une phrase,
 * quand « prochaine échéance le Invalid Date » est un bug affiché à un
 * client.
 */
export function dateLisible(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
