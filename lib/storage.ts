import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { randomId } from './ids';
import { UPLOAD_DIR, extensionOf } from './paths';
import { supabaseAdmin } from './store';

export { contentTypeFor, resolveLocalFile } from './paths';
import { resolveLocalFile } from './paths';

const BUCKET = process.env.SUPABASE_BUCKET ?? 'tours';

/** Panoramas 20 Mo, modèles 3D 120 Mo : un .glb de logement est lourd. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_MODEL_BYTES = 120 * 1024 * 1024;
/** Une déambulation de 2 à 3 minutes filmée au téléphone tient largement dedans. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MODEL_EXTENSIONS = new Set(['.glb', '.gltf']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export interface UploadResult {
  url: string;
  bytes: number;
}

/** Refuse tout ce qui n'est pas une image raisonnable avant d'écrire quoi que ce soit. */
export function assertImage(file: File): void {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error(`Format non supporté (${file.type || 'inconnu'}). Utilisez JPEG, PNG, WebP ou AVIF.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image trop lourde (${Math.round(file.size / 1024 / 1024)} Mo). Maximum ${MAX_IMAGE_BYTES / 1024 / 1024} Mo.`,
    );
  }
}

export function assertModel(file: File): void {
  if (!MODEL_EXTENSIONS.has(extensionOf(file.name))) {
    throw new Error('Format non supporté. Exportez votre modèle en .glb depuis Polycam ou Luma.');
  }
  if (file.size > MAX_MODEL_BYTES) {
    throw new Error(
      `Modèle trop lourd (${Math.round(file.size / 1024 / 1024)} Mo). Maximum ${MAX_MODEL_BYTES / 1024 / 1024} Mo.`,
    );
  }
}

export function assertVideo(file: File): void {
  if (!VIDEO_TYPES.has(file.type)) {
    throw new Error(`Format non supporté (${file.type || 'inconnu'}). Utilisez MP4, WebM ou MOV.`);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Vidéo trop lourde (${Math.round(file.size / 1024 / 1024)} Mo). Maximum ${MAX_VIDEO_BYTES / 1024 / 1024} Mo.`,
    );
  }
}

/** Largeur maximale d'un panorama servi aux voyageurs. */
const MAX_PANO_WIDTH = 4096;

/**
 * Recompresse une image avant stockage.
 *
 * Un panorama sorti d'une caméra 360° pèse couramment 8 à 15 Mo : servi tel
 * quel, il fait attendre le voyageur plusieurs secondes sur mobile. On le
 * ramène à une largeur raisonnable en JPEG progressif, on applique l'orientation
 * EXIF puis on supprime les métadonnées — dont la position GPS du logement.
 *
 * En cas d'échec (format exotique, image corrompue), le fichier d'origine est
 * conservé : mieux vaut une image lourde qu'une image perdue.
 */
async function optimizeImage(buffer: Buffer): Promise<{ buffer: Buffer; extension: string; contentType: string }> {
  try {
    const image = sharp(buffer, { limitInputPixels: 512 * 1024 * 1024 }).rotate();
    const { width } = await image.metadata();
    const resized = width && width > MAX_PANO_WIDTH ? image.resize({ width: MAX_PANO_WIDTH }) : image;
    const output = await resized.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer();
    // Une recompression qui alourdit le fichier n'a aucun intérêt.
    if (output.byteLength >= buffer.byteLength) throw new Error('compression sans gain');
    return { buffer: output, extension: '.jpg', contentType: 'image/jpeg' };
  } catch {
    return { buffer, extension: '', contentType: '' };
  }
}

/**
 * Écrit une image en la recompressant au passage. Renvoie l'URL publique et le
 * poids réellement stocké.
 */
export async function putImage(folder: string, file: File | Blob, filename: string): Promise<UploadResult> {
  const source = Buffer.from(await file.arrayBuffer());
  const optimized = await optimizeImage(source);
  const blob = new Blob([new Uint8Array(optimized.buffer)], {
    type: optimized.contentType || file.type || 'image/jpeg',
  });
  return putFile(folder, blob, optimized.extension ? `image${optimized.extension}` : filename);
}

/**
 * Écrit un fichier et renvoie son URL publique.
 *
 * `folder` sert uniquement à ranger (ex. "panos", "previews") : le nom final est
 * toujours régénéré, on ne fait jamais confiance au nom fourni par le client.
 */
export async function putFile(folder: string, file: File | Blob, filename: string): Promise<UploadResult> {
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, '') || 'divers';
  const key = `${safeFolder}/${randomId(16)}${extensionOf(filename)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const client = supabaseAdmin();
  if (client) {
    const { error } = await client.storage.from(BUCKET).upload(key, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
    const { data } = client.storage.from(BUCKET).getPublicUrl(key);
    return { url: data.publicUrl, bytes: buffer.byteLength };
  }

  const target = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { url: `/api/files/${key}`, bytes: buffer.byteLength };
}

/**
 * Relit une image déjà stockée et la rend encodée pour l'API du modèle.
 *
 * Elle est redimensionnée au passage : pour reconnaître une pièce, 1024 px de
 * large suffisent largement, et une photo de 4 Mo coûterait des jetons sans
 * rien apporter au jugement.
 */
export async function readImageAsBase64(
  url: string,
): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const bytes = await readStored(url);
  const resized = await sharp(bytes).rotate().resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
  return { base64: resized.toString('base64'), mediaType: 'image/jpeg' };
}

/** Rend le contenu binaire d'un fichier déjà envoyé, quel que soit le stockage. */
async function readStored(url: string): Promise<Buffer> {
  const client = supabaseAdmin();
  if (client) {
    // En production les fichiers sont dans le bucket : l'URL publique se
    // termine par le chemin de l'objet.
    const marker = `/${BUCKET}/`;
    const at = url.indexOf(marker);
    const objectPath = at >= 0 ? url.slice(at + marker.length) : url;
    const { data, error } = await client.storage.from(BUCKET).download(objectPath);
    if (error || !data) throw new Error(`Fichier illisible : ${error?.message ?? url}`);
    return Buffer.from(await data.arrayBuffer());
  }

  // En développement, /api/files/<dossier>/<nom> pointe vers .data/uploads.
  const segments = url.replace(/^\/api\/files\//, '').split('/').filter(Boolean);
  const local = resolveLocalFile(segments);
  if (!local) throw new Error(`Chemin de fichier refusé : ${url}`);
  return fs.readFile(local);
}
