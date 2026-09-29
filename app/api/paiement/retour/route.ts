import { NextResponse } from 'next/server';
import { estFormuleId } from '@/lib/abonnements';
import { donneAcces, etatDuStatut } from '@/lib/facturation';
import { lireLAbonnement, lireLeMessage, paiementBranche } from '@/lib/paiement';
import { getStore } from '@/lib/store';

/**
 * Ce que Stripe nous dit.
 *
 * C'est LE SEUL ENDROIT DU SITE où une requête anonyme écrit dans la base, et
 * tout ce fichier est construit autour de ce fait.
 *
 * Elle est anonyme parce qu'elle doit l'être : Stripe appelle cette adresse
 * depuis ses serveurs, sans session, sans cookie, souvent plusieurs minutes
 * après que la personne a fermé son onglet. Attendre le retour du navigateur
 * pour ouvrir la formule serait une erreur de conception : quelqu'un qui paie
 * puis coupe sa connexion aurait payé sans rien recevoir.
 *
 * Ce qui la protège est la signature. Sans elle, n'importe qui pourrait
 * poster ici « l'abonnement du compte X est actif » et s'ouvrir la formule
 * Cabinet. Le corps est donc lu en texte brut et vérifié tel quel : le relire
 * après un JSON.parse invaliderait la signature, qui porte sur les octets.
 *
 * Et une requête non vérifiée n'est pas une panne : c'est un 400. Rendre 500
 * ferait relancer Stripe pendant trois jours sur un message qui ne sera
 * jamais valable.
 */

export const dynamic = 'force-dynamic';
/* Le corps doit arriver intact : aucun traitement, aucun analyseur, aucune
   recompression. Node, pas Edge — la vérification a besoin des octets. */
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!paiementBranche()) {
    return NextResponse.json({ error: 'Paiement non configuré.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature') ?? '';
  if (!signature) {
    return NextResponse.json({ error: 'Signature absente.' }, { status: 400 });
  }

  let message;
  try {
    message = await lireLeMessage(await request.text(), signature);
  } catch (cause) {
    console.error('paiement: message refusé', cause);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  try {
    switch (message.type) {
      /* Les trois qui décrivent la vie d'un abonnement. Le paiement lui-même
         — « checkout.session.completed » — n'est pas écouté, et c'est
         volontaire : il annonce une caisse franchie, pas un abonnement en
         vigueur. Stripe envoie le second juste après, avec le statut réel, et
         n'écouter que celui-là évite d'ouvrir une formule sur un paiement qui
         se révélerait refusé dans la minute. */
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await appliquer(message.data.object);
        break;
      }
      default:
        /* Tout le reste est reçu et acquitté sans rien faire. Répondre 200 à
           un message qu'on n'écoute pas est ce que Stripe attend : une erreur
           le ferait relancer indéfiniment sur un message parfaitement
           valable. */
        break;
    }
  } catch (cause) {
    /* Là, en revanche, 500 est le bon code : la base n'a pas pris l'écriture,
       et on VEUT que Stripe rappelle. */
    console.error('paiement: écriture impossible', cause);
    return NextResponse.json({ error: 'Traitement impossible.' }, { status: 500 });
  }

  return NextResponse.json({ recu: true });
}

/**
 * Écrit ce que Stripe vient de dire.
 *
 * L'état et la formule sont écrits ensemble : ils se lisent ensemble, et un
 * compte qui porterait « Pro » avec un état vide ne saurait pas dire s'il est
 * payé ou offert.
 */
async function appliquer(abonnement: Parameters<typeof lireLAbonnement>[0]): Promise<void> {
  const nouvelle = lireLAbonnement(abonnement);
  if (!nouvelle) {
    /* Un abonnement sans compte rattaché : créé à la main dans le tableau de
       bord Stripe, ou venu d'un autre site partageant la même clé. On le
       laisse passer en le disant, plutôt que d'écrire au hasard. */
    console.warn('paiement: abonnement sans compte rattaché');
    return;
  }

  const compte = await getStore().get('comptesJuridiques', nouvelle.compteId);
  if (!compte) {
    console.warn('paiement: compte introuvable', nouvelle.compteId);
    return;
  }

  const etat = etatDuStatut(nouvelle.statut);
  const ouvert = donneAcces(etat);

  /* LA FORMULE SUIT L'ÉTAT, PAS LE TARIF. Un abonnement résilié porte encore
     le tarif « Pro » dans ses lignes : s'y fier laisserait la formule ouverte
     après la fin. Quand l'accès tombe, on redescend en Découverte. */
  const visee = ouvert && estFormuleId(nouvelle.formule) ? nouvelle.formule : 'decouverte';

  await getStore().update('comptesJuridiques', compte.id, {
    abonnement: visee,
    abonnementDepuis:
      compte.abonnement === visee ? compte.abonnementDepuis : new Date().toISOString(),
    abonnementEtat: etat,
    abonnementJusquA: nouvelle.finDePeriode,
    /* Renseigné au passage : il peut manquer quand l'abonnement a été créé
       ailleurs que par notre caisse. */
    stripeClientId: compte.stripeClientId || nouvelle.stripeClientId,
  });
}
