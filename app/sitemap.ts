import type { MetadataRoute } from 'next';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Le plan du site de Volume3D : la landing et les visites publiées.
 *
 * L'assistant juridique a le sien, dans app/juridique/sitemap.ts. Ce sont deux
 * services distincts : les mêler dans un seul plan les ferait indexer comme un
 * seul site, avec la landing 3D pour page d'accueil de questions de droit.
 *
 * En sont volontairement absents : les aperçus de démarchage (privés) et les
 * consultations (elles appartiennent à un compte, et leur seule existence dit
 * déjà quelque chose de la personne).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'monthly', priority: 1 },
  ];

  try {
    const published = await getStore().list('properties', { status: 'published' });
    for (const property of published) {
      entries.push({
        url: `${base}/v/${property.slug}`,
        lastModified: property.publishedAt ?? property.createdAt,
        changeFrequency: 'yearly',
        priority: 0.7,
      });
    }
  } catch {
    // Base injoignable : on publie au moins la landing.
  }

  return entries;
}
