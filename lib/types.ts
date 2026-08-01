/**
 * Modèle de données Volume3D.
 *
 * Règle structurante : une visite réelle (`Property`) et un aperçu de démarchage
 * (`Preview`) sont deux entités totalement séparées, avec deux URLs publiques
 * distinctes (`/v/:slug` et `/demo/:token`). Un aperçu généré par IA ne peut
 * donc jamais devenir, par erreur de manipulation, la visite livrée au client.
 */

/** Comment la visite d'un logement est rendue côté visiteur. */
export type TourMode =
  /** Panoramas 360° équirectangulaires hébergés par nous (cas nominal). */
  | 'pano'
  /** Modèle 3D .glb issu de Polycam / Luma. */
  | 'model'
  /** Vidéo de déambulation filmée sur place : le visiteur regarde, il ne navigue pas. */
  | 'video'
  /** Viewer externe (Matterport, Cupix) affiché en iframe. */
  | 'embed';

export type PropertyStatus = 'draft' | 'published';

/** Formule d'abonnement du client. */
export type Plan = 'essentiel' | 'pro' | 'conciergerie';

/**
 * Compte d'un client propriétaire ou conciergerie.
 *
 * Le service est vendu par abonnement : chaque client dispose de son propre
 * espace, y crée ses biens et n'accède jamais à ceux des autres. Le compte
 * administrateur, lui, voit l'ensemble.
 */
export interface Account {
  id: string;
  email: string;
  /** Empreinte scrypt du mot de passe, au format « sel:empreinte ». */
  passwordHash: string;
  name: string;
  company: string;
  phone: string;
  plan: Plan;
  /** 'active' | 'suspended' — un compte suspendu ne peut plus publier. */
  status: string;
  createdAt: string;
}

export interface Property {
  id: string;
  /** Compte propriétaire. Vide pour les biens créés par l'administrateur. */
  accountId: string;
  /** Identifiant de l'URL publique : /v/{slug} */
  slug: string;
  name: string;
  city: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  /** Présentation publique du bien, affichée sous la visite et lue par l'assistant. */
  description: string;
  /** Notes internes de démarchage, jamais affichées publiquement. */
  notes: string;
  /** L'assistant répond aux questions des voyageurs sur cette visite. */
  chatEnabled: boolean;
  mode: TourMode;
  /** Renseigné si mode === 'embed'. */
  embedUrl: string;
  /** Renseigné si mode === 'model'. */
  modelUrl: string;
  /** Renseigné si mode === 'video'. */
  videoUrl: string;
  status: PropertyStatus;
  createdAt: string;
  publishedAt: string | null;
  views: number;
}

/** Une pièce du logement = un panorama 360°. */
export interface Scene {
  id: string;
  propertyId: string;
  name: string;
  imageUrl: string;
  /** Ordre d'affichage dans le sélecteur de pièces. */
  position: number;
  /** Orientation de départ, en degrés. */
  initialYaw: number;
  initialPitch: number;
}

/** Point de passage cliquable d'une pièce vers une autre. */
export interface Hotspot {
  id: string;
  sceneId: string;
  targetSceneId: string;
  label: string;
  /** Position sur la sphère, en degrés. yaw = horizontal, pitch = vertical. */
  yaw: number;
  pitch: number;
}

/** Photo de présentation du bien — distincte des panoramas 360°. */
export interface Photo {
  id: string;
  propertyId: string;
  url: string;
  caption: string;
  position: number;
}

/**
 * Repère temporel dans la vidéo de déambulation.
 *
 * C'est ce qui rend la vidéo navigable : le visiteur saute directement à la
 * chambre au lieu de faire défiler à l'aveugle.
 */
export interface Chapter {
  id: string;
  propertyId: string;
  label: string;
  /** Position en secondes depuis le début de la vidéo. */
  seconds: number;
}

/** Question posée à l'assistant sur une visite, conservée pour le suivi. */
export interface ChatMessage {
  id: string;
  propertyId: string;
  question: string;
  answer: string;
  createdAt: string;
}

export type PreviewStatus = 'pending' | 'ready' | 'failed';

/**
 * Aperçu de démarchage. Construit à partir des photos publiques de l'annonce
 * du prospect, avec extension IA des zones manquantes.
 *
 * NON CONTRACTUEL : ces images sont partiellement inventées. Elles servent
 * uniquement à montrer au propriétaire, en privé, à quoi ressemblerait une
 * visite de son logement. Elles ne doivent jamais être présentées à un
 * voyageur ni publiées sur une annonce — d'où le filigrane incrusté, l'absence
 * d'indexation et l'expiration automatique.
 */
export interface Preview {
  id: string;
  /** Jeton d'URL non devinable : /demo/{token} */
  token: string;
  propertyName: string;
  city: string;
  /** Lien de l'annonce d'origine, pour retrouver le prospect. */
  listingUrl: string;
  ownerEmail: string;
  status: PreviewStatus;
  /** Message d'erreur si status === 'failed'. */
  error: string;
  createdAt: string;
  /** Au-delà de cette date, /demo/{token} renvoie une 404. */
  expiresAt: string;
  views: number;
}

/** Une photo source de l'annonce + son extension IA. */
export interface PreviewShot {
  id: string;
  previewId: string;
  label: string;
  position: number;
  /** Photo d'origine du propriétaire, telle qu'uploadée. */
  sourceUrl: string;
  /** Version étendue par IA. Vide tant que la génération n'a pas abouti. */
  generatedUrl: string;
}

/** Demande entrante depuis le formulaire de la landing. */
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  /** 'proprietaire' | 'conciergerie' */
  profile: string;
  message: string;
  createdAt: string;
  handled: boolean;
}

export interface Database {
  accounts: Account[];
  properties: Property[];
  scenes: Scene[];
  hotspots: Hotspot[];
  photos: Photo[];
  chapters: Chapter[];
  chatMessages: ChatMessage[];
  previews: Preview[];
  previewShots: PreviewShot[];
  leads: Lead[];
}

export const EMPTY_DB: Database = {
  accounts: [],
  properties: [],
  scenes: [],
  hotspots: [],
  photos: [],
  chapters: [],
  chatMessages: [],
  previews: [],
  previewShots: [],
  leads: [],
};
