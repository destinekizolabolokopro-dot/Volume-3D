import path from 'node:path';

/** Dossier de stockage utilisé en développement (aucun Supabase configuré). */
export const UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads');

export function extensionOf(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext.length > 1 && ext.length <= 6 ? ext : '';
}

/**
 * Résout un chemin de `/api/files/...` vers un fichier réel du dossier d'upload.
 * Renvoie null si le chemin tente de sortir du dossier (traversée de répertoire).
 */
export function resolveLocalFile(segments: string[]): string | null {
  const target = path.resolve(UPLOAD_DIR, ...segments);
  const root = path.resolve(UPLOAD_DIR);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

export function contentTypeFor(filename: string): string {
  return CONTENT_TYPES[extensionOf(filename)] ?? 'application/octet-stream';
}
