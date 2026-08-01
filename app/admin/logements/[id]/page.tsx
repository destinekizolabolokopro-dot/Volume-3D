import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import { loadTour } from '@/lib/queries';
import { requireAuth } from '@/lib/require-auth';
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

        <TourEditor property={property} scenes={scenes} hotspots={hotspots} origin={origin} />
      </main>
    </div>
  );
}
