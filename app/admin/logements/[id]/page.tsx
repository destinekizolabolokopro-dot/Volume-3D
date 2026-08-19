import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminBar } from '@/components/pro/AdminBar';
import { ProHead, Tag } from '@/components/pro/Pro';
import { FactsPanel } from '@/components/FactsPanel';
import { JourneyBar } from '@/components/JourneyBar';
import { PlanPanel } from '@/components/PlanPanel';
import { PublishKit } from '@/components/PublishKit';
import { PropertyExtras } from '@/components/PropertyExtras';
import { loadTour } from '@/lib/queries';
import { requireAuth } from '@/lib/require-auth';
import { isFactsReaderConfigured } from '@/lib/facts-reader';
import { reviewIntake } from '@/lib/intake';
import { reviewJourney } from '@/lib/journey';
import { isPlanReaderConfigured } from '@/lib/plan-reader';
import { getStore } from '@/lib/store';
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
  // Où en est le dossier : dérivé de l'état, jamais stocké.
  const journey = reviewJourney({
    property,
    sceneCount: scenes.length,
    photoCount: photos.length,
    plan,
    intake,
    facts: property.facts ?? [],
  });
  const origin = await currentOrigin();

  return (
    <div className="pro">
      <AdminBar current="/admin" />

      <main className="pro-page">
        <ProHead
          title={property.name}
          sub={
            <>
              {property.city || 'Ville non renseignée'} · créé le{' '}
              {new Date(property.createdAt).toLocaleDateString('fr-FR')} · /v/{property.slug}
              <Tag tone={property.status === 'published' ? 'live' : 'draft'}>
                {property.status === 'published' ? 'En ligne' : 'Brouillon'}
              </Tag>
            </>
          }
          actions={
            <>
              {property.status === 'published' && (
                <a
                  className="btn btn-ghost btn-sm"
                  href={`/v/${property.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Voir la visite ↗
                </a>
              )}
              <a className="btn btn-ghost btn-sm" href="/admin">
                ← Tableau de bord
              </a>
            </>
          }
        />

        <JourneyBar journey={journey} />

        <TourEditor
          property={property}
          scenes={scenes}
          hotspots={hotspots}
          origin={origin}
          sections={{
            contenu: (
              <PropertyExtras
                propertyId={property.id}
                photos={[...photos].sort((first, second) => first.position - second.position)}
                chapters={chapters}
                hasVideo={property.videoUrl !== ''}
              />
            ),
            plan: (
              <PlanPanel
                propertyId={property.id}
                plan={plan}
                doors={planDoors}
                photos={photos}
                readerConfigured={isPlanReaderConfigured()}
              />
            ),
            fiche: (
              <FactsPanel
                propertyId={property.id}
                facts={property.facts ?? []}
                intake={intake}
                readerConfigured={isFactsReaderConfigured()}
                hasPhotos={photos.length > 0}
              />
            ),
            annonce: (
              <PublishKit
                property={property}
                plan={plan}
                doors={planDoors}
                facts={property.facts ?? []}
                tourUrl={`${origin}/v/${property.slug}`}
              />
            ),
          }}
        />
      </main>
    </div>
  );
}
