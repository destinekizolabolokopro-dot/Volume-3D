/**
 * Ce que la base contient, et rien d'autre.
 *
 * Quatre tables. C'est la mesure de ce service : des comptes, des fils de
 * consultation, les messages de ces fils, et une poignée de réglages. Pas de logements, pas de
 * panoramas, pas de rendez-vous — ce sont d'autres produits, dans d'autres
 * dépôts.
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
  /** 'active' | 'suspended'. */
  statut: string;
  createdAt: string;
  /** Formule — voir `FormuleId` dans lib/abonnements.ts. Vide vaut « Découverte ». */
  abonnement: string;
  /** Date du dernier changement de formule, en ISO. Vide si jamais changée. */
  abonnementDepuis: string;
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
}

export const EMPTY_DB: Database = {
  comptesJuridiques: [],
  reglages: [],
  consultations: [],
  consultationTours: [],
};
