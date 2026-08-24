import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  experimental: {
    // Les panoramas 360° pèsent plusieurs mégaoctets : la limite par défaut
    // des Server Actions (1 Mo) rejetterait chaque envoi.
    serverActions: { bodySizeLimit: '25mb' },
  },
  /*
   * `/demonstration` montrait la visite libre : on regarde autour de soi à la
   * souris, on avance d'une pièce à l'autre. Elle a été retirée du site public
   * — la démonstration se réduit à la visite au défilement, parce qu'un
   * visiteur qui découvre le produit doit avoir **une seule** chose à faire, et
   * que cette chose doit être celle qu'il fait déjà.
   *
   * L'adresse, elle, a circulé : elle est en clair sur des liens envoyés. Une
   * redirection permanente coûte une ligne et évite un 404 à quelqu'un qui
   * revient. Elle mène à la villa, qui est la démonstration.
   */
  async redirects() {
    return [{ source: '/demonstration', destination: '/villa', permanent: true }];
  },

  // Les fontes sont auto-hébergées et versionnées avec le dépôt : elles ne
  // changent que si on les remplace, donc elles peuvent être mises en cache
  // définitivement par le navigateur et le CDN.
  async headers() {
    return [
      {
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  // L'alias « @/ » de tsconfig n'est pas appliqué à la couche client par le
  // compilateur : on le déclare explicitement pour les deux bundlers.
  turbopack: { resolveAlias: { '@': projectRoot } },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, '@': projectRoot };
    return config;
  },
};

export default nextConfig;
