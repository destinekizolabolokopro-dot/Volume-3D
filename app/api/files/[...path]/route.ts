import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { contentTypeFor, resolveLocalFile } from '@/lib/paths';

/**
 * Sert les fichiers du stockage de développement (.data/uploads).
 *
 * En production sur Supabase, les URLs pointent directement vers le CDN de
 * stockage : cette route n'est jamais sollicitée.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const target = resolveLocalFile(segments);
  if (!target) return new NextResponse('Chemin invalide', { status: 400 });

  try {
    const file = await fs.readFile(target);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': contentTypeFor(target),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Fichier introuvable', { status: 404 });
  }
}
