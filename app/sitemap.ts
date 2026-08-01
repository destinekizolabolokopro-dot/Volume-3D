import type { MetadataRoute } from 'next';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Le plan du site liste la landing et les visites publiées.
 * Les aperçus de démarchage en sont volontairement absents : ils sont privés.
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
