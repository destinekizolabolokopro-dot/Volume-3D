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

export interface Property {
  id: string;
  /** Identifiant de l'URL publique : /v/{slug} */
  slug: string;
  name: string;
  city: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  /** Notes internes de démarchage, jamais affichées publiquement. */
  notes: string;
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
  properties: Property[];
  scenes: Scene[];
  hotspots: Hotspot[];
  previews: Preview[];
  previewShots: PreviewShot[];
  leads: Lead[];
}

export const EMPTY_DB: Database = {
  properties: [],
  scenes: [],
  hotspots: [],
  previews: [],
  previewShots: [],
  leads: [],
};
