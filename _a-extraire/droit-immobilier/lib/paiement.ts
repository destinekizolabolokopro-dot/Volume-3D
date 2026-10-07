import 'server-only';
import Stripe from 'stripe';
import { estFormuleId, formule, type Formule, type FormuleId } from './abonnements';
import type { CompteJuridique } from './types';

/**
 * L'encaissement.
 *
 * Tout ce qui touche à Stripe est ici, et nulle part ailleurs. Le reste du
 * site ne sait pas qui encaisse : il sait qu'une formule est prise ou qu'elle
 * ne l'est pas.
 *
 * UNE RÈGLE DOMINE CE FICHIER, et elle vaut la peine d'être dite avant le
 * premier appel : LE BOUTON NE DONNE PAS LA FORMULE. Il ouvre une caisse.
 * C'est Stripe qui, une fois payé, prévient le serveur par un message signé,
 * et c'est ce message-là — et lui seul — qui écrit la formule dans la base.
 *
 * Sans cette règle, il suffirait d'envoyer le formulaire de changement de
 * formule pour obtenir « Cabinet » sans payer : le bouton est visible dans
 * n'importe quel navigateur, et personne ne peut empêcher qu'on l'envoie deux
 * fois, ou à la main.
 *
 * Deuxième règle : on ne retire jamais ce qui est payé. Descendre de formule
 * ne se fait pas en écrivant « decouverte » dans la base — cela reviendrait à
 * couper un service encore facturé. Cela se fait en résiliant chez Stripe, à
 * la fin de la période en cours, et l'accès tient jusque-là.
 */

const cle = (): string => (process.env.STRIPE_SECRET_KEY ?? '').trim();
const secretDuCrochet = (): string => (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();

/**
 * Le tarif Stripe de chaque formule payante.
 *
 * Les prix ne sont pas dans le code : un montant écrit à deux endroits finit
 * par différer, et celui qui compte est celui qui débite. Le code porte ce
 * qui est vendu (lib/abonnements.ts) ; Stripe porte ce que ça coûte.
 */
const TARIFS: Record<Exclude<FormuleId, 'decouverte'>, string> = {
  get pro() {
    return (process.env.STRIPE_PRIX_PRO ?? '').trim();
  },
  get cabinet() {
    return (process.env.STRIPE_PRIX_CABINET ?? '').trim();
  },
};

/**
 * Vrai quand l'encaissement est réellement branché — pas seulement commencé.
 *
 * Il faut la clé ET les deux tarifs. Une clé seule produirait une caisse qui
 * s'ouvre sur une erreur au moment précis où quelqu'un sort sa carte, ce qui
 * est le pire endroit du parcours pour une demi-configuration.
 */
export function paiementBranche(): boolean {
  return Boolean(cle() && TARIFS.pro && TARIFS.cabinet);
}

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!paiementBranche()) throw new Error('Le paiement n’est pas configuré.');
  if (!client) client = new Stripe(cle());
  return client;
}

/** La formule qui correspond à un tarif Stripe, ou `null` s'il est inconnu. */
export function formuleDuTarif(tarif: string): FormuleId | null {
  if (!tarif) return null;
  for (const [id, reference] of Object.entries(TARIFS)) {
    if (reference && reference === tarif && estFormuleId(id)) return id;
  }
  return null;
}

function racine(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/* ================================================================= le client === */

/**
 * Le client Stripe de ce compte, créé au besoin.
 *
 * L'identifiant est gardé sur le compte pour une raison précise : sans lui,
 * chaque passage en caisse créerait un nouveau client, et l'historique de
 * facturation d'une même personne se retrouverait éparpillé sur trois fiches.
 * Le jour où elle réclame une facture, personne ne la retrouve.
 *
 * Le courriel est envoyé à Stripe — c'est le minimum pour émettre une facture
 * — et l'identifiant du compte voyage en métadonnée, pour que le message de
 * retour sache à qui il s'adresse même si l'adresse a changé entre-temps.
 */
async function clientDuCompte(
  compte: CompteJuridique,
  enregistrer: (stripeClientId: string) => Promise<void>,
): Promise<string> {
  if (compte.stripeClientId) return compte.stripeClientId;

  const cree = await stripe().customers.create({
    email: compte.email,
    name: compte.nom || undefined,
    metadata: { compteId: compte.id },
  });

  await enregistrer(cree.id);
  return cree.id;
}

/* ================================================================== la caisse === */

export interface PassageEnCaisse {
  /** L'adresse de la page de paiement, hébergée par Stripe. */
  url: string;
}

/**
 * Ouvre la caisse pour une formule payante.
 *
 * La page est celle de Stripe, et c'est un choix, pas une facilité : un
 * formulaire de carte bancaire hébergé ici obligerait ce site à voir passer
 * des numéros de carte, donc à répondre d'eux. Chez Stripe, il n'en voit
 * jamais aucun.
 *
 * `client_reference_id` et la métadonnée portent l'identifiant du compte. Le
 * message de retour les relira : c'est le seul lien entre un paiement et
 * quelqu'un, et il ne doit dépendre ni de l'adresse électronique — qui
 * change — ni de la session — qui expire.
 */
export async function ouvrirLaCaisse(
  compte: CompteJuridique,
  visee: FormuleId,
  enregistrerLeClient: (stripeClientId: string) => Promise<void>,
): Promise<PassageEnCaisse> {
  if (visee === 'decouverte') throw new Error('La formule gratuite ne passe pas en caisse.');
  const tarif = TARIFS[visee];
  if (!tarif) throw new Error(`Aucun tarif Stripe pour la formule « ${visee} ».`);

  const clientId = await clientDuCompte(compte, enregistrerLeClient);

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: clientId,
    client_reference_id: compte.id,
    line_items: [{ price: tarif, quantity: 1 }],
    locale: 'fr',
    /* La facture part toute seule. Un abonnement professionnel sans facture
       est inutilisable en comptabilité, et la réclamer par courriel est
       exactement le genre de friction qui fait résilier. */
    subscription_data: { metadata: { compteId: compte.id, formule: visee } },
    /* L'adresse de facturation est demandée : elle est nécessaire pour
       déterminer la TVA applicable, et elle figure sur la facture. */
    billing_address_collection: 'required',
    /* Le numéro de TVA intracommunautaire, pour un professionnel qui le
       veut sur sa facture. Facultatif, jamais bloquant. */
    tax_id_collection: { enabled: true },
    success_url: `${racine()}/espace/compte?paiement=ok`,
    cancel_url: `${racine()}/abonnement?paiement=abandon`,
  });

  if (!session.url) throw new Error('Stripe n’a pas rendu d’adresse de paiement.');
  return { url: session.url };
}

/**
 * Le portail de gestion : changer de carte, résilier, télécharger ses factures.
 *
 * Il est préféré à des écrans maison pour trois raisons qui tiennent toutes
 * au même fait — c'est Stripe qui détient la vérité. Les factures y sont, la
 * carte y est, la date de fin de période y est. Refaire ces écrans ici
 * reviendrait à en afficher une copie qui peut être fausse.
 */
export async function ouvrirLePortail(
  compte: CompteJuridique,
  enregistrerLeClient: (stripeClientId: string) => Promise<void>,
): Promise<PassageEnCaisse> {
  const clientId = await clientDuCompte(compte, enregistrerLeClient);

  const session = await stripe().billingPortal.sessions.create({
    customer: clientId,
    locale: 'fr',
    return_url: `${racine()}/espace/compte`,
  });

  return { url: session.url };
}

/* ================================================================ le retour === */

/**
 * Le message de Stripe, vérifié.
 *
 * La signature n'est pas une formalité : cette adresse est publique, elle
 * n'est protégée par aucune session, et sans vérification n'importe qui
 * pourrait y poster « cet abonnement est actif » pour le compte de son choix.
 * C'est le seul endroit du site où une requête anonyme écrit dans la base.
 *
 * Le corps est lu en TEXTE BRUT et vérifié tel quel. Le relire après un
 * `JSON.parse` invaliderait la signature : elle porte sur les octets, y
 * compris les espaces.
 */
export async function lireLeMessage(corps: string, signature: string): Promise<Stripe.Event> {
  const secret = secretDuCrochet();
  if (!secret) throw new Error('Aucun secret de vérification n’est configuré.');
  return stripe().webhooks.constructEventAsync(corps, signature, secret);
}

/** Ce qu'un message de Stripe apprend sur un compte. */
export interface Nouvelle {
  compteId: string;
  /** La formule payée, ou `null` quand l'abonnement ne donne plus rien. */
  formule: FormuleId;
  /** Le statut brut, tel que Stripe le nomme. Traduit par lib/facturation.ts. */
  statut: string;
  /** La fin de la période en cours, en ISO. Vide si Stripe ne la donne pas. */
  finDePeriode: string;
  stripeClientId: string;
}

/**
 * Ce qu'il faut retenir d'un abonnement Stripe.
 *
 * L'identifiant du compte est cherché dans la métadonnée de l'abonnement
 * PUIS dans celle du client : le premier chemin est celui d'un abonnement né
 * de notre caisse, le second rattrape ceux créés autrement — une reprise
 * manuelle dans le tableau de bord Stripe, par exemple. Sans le second, ces
 * abonnements-là seraient reçus et jetés en silence.
 */
export function lireLAbonnement(abonnement: Stripe.Subscription): Nouvelle | null {
  const compteId =
    abonnement.metadata?.compteId ??
    (typeof abonnement.customer === 'object' && abonnement.customer && !abonnement.customer.deleted
      ? (abonnement.customer.metadata?.compteId ?? '')
      : '');

  if (!compteId) return null;

  const article = abonnement.items?.data?.[0];
  const tarif = typeof article?.price === 'object' ? (article.price?.id ?? '') : '';
  const visee = formuleDuTarif(tarif);

  /* Un tarif inconnu ne devient pas une formule au hasard : il retombe sur la
     gratuite. Mieux vaut un client qui réclame que la formule qu'il a payée
     qu'un client à qui l'on ouvre une formule qu'il n'a pas prise. */
  const fin = article?.current_period_end ?? null;

  return {
    compteId,
    formule: visee ?? 'decouverte',
    statut: abonnement.status,
    finDePeriode: fin ? new Date(fin * 1000).toISOString() : '',
    stripeClientId: typeof abonnement.customer === 'string' ? abonnement.customer : (abonnement.customer?.id ?? ''),
  };
}

/** La formule, pour l'affichage. */
export function formuleVisee(id: FormuleId): Formule {
  return formule(id);
}
