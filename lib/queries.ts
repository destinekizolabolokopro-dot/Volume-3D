import 'server-only';
import { reviewIntake } from './intake';
import { reviewJourney, type Journey } from './journey';
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

/**
 * L'avancement du dossier de plusieurs logements, en quatre requêtes.
 *
 * Une liste de biens veut afficher, pour chacun, où en est son dossier. Le
 * calculer bien par bien demanderait quatre requêtes **par ligne** — la panne
 * classique, celle qui ne se voit pas sur deux logements et met la page à
 * genoux sur cinquante. On charge donc tout d'un coup et on regroupe en
 * mémoire : le coût ne dépend plus du nombre de biens.
 */
export async function reviewMany(properties: Property[]): Promise<Map<string, Journey>> {
  const result = new Map<string, Journey>();
  if (properties.length === 0) return result;

  const store = getStore();
  const [scenes, photos, plans, doors] = await Promise.all([
    store.list('scenes'),
    store.list('photos'),
    store.list('plans'),
    store.list('planDoors'),
  ]);

  const group = <T,>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const bucket = map.get(key(row));
      if (bucket) bucket.push(row);
      else map.set(key(row), [row]);
    }
    return map;
  };

  const scenesBy = group(scenes, (scene) => scene.propertyId);
  const photosBy = group(photos, (photo) => photo.propertyId);
  const plansBy = group(plans, (plan) => plan.propertyId);
  const doorsBy = group(doors, (door) => door.planId);

  for (const property of properties) {
    const plan = plansBy.get(property.id)?.[0] ?? null;
    const propertyPhotos = photosBy.get(property.id) ?? [];
    const intake = reviewIntake(plan, plan ? (doorsBy.get(plan.id) ?? []) : [], propertyPhotos);
    result.set(
      property.id,
      reviewJourney({
        property,
        sceneCount: scenesBy.get(property.id)?.length ?? 0,
        photoCount: propertyPhotos.length,
        plan,
        intake,
        facts: property.facts ?? [],
      }),
    );
  }
  return result;
}
