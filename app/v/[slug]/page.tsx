import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ModelViewer } from '@/components/ModelViewer';
import { PanoViewer } from '@/components/PanoViewer';
import { LogoMark } from '@/components/Logo';
import { CONTACT_EMAIL } from '@/lib/content';
import { bumpViews, findPublishedProperty, loadTour } from '@/lib/queries';
import './tour.css';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const property = await findPublishedProperty(slug);
  if (!property) return { title: 'Visite introuvable' };
  const title = `${property.name} — visite virtuelle 3D`;
  const description = `Visitez ${property.name}${property.city ? ` à ${property.city}` : ''} pièce par pièce, en 360°, avant de réserver.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
  };
}

export default async function TourPage({ params }: Params) {
  const { slug } = await params;
  const property = await findPublishedProperty(slug);
  if (!property) notFound();

  const { scenes, hotspots } = await loadTour(property.id);
  await bumpViews('properties', property.id, property.views);

  return (
    <div className="tour-page">
      <header className="tour-header">
        <div className="tour-identity">
          <div className="tour-name">{property.name}</div>
          {property.city && <div className="tour-city">{property.city}</div>}
        </div>
        <a className="tour-brand" href="/" target="_blank" rel="noopener noreferrer">
          <LogoMark size={18} />
          <span>
            Visite par Volume<b>3D</b>
          </span>
        </a>
      </header>

      <div className="tour-stage">
        {property.mode === 'embed' && property.embedUrl ? (
          <iframe
            className="tour-embed"
            src={property.embedUrl}
            title={`Visite 3D — ${property.name}`}
            allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : property.mode === 'model' && property.modelUrl ? (
          <ModelViewer url={property.modelUrl} />
        ) : (
          <PanoViewer scenes={scenes} hotspots={hotspots} />
        )}
      </div>

      <footer className="tour-footer">
        <span>Vous aussi, équipez votre annonce d’une visite 3D.</span>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </div>
  );
}
