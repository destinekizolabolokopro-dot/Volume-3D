import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import { FactsPanel } from '@/components/FactsPanel';
import { PlanPanel } from '@/components/PlanPanel';
import { PropertyExtras } from '@/components/PropertyExtras';
import { loadTour } from '@/lib/queries';
import { requireAuth } from '@/lib/require-auth';
import { isFactsReaderConfigured } from '@/lib/facts-reader';
import { reviewIntake } from '@/lib/intake';
import { isPlanReaderConfigured } from '@/lib/plan-reader';
import { getStore } from '@/lib/store';
import { logout } from '../../actions';
import { TourEditor } from './TourEditor';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function currentOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const protocol = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function PropertyEditorPage({ params }: Params) {
  await requireAuth();

  const { id } = await params;
  const property = await getStore().get('properties', id);
  if (!property) notFound();

  const { scenes, hotspots } = await loadTour(property.id);
  const store = getStore();
  const [photos, chapters, plans] = await Promise.all([
    store.list('photos', { propertyId: property.id }),
    store.list('chapters', { propertyId: property.id }),
    store.list('plans', { propertyId: property.id }),
  ]);
  // On charge le plan même non confirmé : c'est ici qu'on le relit avant de
  // décider de le publier.
  const plan = plans[0] ?? null;
  const planDoors = plan ? await store.list('planDoors', { planId: plan.id }) : [];
  // Ce qui manque au dossier : calcul déterministe, aucun appel de modèle.
  const intake = reviewIntake(plan, planDoors, photos);
  const origin = await currentOrigin();

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-bar-brand">
          <LogoMark size={20} />
          <span>
            Volume<span>3D</span>
          </span>
        </div>
        <nav className="admin-nav">
          <a href="/admin">← Tableau de bord</a>
          {property.status === 'published' && (
            <a href={`/v/${property.slug}`} target="_blank" rel="noopener noreferrer">
              Voir la visite ↗
            </a>
          )}
          <form action={logout}>
            <button type="submit" className="btn btn-ghost btn-sm" style={{ color: '#e6dcce', borderColor: '#4a4038' }}>
              Déconnexion
            </button>
          </form>
        </nav>
      </header>

      <main className="admin-main">
        <h1 className="admin-h1">{property.name}</h1>
        <p className="admin-sub">
          {property.city || 'Ville non renseignée'} · créé le{' '}
          {new Date(property.createdAt).toLocaleDateString('fr-FR')} · /v/{property.slug}
        </p>

        <TourEditor
          property={property}
          scenes={scenes}
          hotspots={hotspots}
          origin={origin}
          extras={
            <>
              <PropertyExtras
                propertyId={property.id}
                photos={[...photos].sort((first, second) => first.position - second.position)}
                chapters={chapters}
                hasVideo={property.videoUrl !== ''}
              />
              <PlanPanel
                propertyId={property.id}
                plan={plan}
                doors={planDoors}
                photos={photos}
                readerConfigured={isPlanReaderConfigured()}
              />
              <FactsPanel
                propertyId={property.id}
                facts={property.facts ?? []}
                intake={intake}
                readerConfigured={isFactsReaderConfigured()}
                hasPhotos={photos.length > 0}
              />
            </>
          }
        />
      </main>
    </div>
  );
}
