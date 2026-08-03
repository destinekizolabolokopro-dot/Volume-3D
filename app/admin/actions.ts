'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { expandPhoto, isAiConfigured } from '@/lib/ai-preview';
import { currentAccount } from '@/lib/accounts';
import { SESSION_COOKIE, checkPassword, isAuthenticated, issueToken, sessionCookieOptions } from '@/lib/auth';
import { randomId, uniqueSlug } from '@/lib/ids';
import { assertImage, assertModel, assertVideo, putFile, putImage, readImageAsBase64 } from '@/lib/storage';
import { assignPhotos, isPlanReaderConfigured, readPlan } from '@/lib/plan-reader';
import { isFactsReaderConfigured, readFactsFromPhotos } from '@/lib/facts-reader';
import { FACT_QUESTIONS, factsForDescription, mergeFacts } from '@/lib/facts';
import { TimecodeError, parseTimecode } from '@/lib/timecode';
import { getStore } from '@/lib/store';
import type { Chapter, Hotspot, Photo, Preview, PreviewShot, Property, PropertyFact, Scene, TourMode } from '@/lib/types';
import { ValidationError, email, httpUrl, number, oneOf, text } from '@/lib/validation';

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Renseigné par les actions qui créent une ressource. */
  id?: string;
}

/** Les aperçus de démarchage expirent d'eux-mêmes : un document commercial n'a pas à survivre. */
const PREVIEW_LIFETIME_DAYS = 30;

/**
 * Qui agit : l'administrateur du service, ou un client depuis son espace.
 *
 * Les deux passent par les mêmes actions — c'est le même éditeur de visite —
 * mais un client ne peut toucher qu'à ses propres biens. Toute action portant
 * sur un bien existant passe donc par `authorizeProperty`.
 */
async function actor(): Promise<{ admin: boolean; accountId: string | null }> {
  if (await isAuthenticated()) return { admin: true, accountId: null };
  const account = await currentAccount();
  if (account) return { admin: false, accountId: account.id };
  throw new ValidationError('Session expirée. Reconnectez-vous.');
}

async function guard(): Promise<void> {
  await actor();
}

/** Réservé à l'administrateur : démarchage, comptes, demandes entrantes. */
async function guardAdmin(): Promise<void> {
  if (!(await isAuthenticated())) throw new ValidationError('Réservé à l’administrateur.');
}

/** Renvoie le bien si l'appelant a le droit d'y toucher, sinon lève. */
async function authorizeProperty(propertyId: string): Promise<Property> {
  const who = await actor();
  const property = await getStore().get('properties', propertyId);
  if (!property) throw new ValidationError('Ce logement n’existe plus.');
  if (!who.admin && property.accountId !== who.accountId) {
    throw new ValidationError('Ce logement ne fait pas partie de votre espace.');
  }
  return property;
}

/** Même contrôle, à partir d'une pièce. */
async function authorizeScene(sceneId: string): Promise<Scene> {
  const scene = await getStore().get('scenes', sceneId);
  if (!scene) throw new ValidationError('Cette pièce n’existe plus.');
  await authorizeProperty(scene.propertyId);
  return scene;
}

/** Enveloppe commune : traduit les exceptions en message affichable. */
async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ValidationError || error instanceof TimecodeError) {
      return { ok: false, error: error.message };
    }
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
    const who = await actor();
    const store = getStore();
    const name = text(formData.get('name'), 'nom du logement', { max: 140 });
    const existing = await store.list('properties');

    const property: Property = {
      id: randomId(),
      accountId: who.accountId ?? '',
      slug: uniqueSlug(name, existing.map((entry) => entry.slug)),
      name,
      city: text(formData.get('city'), 'ville', { max: 120, required: false }),
      ownerName: text(formData.get('ownerName'), 'propriétaire', { max: 140, required: false }),
      ownerEmail: text(formData.get('ownerEmail'), 'email', { max: 200, required: false }),
      ownerPhone: text(formData.get('ownerPhone'), 'téléphone', { max: 40, required: false }),
      description: text(formData.get('description'), 'description', { max: 4000, required: false }),
      notes: '',
      chatEnabled: true,
      mode: 'pano',
      embedUrl: '',
      modelUrl: '',
      videoUrl: '',
      status: 'draft',
      // La fiche se remplit ensuite, à partir des photos puis du questionnaire.
      facts: [],
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
    const store = getStore();
    const id = text(formData.get('id'), 'identifiant', { max: 40 });
    const property = await authorizeProperty(id);

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
      description: text(formData.get('description'), 'description', { max: 4000, required: false }),
      notes: text(formData.get('notes'), 'notes', { max: 4000, required: false }),
      chatEnabled: formData.get('chatEnabled') === 'on',
      mode,
      embedUrl,
    });

    revalidatePath('/espace/biens');

    revalidatePath(`/admin/logements/${id}`);
    revalidatePath('/admin');
    return { ok: true };
  });
}

export async function setPropertyStatus(id: string, status: 'draft' | 'published'): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const property = await authorizeProperty(id);

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
    revalidatePath(`/espace/biens/${id}`);
    revalidatePath('/admin');
    revalidatePath('/espace');
    revalidatePath(`/v/${property.slug}`);
    return { ok: true };
  });
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  return run(async () => {
    await authorizeProperty(id);
    const store = getStore();
    const scenes = await store.list('scenes', { propertyId: id });
    for (const scene of scenes) {
      await store.remove('hotspots', { sceneId: scene.id });
      await store.remove('hotspots', { targetSceneId: scene.id });
    }
    await store.remove('scenes', { propertyId: id });
    await store.remove('photos', { propertyId: id });
    await store.remove('chapters', { propertyId: id });
    await store.remove('chatMessages', { propertyId: id });
    await store.remove('properties', { id });
    revalidatePath('/admin');
    revalidatePath('/espace/biens');
    return { ok: true };
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
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    await authorizeProperty(propertyId);

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
    const store = getStore();
    const scene = await authorizeScene(id);

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
    const store = getStore();
    const scene = await authorizeScene(id);

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
    const store = getStore();
    const scene = await authorizeScene(id);

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
    const store = getStore();
    const scene = await authorizeScene(input.sceneId);
    const target = await store.get('scenes', input.targetSceneId);
    if (!target) throw new ValidationError('Pièce d’arrivée introuvable.');
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
    const hotspot = await getStore().get('hotspots', id);
    if (hotspot) await authorizeScene(hotspot.sceneId);
    await getStore().remove('hotspots', { id });
    return { ok: true };
  });
}

/* ===================================== photos de présentation === */

export async function addPhotos(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    await authorizeProperty(propertyId);

    const files = formData.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) throw new ValidationError('Choisissez au moins une photo.');
    if (files.length > 20) throw new ValidationError('Vingt photos maximum en une fois.');
    files.forEach(assertImage);

    const existing = await store.list('photos', { propertyId });
    for (const [index, file] of files.entries()) {
      const { url } = await putImage('photos', file, file.name);
      const photo: Photo = {
        id: randomId(),
        propertyId,
        url,
        caption: text(file.name.replace(/\.[^.]+$/, ''), 'légende', { max: 120, required: false }),
        position: existing.length + index,
        // Rattachement à une pièce du plan : fait plus tard, à la main.
        roomId: '',
        wallIndex: 0,
      };
      await store.insert('photos', photo);
    }

    revalidatePath(`/admin/logements/${propertyId}`);
    revalidatePath(`/espace/biens/${propertyId}`);
    return { ok: true };
  });
}

export async function updatePhoto(id: string, caption: string): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const photo = await store.get('photos', id);
    if (!photo) throw new ValidationError('Cette photo n’existe plus.');
    await authorizeProperty(photo.propertyId);
    await store.update('photos', id, { caption: text(caption, 'légende', { max: 120, required: false }) });
    revalidatePath(`/espace/biens/${photo.propertyId}`);
    return { ok: true };
  });
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const photo = await store.get('photos', id);
    if (!photo) return { ok: true };
    await authorizeProperty(photo.propertyId);
    await store.remove('photos', { id });
    revalidatePath(`/admin/logements/${photo.propertyId}`);
    revalidatePath(`/espace/biens/${photo.propertyId}`);
    return { ok: true };
  });
}

/* ============================================ chapitres vidéo === */

export async function addChapter(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    await authorizeProperty(propertyId);

    const chapter: Chapter = {
      id: randomId(),
      propertyId,
      label: text(formData.get('label'), 'nom de la pièce', { max: 60 }),
      seconds: parseTimecode(text(formData.get('time'), 'repère', { max: 12 })),
    };
    await store.insert('chapters', chapter);
    revalidatePath(`/admin/logements/${propertyId}`);
    revalidatePath(`/espace/biens/${propertyId}`);
    return { ok: true };
  });
}

export async function deleteChapter(id: string): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const chapter = await store.get('chapters', id);
    if (!chapter) return { ok: true };
    await authorizeProperty(chapter.propertyId);
    await store.remove('chapters', { id });
    revalidatePath(`/admin/logements/${chapter.propertyId}`);
    revalidatePath(`/espace/biens/${chapter.propertyId}`);
    return { ok: true };
  });
}

/* ================================================ modèle 3D importé === */

export async function uploadModel(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    await authorizeProperty(propertyId);
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
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    await authorizeProperty(propertyId);
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

/* ================================================ visite depuis un plan === */

/**
 * Lit le plan d'un logement et en tire un volume parcourable.
 *
 * Deux principes tiennent cette fonction :
 *
 *  1. **La géométrie n'est pas inventée.** Le modèle relève ce qui est dessiné
 *     sur le plan ; ce qui ne s'y trouve pas n'apparaît pas dans la visite.
 *  2. **Rien n'est publié sans relecture.** Le plan est enregistré avec
 *     `confirmed: false`, et `loadPlan` ne sert que les plans confirmés. Une
 *     lecture automatique se trompe : c'est au propriétaire de valider les
 *     dimensions de son propre logement avant qu'un voyageur les voie.
 */
export async function readPropertyPlan(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    await authorizeProperty(propertyId);

    if (!isPlanReaderConfigured()) {
      throw new ValidationError('La lecture de plan n’est pas configurée sur ce site (clé Anthropic absente).');
    }

    const file = formData.get('plan');
    if (!(file instanceof File) || file.size === 0) throw new ValidationError('Choisissez l’image du plan.');
    assertImage(file);

    const declaredArea = Number(formData.get('area') ?? 0);
    if (!Number.isFinite(declaredArea) || declaredArea < 5 || declaredArea > 2000) {
      throw new ValidationError('Indiquez la surface du logement, en m².');
    }
    const hint = text(formData.get('hint'), 'précisions', { max: 400, required: false });

    // Le plan est conservé tel quel : c'est la pièce justificative du relevé.
    const { url } = await putImage('plans', file, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());

    const reading = await readPlan({
      imageBase64: bytes.toString('base64'),
      mediaType: (file.type as 'image/jpeg') || 'image/jpeg',
      declaredArea,
      hint,
    });

    // Un seul plan par logement : le relire remplace le précédent.
    for (const previous of await store.list('plans', { propertyId })) {
      await store.remove('planDoors', { planId: previous.id });
      await store.remove('plans', { id: previous.id });
    }

    const planId = randomId();
    await store.insert('plans', {
      id: planId,
      propertyId,
      imageUrl: url,
      rooms: reading.rooms,
      declaredArea,
      readBy: reading.model,
      readAt: new Date().toISOString(),
      confirmed: false,
      createdAt: new Date().toISOString(),
    });
    for (const opening of reading.doors) {
      await store.insert('planDoors', { ...opening, planId });
    }

    revalidatePath(`/admin/logements/${propertyId}`);
    revalidatePath(`/espace/biens/${propertyId}`);
    return { ok: true };
  });
}

/**
 * Range les photos du bien dans les pièces relevées.
 *
 * Une photo que le modèle ne sait pas rattacher reste sans pièce : mieux vaut
 * un mur nu qu'une photo de cuisine accrochée dans la chambre.
 */
export async function sortPhotosIntoPlan(propertyId: string): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    await authorizeProperty(propertyId);
    if (!isPlanReaderConfigured()) throw new ValidationError('Lecture automatique non configurée.');

    const [plan] = await store.list('plans', { propertyId });
    if (!plan) throw new ValidationError('Lisez d’abord le plan du logement.');
    const photos = await store.list('photos', { propertyId });
    if (photos.length === 0) throw new ValidationError('Ajoutez d’abord des photos.');

    const encoded = await Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        ...(await readImageAsBase64(photo.url)),
      })),
    );

    const assignments = await assignPhotos(plan.rooms, encoded);
    // On repart d'une page blanche : une photo absente du nouveau rattachement
    // doit être détachée, pas conservée dans son ancienne pièce.
    for (const photo of photos) {
      const match = assignments.find((entry) => entry.photoId === photo.id);
      await store.update('photos', photo.id, {
        roomId: match?.roomId ?? '',
        wallIndex: match?.wallIndex ?? 0,
      });
    }

    revalidatePath(`/admin/logements/${propertyId}`);
    revalidatePath(`/espace/biens/${propertyId}`);
    return { ok: true, message: `${assignments.length} photo(s) rattachée(s) sur ${photos.length}.` };
  });
}

/** Le propriétaire a relu le relevé : la visite « Plan 3D » devient publiable. */
export async function confirmPlan(planId: string, confirmed: boolean): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const plan = await store.get('plans', planId);
    if (!plan) throw new ValidationError('Plan introuvable.');
    await authorizeProperty(plan.propertyId);
    await store.update('plans', planId, { confirmed });
    revalidatePath(`/admin/logements/${plan.propertyId}`);
    revalidatePath(`/espace/biens/${plan.propertyId}`);
    return { ok: true };
  });
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const plan = await store.get('plans', planId);
    if (!plan) return { ok: true };
    await authorizeProperty(plan.propertyId);
    await store.remove('planDoors', { planId });
    await store.remove('plans', { id: planId });
    revalidatePath(`/admin/logements/${plan.propertyId}`);
    revalidatePath(`/espace/biens/${plan.propertyId}`);
    return { ok: true };
  });
}

/* ============================================ fiche de renseignements === */

/**
 * Pré-remplit la fiche à partir des photos du bien.
 *
 * Le modèle ne répond qu'aux questions dont la réponse se voit. Ses réponses
 * sont marquées `source: 'ia'` : elles s'affichent au propriétaire pour
 * confirmation, et ni la présentation publique ni l'assistant ne les servent
 * tant qu'il ne les a pas validées.
 */
export async function prefillFacts(propertyId: string): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const property = await authorizeProperty(propertyId);
    if (!isFactsReaderConfigured()) throw new ValidationError('Lecture automatique non configurée.');

    const photos = await store.list('photos', { propertyId });
    if (photos.length === 0) throw new ValidationError('Ajoutez d’abord des photos du logement.');

    const encoded = await Promise.all(
      photos.slice(0, 12).map(async (photo) => ({
        id: photo.id,
        caption: photo.caption,
        ...(await readImageAsBase64(photo.url)),
      })),
    );

    const found = await readFactsFromPhotos(encoded);
    const facts = mergeFacts(property.facts ?? [], found);
    await store.update('properties', propertyId, { facts });

    revalidatePath(`/admin/logements/${propertyId}`);
    revalidatePath(`/espace/biens/${propertyId}`);
    return {
      ok: true,
      message: found.length
        ? `${found.length} réponse(s) proposée(s) d’après vos photos. Vérifiez-les.`
        : 'Les photos n’ont pas permis de répondre. Remplissez la fiche à la main.',
    };
  });
}

/**
 * Enregistre les réponses du propriétaire.
 *
 * Toute réponse passée ici devient `source: 'proprietaire'`, donc définitive :
 * une relecture automatique ultérieure ne l'écrasera pas.
 */
export async function saveFacts(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const store = getStore();
    const propertyId = text(formData.get('propertyId'), 'logement', { max: 40 });
    const property = await authorizeProperty(propertyId);

    const answers: PropertyFact[] = [];
    for (const question of FACT_QUESTIONS) {
      const raw =
        question.kind === 'multi'
          ? formData.getAll(`fait-${question.key}`).map(String).join(', ')
          : String(formData.get(`fait-${question.key}`) ?? '');
      const value = raw.trim().slice(0, 400);
      if (value) answers.push({ key: question.key, value, source: 'proprietaire' });
    }

    const facts = mergeFacts(property.facts ?? [], answers);
    const patch: Partial<Property> = { facts };
    // La présentation publique n'est proposée que si elle est encore vide :
    // un texte écrit par le propriétaire ne doit jamais être remplacé.
    if (!property.description.trim()) {
      const draft = factsForDescription(facts);
      if (draft) patch.description = draft;
    }
    await store.update('properties', propertyId, patch);

    revalidatePath(`/admin/logements/${propertyId}`);
    revalidatePath(`/espace/biens/${propertyId}`);
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
    await guardAdmin();
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
    await guardAdmin();
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
    await guardAdmin();
    await getStore().update('leads', id, { handled });
    revalidatePath('/admin');
    return { ok: true };
  });
}

export async function deleteLead(id: string): Promise<ActionResult> {
  return run(async () => {
    await guardAdmin();
    await getStore().remove('leads', { id });
    revalidatePath('/admin');
    return { ok: true };
  });
}
