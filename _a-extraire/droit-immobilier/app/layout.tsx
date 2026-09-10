import type { Metadata, Viewport } from 'next';
import { Mention } from '@/components/Mention';
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
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Une seule fonte pour tout le site : un seul fichier dans le chemin
            critique. Inter est variable, ce fichier couvre toutes les graisses. */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-400-latin.woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <div className="jur">
          <Mention />
          {children}
        </div>
      </body>
    </html>
  );
}
