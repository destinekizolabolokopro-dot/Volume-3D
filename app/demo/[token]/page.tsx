import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PanoViewer } from '@/components/PanoViewer';
import { LogoMark } from '@/components/Logo';
import { CONTACT_EMAIL } from '@/lib/content';
import { bumpViews, findPreview, loadPreviewShots, previewExpired } from '@/lib/queries';
import type { Scene } from '@/lib/types';
import '../../v/[slug]/tour.css';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

/**
 * Un aperçu de démarchage n'est jamais indexé ni référencé : c'est un document
 * commercial privé, adressé à un seul propriétaire.
 */
export const metadata: Metadata = {
  title: 'Aperçu simulé',
  robots: { index: false, follow: false, nocache: true },
};

export default async function DemoPage({ params }: Params) {
  const { token } = await params;
  const preview = await findPreview(token);
  if (!preview || preview.status !== 'ready' || previewExpired(preview)) notFound();

  const shots = await loadPreviewShots(preview.id);
  await bumpViews('previews', preview.id, preview.views);

  // Les vues de l'aperçu réutilisent le viewer 360°, avec le filigrane activé.
  const scenes: Scene[] = shots.map((shot, index) => ({
    id: shot.id,
    propertyId: preview.id,
    name: shot.label || `Vue ${index + 1}`,
    imageUrl: shot.generatedUrl || shot.sourceUrl,
    position: shot.position,
    initialYaw: 0,
    initialPitch: 0,
  }));

  const expiry = new Date(preview.expiresAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="tour-page">
      <div className="demo-banner">
        <span>
          <strong>Aperçu simulé — non contractuel.</strong> Ces vues ont été reconstituées par intelligence
          artificielle à partir des photos de votre annonce. Elles illustrent le rendu d’une visite Volume3D, mais ne
          représentent pas fidèlement votre logement. Une visite réelle nécessite un scan sur place.
        </span>
        <span className="demo-expiry">Lien valable jusqu’au {expiry}</span>
      </div>

      <header className="tour-header">
        <div className="tour-identity">
          <div className="tour-name">{preview.propertyName}</div>
          {preview.city && <div className="tour-city">{preview.city}</div>}
        </div>
        <a className="tour-brand" href="/" target="_blank" rel="noopener noreferrer">
          <LogoMark size={18} onDark />
          <span>
            Aperçu Volume<b>3D</b>
          </span>
        </a>
      </header>

      <div className="tour-stage">
        <PanoViewer scenes={scenes} hotspots={[]} watermark="Aperçu simulé" showHint={false} />
      </div>

      <footer className="tour-footer">
        <span>Envie de la vraie visite de votre logement, scannée sur place ?</span>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}
