import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { EspaceNav } from '@/components/EspaceNav';
import { PropertyExtras } from '@/components/PropertyExtras';
import { TourEditor } from '@/app/admin/logements/[id]/TourEditor';
import { loadTour } from '@/lib/queries';
import { requireAccount } from '@/lib/require-account';
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
  const [photos, chapters] = await Promise.all([
    store.list('photos', { propertyId: property.id }),
    store.list('chapters', { propertyId: property.id }),
  ]);
  const origin = await currentOrigin();

  return (
    <div className="shell">
      <EspaceNav account={account} current="/espace/biens" />

      <main className="page">
        <div className="page-head">
          <div>
            <h1>{property.name}</h1>
            <p>
              {property.city || 'Ville non renseignée'} · {property.views} vue
              {property.views > 1 ? 's' : ''} · {property.status === 'published' ? 'en ligne' : 'brouillon'}
            </p>
          </div>
          <a className="btn btn-ghost btn-sm" href="/espace/biens">
            ← Mes biens
          </a>
        </div>

        <TourEditor
          property={property}
          scenes={scenes}
          hotspots={hotspots}
          origin={origin}
          extras={
            <PropertyExtras
              propertyId={property.id}
              photos={[...photos].sort((a, b) => a.position - b.position)}
              chapters={chapters}
              hasVideo={property.videoUrl !== ''}
            />
          }
        />
      </main>
    </div>
  );
}
