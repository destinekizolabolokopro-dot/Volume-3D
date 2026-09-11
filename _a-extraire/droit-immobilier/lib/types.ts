/**
 * Ce que la base contient, et rien d'autre.
 *
 * Sept tables. C'est la mesure de ce service : des comptes, des fils de
 * consultation, les messages de ces fils, la trace des documents rédigés, les
 * jetons envoyés par courriel, les branches que l'on attend, et une poignée de
 * réglages. Pas de logements, pas de panoramas, pas de
 * rendez-vous — ce sont d'autres produits, dans d'autres dépôts.
 *
 * Ce que ces tables NE contiennent PAS compte autant que le reste : les
 * documents déposés pendant une consultation (bail, compromis, procès-verbal
 * d'assemblée) ne sont jamais écrits. Seul leur nom de fichier subsiste, dans
 * `piece`. Voir l'en-tête de lib/piece.ts pour la raison.
 */

/**
 * Le compte d'un client.
 *
 * Les mots de passe sont dérivés par scrypt avec un sel par compte : la base
 * ne contient jamais de mot de passe en clair, et deux clients ayant choisi le
 * même mot de passe ont des empreintes différentes.
 */
export interface CompteJuridique {
  id: string;
  email: string;
  /** Empreinte scrypt du mot de passe, au format « sel:empreinte ». */
  passwordHash: string;
  nom: string;
  /**
   * 'active' | 'suspended'. Seul 'active' ouvre l'accès : la comparaison se
   * fait par le positif, pour qu'un statut ajouté plus tard ferme par défaut
   * au lieu d'ouvrir par oubli.
   */
  statut: string;
  createdAt: string;
  /** Formule — voir `FormuleId` dans lib/abonnements.ts. Vide vaut « Découverte ». */
  abonnement: string;
  /** Date du dernier changement de formule, en ISO. Vide si jamais changée. */
  abonnementDepuis: string;
  /**
   * Date de confirmation de l'adresse, en ISO. Vide tant qu'elle ne l'est pas.
   *
   * Une adresse non confirmée n'empêche PAS d'entrer : l'espace gratuit
   * s'ouvre tout de suite, parce qu'on perd la moitié des gens entre un
   * formulaire et leur boîte mail. Elle est exigée au moment de prendre une
   * formule payante — c'est là qu'une adresse fausse devient un problème, pour
   * la facture comme pour la reprise en main du compte.
   */
  emailVerifieA: string;
  /**
   * Le profil déclaré à l'ouverture — voir lib/profils.ts.
   *
   * Il sert au spécialiste, qui doit savoir de quel côté du bail se tient
   * celui qui lui écrit. Les trois champs sont facultatifs : un profil faux
   * est pire qu'un profil vide.
   */
  metier: string;
  volume: string;
  usage: string;
}

/**
 * Un fil de consultation, rattaché à un compte et à une spécialité.
 *
 * Rien n'est conservé pour un visiteur non connecté : `compteId` n'est jamais
 * vide. Un fil anonyme n'existe que dans l'onglet ouvert, et la page le dit —
 * c'est préférable à un identifiant déposé dans un cookie pour rattacher après
 * coup des questions sur une expulsion ou un impayé.
 */
export interface Consultation {
  id: string;
  compteId: string;
  /** Identifiant de spécialité — voir `DomaineId` dans lib/domaines.ts. */
  domaine: string;
  /** La première question, telle qu'elle a été posée. Sert de titre. */
  titre: string;
  createdAt: string;
  updatedAt: string;
}

/** Un message du fil. `piece` ne porte que le NOM du document déposé. */
export interface ConsultationTour {
  id: string;
  consultationId: string;
  /** 'user' | 'assistant' */
  role: string;
  content: string;
  piece: string;
  createdAt: string;
}

/**
 * Quelqu'un qui demande à être prévenu de l'ouverture d'une branche.
 *
 * Trois champs, et c'est déjà beaucoup : qui, quelle branche, quand. Cette
 * table n'est pas une liste de diffusion — on n'y écrira qu'une fois, le jour
 * où la branche ouvre, et le courriel le dit à l'inscription.
 *
 * Elle sert surtout à décider quoi construire ensuite. Ouvrir une branche
 * coûte des jours de travail sur le fonds officiel ; choisir laquelle d'après
 * ceux qui l'attendent vaut mieux que de le choisir d'après une intuition.
 */
export interface Attente {
  id: string;
  compteId: string;
  /** Identifiant de branche — voir `BrancheId` dans lib/branches.ts. */
  branche: string;
  createdAt: string;
}

/**
 * Un jeton à usage unique envoyé par courriel.
 *
 * Deux usages : confirmer une adresse, et reprendre la main sur un compte
 * dont on a oublié le mot de passe.
 *
 * `empreinte` n'est PAS le jeton : c'est son SHA-256. Le jeton lui-même
 * n'existe que dans le lien envoyé, et nulle part ailleurs. La différence
 * décide de ce qu'une fuite de base permet — avec les jetons en clair, un
 * vidage de table donne l'accès à tous les comptes qui ont une
 * réinitialisation en cours ; avec des empreintes, il ne donne rien.
 *
 * `utiliseA` marque l'emploi plutôt que d'effacer la ligne : un lien cliqué
 * deux fois — un antivirus qui préouvre, un client mail qui vérifie — doit
 * pouvoir dire « ce lien a déjà servi » et non « ce lien n'existe pas ».
 */
export interface JetonCompte {
  id: string;
  compteId: string;
  /** 'verification' | 'mot-de-passe'. */
  usage: string;
  /** SHA-256 du jeton, en hexadécimal. Jamais le jeton. */
  empreinte: string;
  /** Date d'expiration, en ISO. */
  expireA: string;
  /** Date d'emploi, en ISO. Vide tant qu'il n'a pas servi. */
  utiliseA: string;
  createdAt: string;
}

/**
 * La trace d'un document rédigé.
 *
 * Trois champs, et pas un de plus : qui, quel modèle, quand. Le courrier
 * lui-même n'est jamais écrit — une mise en demeure pour loyers impayés nomme
 * des gens et raconte une histoire, il n'y a aucune raison d'en garder copie.
 *
 * Cette ligne existe pour une seule raison : le quota. L'écran annonce qu'un
 * document compte pour une question ; sans elle, la phrase était fausse et
 * la rédaction — l'appel le plus coûteux du service — restait gratuite à
 * l'infini.
 */
export interface DocumentRedige {
  id: string;
  compteId: string;
  /** Identifiant du modèle — voir `ModeleId` dans lib/documents.ts. */
  modele: string;
  createdAt: string;
}

/**
 * Un réglage, posé depuis l'espace du propriétaire.
 *
 * Une seule ligne existe aujourd'hui : `cle-modele`, la clé d'API. Sa
 * `valeur` est CHIFFRÉE — voir lib/coffre.ts —, jamais lisible telle quelle
 * dans un vidage de table.
 *
 * Une table plutôt qu'un champ sur un compte : ce réglage n'appartient à
 * personne, il appartient au site. Et le jour où un second réglage arrive, il
 * s'ajoute sans migration.
 */
export interface Reglage {
  /** L'identifiant du réglage, par exemple « cle-modele ». */
  id: string;
  /** La valeur scellée. Jamais en clair, jamais renvoyée au navigateur. */
  valeur: string;
  /** Quand elle a été posée, en ISO. S'affiche : un secret a un âge. */
  majAt: string;
}

export interface Database {
  comptesJuridiques: CompteJuridique[];
  reglages: Reglage[];
  consultations: Consultation[];
  consultationTours: ConsultationTour[];
  documentsRediges: DocumentRedige[];
  jetonsCompte: JetonCompte[];
  attentes: Attente[];
}

export const EMPTY_DB: Database = {
  comptesJuridiques: [],
  reglages: [],
  consultations: [],
  consultationTours: [],
  documentsRediges: [],
  jetonsCompte: [],
  attentes: [],
};
