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
