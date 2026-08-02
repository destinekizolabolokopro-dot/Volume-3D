import 'server-only';
import { getStore } from './store';
import type { FloorPlan, Hotspot, PlanDoor, Preview, PreviewShot, Property, Scene, TourMode } from './types';

/** Visite publiée uniquement : un brouillon ne doit jamais être visible. */
export async function findPublishedProperty(slug: string): Promise<Property | null> {
  const [property] = await getStore().list('properties', { slug, status: 'published' });
  return property ?? null;
}

export async function findPropertyBySlug(slug: string): Promise<Property | null> {
  const [property] = await getStore().list('properties', { slug });
  return property ?? null;
}

/**
 * Plan confirmé d'un logement, et ses ouvertures.
 *
 * Un plan non confirmé n'est jamais servi au voyageur : la lecture automatique
 * peut se tromper, et une visite aux dimensions fausses vaut moins que pas de
 * visite du tout.
 */
export async function loadPlan(propertyId: string): Promise<{ plan: FloorPlan | null; doors: PlanDoor[] }> {
  const store = getStore();
  const [plan] = await store.list('plans', { propertyId, confirmed: true });
  if (!plan) return { plan: null, doors: [] };
  const doors = await store.list('planDoors', { planId: plan.id });
  return { plan, doors };
}

export async function loadTour(
  propertyId: string,
): Promise<{ scenes: Scene[]; hotspots: Hotspot[] }> {
  const store = getStore();
  const scenes = (await store.list('scenes', { propertyId })).sort((a, b) => a.position - b.position);
  const ids = new Set(scenes.map((scene) => scene.id));
  const all = await store.list('hotspots');
  // On écarte les points de passage dont la pièce de destination a été supprimée.
  const hotspots = all.filter((hotspot) => ids.has(hotspot.sceneId) && ids.has(hotspot.targetSceneId));
  return { scenes, hotspots };
}

/**
 * Formats effectivement proposables pour une visite, dans l'ordre d'affichage.
 *
 * Un logement n'est pas cantonné à un seul format : panoramas et vidéo de
 * déambulation cohabitent volontiers, et le voyageur choisit. Le champ `mode`
 * de la fiche ne décide plus que du format ouvert par défaut.
 */
export function availableFormats(property: Property, sceneCount: number, hasPlan = false): TourMode[] {
  const formats: TourMode[] = [];
  if (sceneCount > 0) formats.push('pano');
  if (hasPlan) formats.push('plan');
  if (property.videoUrl) formats.push('video');
  if (property.modelUrl) formats.push('model');
  if (property.embedUrl) formats.push('embed');
  // Le format par défaut passe en tête.
  return formats.sort((a, b) => Number(b === property.mode) - Number(a === property.mode));
}

export async function findPreview(token: string): Promise<Preview | null> {
  const [preview] = await getStore().list('previews', { token });
  return preview ?? null;
}

export function previewExpired(preview: Preview, now = Date.now()): boolean {
  const expiry = Date.parse(preview.expiresAt);
  return Number.isFinite(expiry) && expiry < now;
}

export async function loadPreviewShots(previewId: string): Promise<PreviewShot[]> {
  const shots = await getStore().list('previewShots', { previewId });
  return shots.sort((a, b) => a.position - b.position);
}

/** Incrémente un compteur de vues sans jamais faire échouer l'affichage de la page. */
export async function bumpViews(table: 'properties' | 'previews', id: string, current: number): Promise<void> {
  try {
    await getStore().update(table, id, { views: current + 1 } as never);
  } catch (error) {
    console.error('[views] incrément impossible', error);
  }
}
