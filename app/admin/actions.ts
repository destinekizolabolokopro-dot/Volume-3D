'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { expandPhoto, isAiConfigured } from '@/lib/ai-preview';
import { SESSION_COOKIE, checkPassword, isAuthenticated, issueToken, sessionCookieOptions } from '@/lib/auth';
import { randomId, uniqueSlug } from '@/lib/ids';
import { assertImage, assertModel, assertVideo, putFile, putImage } from '@/lib/storage';
import { getStore } from '@/lib/store';
import type { Hotspot, Preview, PreviewShot, Property, Scene, TourMode } from '@/lib/types';
import { ValidationError, email, httpUrl, number, oneOf, text } from '@/lib/validation';

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Renseigné par les actions qui créent une ressource. */
  id?: string;
}

/** Les aperçus de démarchage expirent d'eux-mêmes : un document commercial n'a pas à survivre. */
const PREVIEW_LIFETIME_DAYS = 30;

async function guard(): Promise<void> {
  if (!(await isAuthenticated())) throw new ValidationError('Session expirée. Reconnectez-vous.');
}

/** Enveloppe commune : traduit les exceptions en message affichable. */
async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    // `redirect()` lève une exception de contrôle qu'il ne faut surtout pas avaler.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('[admin] action en échec', error);
    return { ok: false, error: 'Opération impossible. Consultez les journaux du serveur.' };
  }
}

/* ============================================================ session === */

export async function login(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const password = String(formData.get('password') ?? '');
    if (!password) throw new ValidationError('Saisissez votre mot de passe.');
    if (!checkPassword(password)) throw new ValidationError('Mot de passe incorrect.');
    const store = await cookies();
    store.set(SESSION_COOKIE, issueToken(), sessionCookieOptions);
    redirect('/admin');
  });
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/admin/login');
}

/* ========================================================== logements === */

export async function createProperty(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const name = text(formData.get('name'), 'nom du logement', { max: 140 });
    const existing = await store.list('properties');

    const property: Property = {
      id: randomId(),
      slug: uniqueSlug(name, existing.map((entry) => entry.slug)),
      name,
      city: text(formData.get('city'), 'ville', { max: 120, required: false }),
      ownerName: text(formData.get('ownerName'), 'propriétaire', { max: 140, required: false }),
      ownerEmail: text(formData.get('ownerEmail'), 'email', { max: 200, required: false }),
      ownerPhone: text(formData.get('ownerPhone'), 'téléphone', { max: 40, required: false }),
      notes: '',
      mode: 'pano',
      embedUrl: '',
      modelUrl: '',
      videoUrl: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      publishedAt: null,
      views: 0,
    };

    await store.insert('properties', property);
    revalidatePath('/admin');
    return { ok: true, id: property.id };
  });
}

export async function updateProperty(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const id = text(formData.get('id'), 'identifiant', { max: 40 });
    const property = await store.get('properties', id);
    if (!property) throw new ValidationError('Ce logement n’existe plus.');

    const mode = oneOf<TourMode>(formData.get('mode') ?? property.mode, ['pano', 'model', 'video', 'embed'], 'mode');
    const embedUrl = httpUrl(formData.get('embedUrl'), 'lien du viewer externe', { required: false });
    if (mode === 'embed' && !embedUrl) {
      throw new ValidationError('Le mode « viewer externe » demande un lien Matterport ou Cupix.');
    }

    await store.update('properties', id, {
      name: text(formData.get('name'), 'nom du logement', { max: 140 }),
      city: text(formData.get('city'), 'ville', { max: 120, required: false }),
      ownerName: text(formData.get('ownerName'), 'propriétaire', { max: 140, required: false }),
      ownerEmail: text(formData.get('ownerEmail'), 'email', { max: 200, required: false }),
      ownerPhone: text(formData.get('ownerPhone'), 'téléphone', { max: 40, required: false }),
      notes: text(formData.get('notes'), 'notes', { max: 4000, required: false }),
      mode,
      embedUrl,
    });

    revalidatePath(`/admin/logements/${id}`);
    revalidatePath('/admin');
    return { ok: true };
  });
}

export async function setPropertyStatus(id: string, status: 'draft' | 'published'): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const property = await store.get('properties', id);
    if (!property) throw new ValidationError('Ce logement n’existe plus.');

    if (status === 'published') {
      // Publier une visite vide enverrait un lien mort au propriétaire.
      const scenes = await store.list('scenes', { propertyId: id });
      const ready =
        (property.mode === 'pano' && scenes.length > 0) ||
        (property.mode === 'embed' && property.embedUrl !== '') ||
        (property.mode === 'model' && property.modelUrl !== '') ||
        (property.mode === 'video' && property.videoUrl !== '');
      if (!ready) {
        throw new ValidationError(
          'Rien à publier pour l’instant : ajoutez au moins une pièce, une vidéo, un modèle 3D ou un lien de viewer externe.',
        );
      }
    }

    await store.update('properties', id, {
      status,
      publishedAt: status === 'published' ? (property.publishedAt ?? new Date().toISOString()) : property.publishedAt,
    });

    revalidatePath(`/admin/logements/${id}`);
    revalidatePath('/admin');
    revalidatePath(`/v/${property.slug}`);
    return { ok: true };
  });
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const scenes = await store.list('scenes', { propertyId: id });
    for (const scene of scenes) {
      await store.remove('hotspots', { sceneId: scene.id });
      await store.remove('hotspots', { targetSceneId: scene.id });
    }
    await store.remove('scenes', { propertyId: id });
    await store.remove('properties', { id });
    revalidatePath('/admin');
    redirect('/admin');
  });
}

/* ============================================================= pièces === */

/** « salon-01.jpg » → « Salon 01 ». Un nom faux se corrige plus vite qu'il ne se saisit. */
function nameFromFile(filename: string, index: number): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  if (!base || /^(img|dsc|pano|photo|image)\s*\d*$/i.test(base)) return `Pièce ${index}`;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function addScene(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    const property = await store.get('properties', propertyId);
    if (!property) throw new ValidationError('Ce logement n’existe plus.');

    const files = formData.getAll('image').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) throw new ValidationError('Choisissez au moins une image panoramique.');
    if (files.length > 20) throw new ValidationError('Vingt panoramas maximum en une fois.');
    files.forEach(assertImage);

    const existing = await store.list('scenes', { propertyId });
    const given = text(formData.get('name'), 'nom de la pièce', { max: 60, required: false });
    let last = '';

    // Envoi multiple : chaque fichier devient une pièce, nommée d'après le
    // fichier — « salon.jpg » donne « Salon ». Renommable ensuite en un clic.
    for (const [index, file] of files.entries()) {
      const { url } = await putImage('panos', file, file.name);
      const fallback = files.length === 1 && given ? given : nameFromFile(file.name, existing.length + index + 1);
      const scene: Scene = {
        id: randomId(),
        propertyId,
        name: fallback,
        imageUrl: url,
        position: existing.length + index,
        initialYaw: 0,
        initialPitch: 0,
      };
      await store.insert('scenes', scene);
      last = scene.id;
    }

    revalidatePath(`/admin/logements/${propertyId}`);
    return { ok: true, id: last };
  });
}

export async function updateScene(
  id: string,
  patch: { name?: string; initialYaw?: number; initialPitch?: number; position?: number },
): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const scene = await store.get('scenes', id);
    if (!scene) throw new ValidationError('Cette pièce n’existe plus.');

    const next: Partial<Scene> = {};
    if (patch.name !== undefined) next.name = text(patch.name, 'nom de la pièce', { max: 60 });
    if (patch.initialYaw !== undefined) next.initialYaw = number(patch.initialYaw, 'orientation', { min: -180, max: 180 });
    if (patch.initialPitch !== undefined) next.initialPitch = number(patch.initialPitch, 'inclinaison', { min: -89, max: 89 });
    if (patch.position !== undefined) next.position = number(patch.position, 'ordre', { min: 0, max: 999 });

    await store.update('scenes', id, next);
    revalidatePath(`/admin/logements/${scene.propertyId}`);
    return { ok: true };
  });
}

/** Échange une pièce avec sa voisine, pour réordonner le sélecteur de pièces. */
export async function moveScene(id: string, direction: -1 | 1): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const scene = await store.get('scenes', id);
    if (!scene) throw new ValidationError('Cette pièce n’existe plus.');

    const siblings = (await store.list('scenes', { propertyId: scene.propertyId })).sort(
      (a, b) => a.position - b.position,
    );
    const index = siblings.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return { ok: true };

    await store.update('scenes', siblings[index].id, { position: target });
    await store.update('scenes', siblings[target].id, { position: index });
    revalidatePath(`/admin/logements/${scene.propertyId}`);
    return { ok: true };
  });
}

export async function deleteScene(id: string): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const scene = await store.get('scenes', id);
    if (!scene) return { ok: true };

    // Les points de passage qui pointaient vers cette pièce n'ont plus de sens.
    await store.remove('hotspots', { sceneId: id });
    await store.remove('hotspots', { targetSceneId: id });
    await store.remove('scenes', { id });

    // Renumérote pour garder un ordre continu.
    const remaining = (await store.list('scenes', { propertyId: scene.propertyId })).sort(
      (a, b) => a.position - b.position,
    );
    for (const [index, entry] of remaining.entries()) {
      if (entry.position !== index) await store.update('scenes', entry.id, { position: index });
    }

    revalidatePath(`/admin/logements/${scene.propertyId}`);
    return { ok: true };
  });
}

/* ================================================== points de passage === */

export async function addHotspot(input: {
  sceneId: string;
  targetSceneId: string;
  yaw: number;
  pitch: number;
  label?: string;
}): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const scene = await store.get('scenes', input.sceneId);
    const target = await store.get('scenes', input.targetSceneId);
    if (!scene || !target) throw new ValidationError('Pièce de départ ou d’arrivée introuvable.');
    if (scene.id === target.id) throw new ValidationError('Un passage doit mener vers une autre pièce.');

    const hotspot: Hotspot = {
      id: randomId(),
      sceneId: scene.id,
      targetSceneId: target.id,
      label: text(input.label ?? target.name, 'libellé', { max: 40 }),
      yaw: number(input.yaw, 'orientation', { min: -180, max: 180 }),
      pitch: number(input.pitch, 'inclinaison', { min: -89, max: 89 }),
    };

    await store.insert('hotspots', hotspot);
    revalidatePath(`/admin/logements/${scene.propertyId}`);
    return { ok: true, id: hotspot.id };
  });
}

export async function deleteHotspot(id: string): Promise<ActionResult> {
  return run(async () => {
    await guard();
    await getStore().remove('hotspots', { id });
    return { ok: true };
  });
}

/* ================================================ modèle 3D importé === */

export async function uploadModel(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    const file = formData.get('model');
    if (!(file instanceof File) || file.size === 0) throw new ValidationError('Choisissez un fichier .glb.');
    assertModel(file);

    const { url } = await putFile('models', file, file.name);
    await store.update('properties', propertyId, { modelUrl: url, mode: 'model' });
    revalidatePath(`/admin/logements/${propertyId}`);
    return { ok: true };
  });
}

export async function uploadVideo(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    const file = formData.get('video');
    if (!(file instanceof File) || file.size === 0) throw new ValidationError('Choisissez une vidéo.');
    assertVideo(file);

    const { url } = await putFile('videos', file, file.name);
    // La vidéo s'ajoute aux panoramas, elle ne les remplace pas : le format
    // ouvert par défaut ne bascule que si la visite n'a rien d'autre à montrer.
    const scenes = await store.list('scenes', { propertyId });
    const patch = scenes.length > 0 ? { videoUrl: url } : { videoUrl: url, mode: 'video' as const };
    await store.update('properties', propertyId, patch);
    revalidatePath(`/admin/logements/${propertyId}`);
    return { ok: true };
  });
}

/* ====================================== aperçus de démarchage (IA) === */

/**
 * Crée un aperçu simulé à partir des photos d'une annonce existante.
 *
 * Contrainte volontaire : cette fonction écrit dans `previews`, jamais dans
 * `properties`. Un aperçu ne peut donc pas être transformé en visite livrée —
 * il faudra un vrai scan sur place, saisi séparément.
 */
export async function createPreview(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();

    const files = formData.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) throw new ValidationError('Ajoutez au moins une photo de l’annonce.');
    if (files.length > 8) throw new ValidationError('Huit photos maximum par aperçu.');
    files.forEach(assertImage);

    const now = new Date();
    const expires = new Date(now.getTime() + PREVIEW_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

    const preview: Preview = {
      id: randomId(),
      token: randomId(22),
      propertyName: text(formData.get('propertyName'), 'nom du logement', { max: 140 }),
      city: text(formData.get('city'), 'ville', { max: 120, required: false }),
      listingUrl: httpUrl(formData.get('listingUrl'), 'lien de l’annonce', { required: false }),
      ownerEmail: formData.get('ownerEmail') ? email(formData.get('ownerEmail')) : '',
      status: 'pending',
      error: '',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      views: 0,
    };
    await store.insert('previews', preview);

    let generatedCount = 0;
    for (const [index, file] of files.entries()) {
      const { url: sourceUrl } = await putImage('previews', file, file.name);

      let generatedUrl = '';
      if (isAiConfigured()) {
        const expanded = await expandPhoto({
          buffer: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type,
        });
        if (expanded) {
          const extension = expanded.mimeType.includes('jpeg') ? '.jpg' : '.png';
          const blob = new Blob([new Uint8Array(expanded.buffer)], { type: expanded.mimeType });
          const stored = await putImage('previews', blob, `extension${extension}`);
          generatedUrl = stored.url;
          generatedCount += 1;
        }
      }

      const shot: PreviewShot = {
        id: randomId(),
        previewId: preview.id,
        label: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || `Vue ${index + 1}`,
        position: index,
        sourceUrl,
        generatedUrl,
      };
      await store.insert('previewShots', shot);
    }

    // Sans clé d'API, l'aperçu reste utilisable : il montre les photos d'origine
    // dans l'habillage Volume3D, sans rien inventer.
    await store.update('previews', preview.id, {
      status: 'ready',
      error:
        generatedCount === 0 && isAiConfigured()
          ? 'La génération IA a échoué : l’aperçu affiche les photos d’origine.'
          : '',
    });

    revalidatePath('/admin');
    return { ok: true, id: preview.id };
  });
}

export async function deletePreview(id: string): Promise<ActionResult> {
  return run(async () => {
    await guard();
    const store = getStore();
    await store.remove('previewShots', { previewId: id });
    await store.remove('previews', { id });
    revalidatePath('/admin');
    return { ok: true };
  });
}

/* ============================================================ contacts === */

export async function toggleLead(id: string, handled: boolean): Promise<ActionResult> {
  return run(async () => {
    await guard();
    await getStore().update('leads', id, { handled });
    revalidatePath('/admin');
    return { ok: true };
  });
}

export async function deleteLead(id: string): Promise<ActionResult> {
  return run(async () => {
    await guard();
    await getStore().remove('leads', { id });
    revalidatePath('/admin');
    return { ok: true };
  });
}
