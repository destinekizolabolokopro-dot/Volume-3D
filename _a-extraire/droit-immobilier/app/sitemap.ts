import type { MetadataRoute } from 'next';
import { DOMAINES } from '@/lib/domaines';

/**
 * Le plan du site.
 *
 * L'accueil, la page des formules, et les dix fiches de spécialité. En sont
 * volontairement absentes les consultations : elles appartiennent à un compte,
 * et leur seule existence dit déjà quelque chose de la personne.
 */
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/abonnement`, changeFrequency: 'monthly', priority: 0.8 },
    ...DOMAINES.map((domaine) => ({
      url: `${base}/${domaine.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
