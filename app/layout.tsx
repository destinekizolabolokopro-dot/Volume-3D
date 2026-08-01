import type { Metadata, Viewport } from 'next';
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
  themeColor: '#f6f1ea',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Domine:wght@500;600;700&family=Work+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
