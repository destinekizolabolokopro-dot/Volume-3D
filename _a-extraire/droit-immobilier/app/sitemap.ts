import type { MetadataRoute } from 'next';
import { MODELES } from '@/lib/documents';
import { DOMAINES } from '@/lib/domaines';

/**
 * Le plan du site.
 *
 * L'accueil, les formules, les modèles, les dix fiches de spécialité et les
 * trois pages du cadre. En sont volontairement absentes les consultations :
 * elles appartiennent à un compte, et leur seule existence dit déjà quelque
 * chose de la personne.
 */
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/abonnement`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/documents`, changeFrequency: 'monthly', priority: 0.9 },
    /* Les trois pages du cadre. Basse priorité, mais présentes : un moteur qui
       ne trouve pas les mentions légales d'un site marchand le lui reproche. */
    { url: `${base}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/conditions`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/confidentialite`, changeFrequency: 'yearly', priority: 0.3 },
    ...MODELES.map((modele) => ({
      url: `${base}/documents/${modele.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...DOMAINES.map((domaine) => ({
      url: `${base}/${domaine.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
