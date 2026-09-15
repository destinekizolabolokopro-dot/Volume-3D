import type { MetadataRoute } from 'next';
import { DOMAINES } from '@/lib/juridique/domaines';

/**
 * Le plan du site de l'assistant juridique, et de lui seul.
 *
 * Il est séparé de celui de Volume3D à dessein. Ce sont deux services, et un
 * moteur qui les trouve dans un même plan les traite comme un seul site : la
 * page d'accueil des visites 3D deviendrait la racine de questions de droit,
 * et les deux se tireraient l'un l'autre vers le bas sur des requêtes qui
 * n'ont rien à voir.
 *
 * `NEXT_PUBLIC_JURIDIQUE_URL` permet de servir ce service sous son propre nom
 * de domaine. Sans elle, on retombe sur l'adresse principale : un dépôt qu'on
 * vient de cloner doit marcher sans configuration.
 */
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (
    process.env.NEXT_PUBLIC_JURIDIQUE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');

  return [
    { url: `${base}/juridique`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/juridique/abonnement`, changeFrequency: 'monthly', priority: 0.8 },
    ...DOMAINES.map((domaine) => ({
      url: `${base}/juridique/${domaine.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
