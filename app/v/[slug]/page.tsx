import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChatWidget } from '@/components/ChatWidget';
import { LogoMark } from '@/components/Logo';
import { TourStage } from '@/components/TourStage';
import { CONTACT_EMAIL } from '@/lib/content';
import { isAssistantConfigured } from '@/lib/assistant';
import { availableFormats, bumpViews, findPublishedProperty, loadTour } from '@/lib/queries';
import { getStore } from '@/lib/store';
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
  const store = getStore();
  const [chapters, photos] = await Promise.all([
    store.list('chapters', { propertyId: property.id }),
    store.list('photos', { propertyId: property.id }),
  ]);
  await bumpViews('properties', property.id, property.views);
  const formats = availableFormats(property, scenes.length);
  const assistantOn = property.chatEnabled && isAssistantConfigured();

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
        <TourStage
          formats={formats}
          defaultFormat={property.mode}
          name={property.name}
          scenes={scenes}
          hotspots={hotspots}
          videoUrl={property.videoUrl}
          modelUrl={property.modelUrl}
          embedUrl={property.embedUrl}
          chapters={chapters}
        />
      </div>

      {(property.description || photos.length > 0) && (
        <section className="tour-about">
          <div className="tour-about-inner">
            {property.description && (
              <div className="tour-desc">
                <h2>Le logement</h2>
                <p>{property.description}</p>
              </div>
            )}

            {photos.length > 0 && (
              <div className="tour-gallery">
                {[...photos]
                  .sort((a, b) => a.position - b.position)
                  .map((photo) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={photo.id} src={photo.url} alt={photo.caption || property.name} loading="lazy" />
                  ))}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="tour-footer">
        <span>Vous aussi, équipez votre annonce d’une visite 3D.</span>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>

      {assistantOn && <ChatWidget slug={property.slug} propertyName={property.name} />}
    </div>
  );
}
