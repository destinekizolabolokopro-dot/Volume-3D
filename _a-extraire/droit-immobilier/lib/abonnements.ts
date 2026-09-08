/**
 * Les formules de l'assistant juridique.
 *
 * Trois formules et pas quatre : au-delà, on ne choisit plus, on hésite. La
 * formule du milieu est celle qu'on recommande, et les deux autres existent
 * autant pour l'encadrer que pour être vendues — celle du bas donne un point
 * d'entrée sans engagement, celle du haut rend la médiane raisonnable.
 *
 * Ce fichier ne connaît ni Stripe ni aucun prestataire : il décrit ce qui est
 * vendu, pas comment c'est encaissé. Le branchement du paiement est un seul
 * point d'entrée, `paiementConfigure()`, et tant qu'aucune clé n'est présente
 * le changement de formule est immédiat et gratuit — l'interface le dit alors
 * en toutes lettres plutôt que de simuler une caisse.
 */

export type FormuleId = 'decouverte' | 'pro' | 'cabinet';

export interface Formule {
  id: FormuleId;
  nom: string;
  /** Prix mensuel en euros. Zéro pour l'entrée de gamme. */
  prix: number;
  /** Une ligne : à qui elle s'adresse. */
  pour: string;
  /** Questions par mois. `Infinity` pour l'offre haute. */
  quota: number;
  /** Le dépôt de documents est-il ouvert ? */
  pieces: boolean;
  /** Ce que la formule apporte, dans l'ordre où on le lit. */
  avantages: string[];
  /** La formule mise en avant. Une seule, sinon aucune ne l'est. */
  recommandee?: boolean;
}

/**
 * Sans compte : trois questions par jour et par adresse. Assez pour juger de
 * la qualité d'une réponse, pas assez pour traiter un dossier. C'est le seul
 * quota qui se compte à la journée — il n'y a personne à qui rattacher un
 * mois.
 */
export const QUOTA_ANONYME = 3;

export const FORMULES: Formule[] = [
  {
    id: 'decouverte',
    nom: 'Découverte',
    prix: 0,
    pour: 'Pour une question qui revient de temps en temps.',
    quota: 10,
    pieces: false,
    avantages: [
      'dix questions par mois',
      'les dix spécialités, sans restriction',
      'vos consultations conservées et rouvrables',
      'les délais et l’aide-mémoire de chaque spécialité',
    ],
  },
  {
    id: 'pro',
    nom: 'Pro',
    prix: 19,
    pour: 'Pour un propriétaire qui gère plusieurs biens, ou un négociateur.',
    quota: 150,
    pieces: true,
    recommandee: true,
    avantages: [
      'cent cinquante questions par mois',
      'dépôt de documents : bail, devis, procès-verbal, arrêté',
      'le tableau des diagnostics et le calendrier énergie',
      'historique complet, effaçable à tout moment',
    ],
  },
  {
    id: 'cabinet',
    nom: 'Cabinet',
    prix: 49,
    pour: 'Pour une agence, une conciergerie, un cabinet de gestion.',
    quota: Number.POSITIVE_INFINITY,
    pieces: true,
    avantages: [
      'questions sans limite',
      'dépôt de documents sans limite',
      'la spécialité « métier de l’agent immobilier »',
      'réponse par courriel sous un jour ouvré en cas de doute',
    ],
  },
];

const PAR_ID = new Map<FormuleId, Formule>(FORMULES.map((formule) => [formule.id, formule]));

export function estFormuleId(value: unknown): value is FormuleId {
  return typeof value === 'string' && PAR_ID.has(value as FormuleId);
}

/** Lève sur un identifiant inconnu : une formule manquante est un bug. */
export function formule(id: FormuleId): Formule {
  const trouvee = PAR_ID.get(id);
  if (!trouvee) throw new Error(`Formule inconnue : ${id}`);
  return trouvee;
}

/** La formule d'un compte. Un champ vide vaut « Découverte ». */
export function formuleDuCompte(valeur: unknown): Formule {
  return estFormuleId(valeur) ? formule(valeur) : formule('decouverte');
}

/**
 * Vrai quand un prestataire de paiement est configuré.
 *
 * Tant qu'il ne l'est pas, le site ne fait pas semblant : les formules
 * payantes restent visibles et sélectionnables, et chaque écran qui les
 * propose écrit noir sur blanc qu'aucun paiement n'est demandé. Simuler une
 * page de carte bancaire serait la seule chose vraiment malhonnête à faire
 * ici.
 */
export function paiementConfigure(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** « 19 € / mois », ou « Gratuit ». L'espace insécable est posé ici. */
export function prixLisible(formule: Formule): string {
  return formule.prix === 0 ? 'Gratuit' : `${formule.prix} €`;
}

export function quotaLisible(formule: Formule): string {
  return Number.isFinite(formule.quota) ? `${formule.quota} questions par mois` : 'Questions sans limite';
}
