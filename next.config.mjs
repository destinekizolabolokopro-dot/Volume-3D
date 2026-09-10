import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    /* Les Server Actions refusent un corps de plus d'un mégaoctet par défaut.
       Aucun formulaire de ce site n'en envoie autant aujourd'hui — les pièces
       jointes passent par /api/consultation, une route, à qui ce réglage ne
       s'applique PAS —, mais un mot de passe ou une situation racontée en
       long ne doit pas buter sur une limite pensée pour des téléversements.

       Le plafond qui compte pour les pièces est MAX_PIECE_BYTES, dans
       lib/piece.ts, et il est calé sur ce qu'une fonction sans serveur
       accepte réellement. */
    serverActions: { bodySizeLimit: '2mb' },
  },

  /* Les fontes sont auto-hébergées et versionnées avec le dépôt : elles ne
     changent que si on les remplace, donc elles peuvent être mises en cache
     définitivement par le navigateur et le CDN. */
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
