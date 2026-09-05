import type { MetadataRoute } from 'next';
import { DOMAINES } from '@/lib/domaines';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Le plan du site liste la landing, les visites publiées et les fiches des
 * spécialités juridiques.
 *
 * En sont volontairement absents : les aperçus de démarchage (privés) et les
 * consultations (elles appartiennent à un compte, et leur seule existence dit
 * déjà quelque chose de la personne).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/juridique`, changeFrequency: 'monthly', priority: 0.9 },
    ...DOMAINES.map((domaine) => ({
      url: `${base}/juridique/${domaine.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
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
