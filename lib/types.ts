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
  | 'embed'
  /** Volume reconstruit depuis un plan, avec les photos posées sur les murs. */
  | 'plan';

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
  /** Pièce du plan où la photo a été prise. Vide si non rattachée. */
  roomId: string;
  /** Mur de cette pièce sur lequel l'accrocher, dans l'ordre du polygone. */
  wallIndex: number;
}

/* ==========================================================================
   Visite reconstruite depuis un plan

   Le plan apporte la géométrie — des dimensions mesurées, pas devinées — et
   les photos apportent l'apparence. Les deux ensemble donnent un volume
   parcourable et honnête : rien n'y est inventé. C'est la seule façon de
   produire une visite sans passer par une capture 360° sur place.
   ========================================================================== */

/** Point du plan, en mètres. x vers la droite, y vers le bas, comme sur l'image. */
export interface PlanPoint {
  x: number;
  y: number;
}

export interface PlanRoom {
  /** Identifiant lisible : « salon », « chambre-1 ». */
  id: string;
  name: string;
  /** Polygone fermé de la pièce, en mètres, sens indifférent. */
  points: PlanPoint[];
  /** Hauteur sous plafond, en mètres. */
  height: number;
}

export type PlanOpeningKind = 'door' | 'opening' | 'window';

/**
 * Ouverture dans un mur.
 *
 * `to` vaut la chaîne vide quand l'ouverture donne sur l'extérieur ou sur le
 * palier : une fenêtre ne mène nulle part, une porte palière non plus.
 */
export interface PlanDoor {
  id: string;
  planId: string;
  from: string;
  to: string;
  a: PlanPoint;
  b: PlanPoint;
  kind: PlanOpeningKind;
  /** Hauteur du linteau au-dessus du sol, en mètres. */
  height: number;
  /** Hauteur d'allège : 0 pour une porte, ~0,9 m pour une fenêtre. */
  sill: number;
}

export interface FloorPlan {
  id: string;
  propertyId: string;
  /** Image du plan telle qu'envoyée, conservée pour vérification. */
  imageUrl: string;
  rooms: PlanRoom[];
  /** Surface totale annoncée par le propriétaire, en m². Sert au recalage. */
  declaredArea: number;
  /** Modèle qui a lu le plan, et quand. La géométrie doit rester traçable. */
  readBy: string;
  readAt: string;
  /** Le propriétaire a relu et corrigé la lecture automatique. */
  confirmed: boolean;
  createdAt: string;
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
  plans: FloorPlan[];
  planDoors: PlanDoor[];
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
  plans: [],
  planDoors: [],
  chapters: [],
  chatMessages: [],
  previews: [],
  previewShots: [],
  leads: [],
};
