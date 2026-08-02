import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Volume3D — visites virtuelles 3D pour logements Airbnb',
    template: '%s · Volume3D',
  },
  description:
    "Visites virtuelles 3D pour propriétaires et conciergeries Airbnb. Un lien interactif à intégrer dans votre annonce, livré sous 48h. France entière.",
  keywords: [
    'visite virtuelle 3D',
    'Airbnb',
    'conciergerie',
    'location saisonnière',
    'visite 360',
    'Matterport',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Volume3D',
    title: 'Volume3D — visites virtuelles 3D pour logements Airbnb',
    description:
      "Vos voyageurs visitent chaque pièce avant de réserver. Un lien interactif, livré sous 48h.",
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
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
      <body>{children}</body>
    </html>
  );
}
