import 'server-only';
import { getStore } from './store';
import type { Hotspot, Preview, PreviewShot, Property, Scene } from './types';

/** Visite publiée uniquement : un brouillon ne doit jamais être visible. */
export async function findPublishedProperty(slug: string): Promise<Property | null> {
  const [property] = await getStore().list('properties', { slug, status: 'published' });
  return property ?? null;
}

export async function findPropertyBySlug(slug: string): Promise<Property | null> {
  const [property] = await getStore().list('properties', { slug });
  return property ?? null;
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
