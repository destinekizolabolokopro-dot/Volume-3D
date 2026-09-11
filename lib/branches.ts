import type { DomaineId } from './domaines';

/**
 * Les branches du droit, et l'état de chacune.
 *
 * Une branche est un métier, pas une rubrique : elle a ses textes, ses délais,
 * son vocabulaire et ses gens. L'immobilier en est une, et c'est la seule qui
 * soit ouverte aujourd'hui — les dix spécialités du site en sont les
 * subdivisions, pas des branches.
 *
 * ── Pourquoi les autres sont ANNONCÉES et non livrées ──────────────────────
 * Parce qu'ouvrir une branche n'est pas ajouter un onglet. C'est choisir les
 * textes du fonds LEGI qui lui servent, les découper en articles citables,
 * écrire le périmètre de chaque spécialité, relever les délais qui ne se
 * rattrapent pas, et rédiger les modèles de courriers. L'immobilier, c'est
 * quinze textes et 2 133 articles. Une branche ouverte à moitié répondrait
 * sans citer — et « la réponse cite le texte » est l'argument qui fait tout
 * ce produit.
 *
 * Elles sont donc montrées, décrites en détail, et marquées comme à venir.
 * Personne ne clique sur un onglet vide en croyant qu'il fonctionne, et
 * l'ordre de construction est décidé par ceux qui demandent à être prévenus
 * plutôt que par une intuition — voir la table `attentes`.
 *
 * ── La branche se DÉDUIT de la spécialité ──────────────────────────────────
 * Elle n'est écrite nulle part sur une consultation. Une consultation porte sa
 * spécialité, et la spécialité appartient à une branche : deux colonnes pour
 * la même information finiraient par se contredire, et c'est toujours celle
 * qu'on ne lit pas qui reste juste.
 */

export type BrancheId = 'immobilier' | 'foncier' | 'construction' | 'travail' | 'societes';

export interface Branche {
  id: BrancheId;
  label: string;
  /** Une ligne, pour l'onglet et la carte. */
  resume: string;
  /** Ouverte : on peut y poser une question. Sinon, elle est annoncée. */
  ouverte: boolean;
  /** À qui elle s'adresse, en toutes lettres. */
  pour: string;
  /** Les spécialités qu'elle contiendra. Renseignées même avant l'ouverture. */
  specialites: string[];
  /**
   * Les textes qui lui serviront, nommés sans être numérotés.
   *
   * C'est une promesse vérifiable : le jour de l'ouverture, ce sont ces
   * textes-là qui seront joints aux questions, et on pourra comparer.
   */
  textes: string[];
  /**
   * Les spécialités réelles, quand la branche est ouverte. Vide sinon — et
   * c'est ce vide qui empêche d'afficher une branche annoncée comme prête.
   */
  domaines: DomaineId[];
}

export const BRANCHES: Branche[] = [
  {
    id: 'immobilier',
    label: 'Droit immobilier',
    resume: 'Louer, acheter, vendre, gérer un bien. Copropriété, travaux, urbanisme, fiscalité.',
    ouverte: true,
    pour: 'Propriétaires bailleurs, loueurs en meublé, copropriétaires, et les professionnels qui les accompagnent.',
    specialites: [
      'Bail d’habitation',
      'Location courte durée',
      'Copropriété',
      'Achat et vente',
      'Travaux et malfaçons',
      'Urbanisme et autorisations',
      'Voisinage et limites',
      'Fiscalité du bien',
      'Sinistres et assurances',
      'Métier de l’agent immobilier',
    ],
    textes: [
      'la loi du 6 juillet 1989 sur les rapports locatifs',
      'le code civil',
      'le code de la construction et de l’habitation',
      'le code de l’urbanisme',
      'la loi du 10 juillet 1965 sur la copropriété',
      'le code du tourisme',
    ],
    domaines: [
      'bail-habitation',
      'courte-duree',
      'copropriete',
      'achat-vente',
      'travaux',
      'urbanisme',
      'voisinage',
      'fiscalite',
      'sinistres',
      'profession',
    ],
  },
  {
    id: 'foncier',
    label: 'Droit foncier et rural',
    resume: 'La terre plutôt que le bâti : bornage, servitudes, baux ruraux, chemins, boisement.',
    ouverte: false,
    pour: 'Propriétaires de terrains, exploitants agricoles, bailleurs ruraux, communes et lotisseurs.',
    specialites: [
      'Bornage et limites de propriété',
      'Servitudes de passage, de vue, d’écoulement',
      'Bail rural et statut du fermage',
      'Vente de terres et droit de préemption SAFER',
      'Chemins ruraux et voies privées',
      'Boisement, défrichement, haies',
      'Indivision et partage de terres',
    ],
    textes: [
      'le code rural et de la pêche maritime',
      'le code civil, pour la propriété et les servitudes',
      'le code forestier',
      'le code de la voirie routière',
      'le code de l’expropriation',
    ],
    domaines: [],
  },
  {
    id: 'construction',
    label: 'Droit de la construction',
    resume: 'Bâtir : marchés de travaux, maîtrise d’œuvre, réception, garanties, assurances obligatoires.',
    ouverte: false,
    pour: 'Maîtres d’ouvrage, artisans, entreprises du bâtiment, architectes, maîtres d’œuvre.',
    specialites: [
      'Marché de travaux et devis',
      'Contrat de construction de maison individuelle',
      'Maîtrise d’œuvre et architecte',
      'Réception des travaux et réserves',
      'Garantie de parfait achèvement, biennale, décennale',
      'Assurance dommages-ouvrage',
      'Sous-traitance et paiement direct',
      'Abandon de chantier et résiliation',
    ],
    textes: [
      'le code civil, pour le louage d’ouvrage et les garanties',
      'le code de la construction et de l’habitation',
      'la loi du 31 décembre 1975 sur la sous-traitance',
      'le code des assurances',
      'la loi du 3 janvier 1977 sur l’architecture',
    ],
    domaines: [],
  },
  {
    id: 'travail',
    label: 'Droit du travail',
    resume: 'Embauche, contrat, temps de travail, rupture, conseil de prud’hommes.',
    ouverte: false,
    pour: 'Employeurs de petites structures, salariés, et gestionnaires de paie.',
    specialites: [
      'Contrat de travail et période d’essai',
      'Temps de travail, heures supplémentaires, congés',
      'Salaire, primes et bulletin de paie',
      'Licenciement pour motif personnel',
      'Licenciement économique',
      'Rupture conventionnelle et démission',
      'Inaptitude, maladie, accident du travail',
      'Conseil de prud’hommes',
    ],
    textes: [
      'le code du travail',
      'le code de la sécurité sociale, pour l’arrêt et l’accident',
      'les conventions collectives, nommées sans être numérotées',
    ],
    domaines: [],
  },
  {
    id: 'societes',
    label: 'Sociétés et baux commerciaux',
    resume: 'SCI, SARL, bail commercial, fonds de commerce, cession de parts.',
    ouverte: false,
    pour: 'Investisseurs en SCI, commerçants locataires ou bailleurs, gérants de petites sociétés.',
    specialites: [
      'Créer et faire vivre une SCI',
      'Statuts, gérance, assemblées',
      'Bail commercial : durée, loyer, renouvellement',
      'Déplafonnement et révision du loyer commercial',
      'Congé, refus de renouvellement, éviction',
      'Fonds de commerce : vente et location-gérance',
      'Cession de parts et agrément',
    ],
    textes: [
      'le code de commerce',
      'le code civil, pour les sociétés civiles',
      'le code monétaire et financier, pour les indices de révision',
    ],
    domaines: [],
  },
];

export function estBrancheId(value: unknown): value is BrancheId {
  return typeof value === 'string' && BRANCHES.some((branche) => branche.id === value);
}

export function brancheOuNull(id: unknown): Branche | null {
  return BRANCHES.find((branche) => branche.id === id) ?? null;
}

export function branche(id: BrancheId): Branche {
  const trouvee = brancheOuNull(id);
  if (!trouvee) throw new Error(`Branche inconnue : ${id}`);
  return trouvee;
}

/** La branche ouverte par défaut : celle où l'on atterrit en arrivant. */
export const BRANCHE_PAR_DEFAUT: BrancheId = 'immobilier';

/** Les branches où l'on peut réellement poser une question. */
export function branchesOuvertes(): Branche[] {
  return BRANCHES.filter((b) => b.ouverte);
}

/**
 * La branche d'une spécialité.
 *
 * Renvoie null pour une spécialité qui n'appartient à aucune branche ouverte,
 * ce qui ne devrait pas arriver — mais un fil enregistré sous une spécialité
 * retirée du catalogue doit pouvoir rester lisible plutôt que de faire tomber
 * la page qui l'affiche.
 */
export function brancheDuDomaine(domaineId: string): Branche | null {
  return BRANCHES.find((b) => (b.domaines as string[]).includes(domaineId)) ?? null;
}
