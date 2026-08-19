import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { EspaceNav } from '@/components/EspaceNav';
import { ProHead, Tag } from '@/components/pro/Pro';
import { FactsPanel } from '@/components/FactsPanel';
import { JourneyBar } from '@/components/JourneyBar';
import { PlanPanel } from '@/components/PlanPanel';
import { PublishKit } from '@/components/PublishKit';
import { PropertyExtras } from '@/components/PropertyExtras';
import { TourEditor } from '@/app/admin/logements/[id]/TourEditor';
import { loadTour } from '@/lib/queries';
import { requireAccount } from '@/lib/require-account';
import { isFactsReaderConfigured } from '@/lib/facts-reader';
import { reviewIntake } from '@/lib/intake';
import { reviewJourney } from '@/lib/journey';
import { isPlanReaderConfigured } from '@/lib/plan-reader';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function currentOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const protocol = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function BienPage({ params }: Params) {
  const account = await requireAccount();
  const { id } = await params;

  const store = getStore();
  const property = await store.get('properties', id);
  // Un bien qui n'appartient pas au compte est traité comme inexistant :
  // aucune information ne doit fuiter entre clients.
  if (!property || property.accountId !== account.id) notFound();

  const { scenes, hotspots } = await loadTour(property.id);
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
      <EspaceNav account={account} current="/espace/biens" />

      <main className="pro-page">
        <ProHead
          title={property.name}
          sub={
            <>
              {property.city || 'Ville non renseignée'} · {property.views} vue
              {property.views > 1 ? 's' : ''}{' '}
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
              <a className="btn btn-ghost btn-sm" href="/espace/biens">
                ← Mes biens
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
