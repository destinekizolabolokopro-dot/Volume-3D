import type { Metadata, Viewport } from 'next';
import { MARQUE } from '@/lib/copie';
import './fonts.css';
import './socle.css';
import './assistant.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * La racine du site.
 *
 * Ce service n'est pas une rubrique d'un autre : il occupe son domaine, son
 * dépôt et son déploiement. Rien ici ne renvoie ailleurs, et le nom vient
 * d'une seule constante — voir `MARQUE` dans lib/copie.ts.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${MARQUE.nom} — dix spécialités, pour les propriétaires et les professionnels`,
    template: `%s · ${MARQUE.nom}`,
  },
  description:
    'Bail, location courte durée, copropriété, achat-vente, travaux, urbanisme, voisinage, fiscalité, sinistres : posez votre question, elle va au bon spécialiste, et la réponse cite le texte officiel. Information juridique, pas consultation d’avocat.',
  keywords: [
    'droit immobilier',
    'bail d’habitation',
    'copropriété',
    'meublé de tourisme',
    'congé au locataire',
    'assistant juridique',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: MARQUE.nom,
    title: `${MARQUE.nom} — le droit immobilier, texte à l’appui`,
    description:
      'Dix spécialités, les délais couperets affichés avant la première question, et chaque réponse appuyée sur l’article exact du fonds officiel.',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
};

export const viewport: Viewport = {
  themeColor: '#f5f3ed',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Les deux fichiers du chemin critique : le Bodoni des titres, qui
            est variable et couvre donc 400 à 700 à lui seul, et le Spectral
            du texte courant. Les italiques et le latin étendu ne sont pas
            préchargés : ils n'arrivent que là où on s'en sert. */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/bodoni-normal-400-700-latin.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/spectral-normal-400-latin.woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <div className="jur">{children}</div>
      </body>
    </html>
  );
}
