import { EspaceNav } from '@/components/EspaceNav';
import { PLAN_LIMITS } from '@/lib/accounts';
import { requireAccount } from '@/lib/require-account';
import { getStore } from '@/lib/store';
import type { Plan } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function BiensPage() {
  const account = await requireAccount();
  const store = getStore();

  const properties = await store.list('properties', { accountId: account.id });
  const photos = await store.list('photos');
  const scenes = await store.list('scenes');
  const limit = PLAN_LIMITS[account.plan as Plan] ?? 1;
  const full = properties.length >= limit;

  /** Première photo ou premier panorama : de quoi reconnaître le bien d'un coup d'œil. */
  const coverFor = (propertyId: string) =>
    photos.filter((photo) => photo.propertyId === propertyId).sort((a, b) => a.position - b.position)[0]?.url ??
    scenes.filter((scene) => scene.propertyId === propertyId).sort((a, b) => a.position - b.position)[0]?.imageUrl ??
    null;

  return (
    <div className="shell">
      <EspaceNav account={account} current="/espace/biens" />

      <main className="page">
        <div className="page-head">
          <div>
            <h1>Mes biens</h1>
            <p>
              {properties.length} bien{properties.length > 1 ? 's' : ''}
              {limit !== Infinity && ` sur ${limit} autorisé${limit > 1 ? 's' : ''} par votre formule`}.
            </p>
          </div>
          {full ? (
            <a className="btn btn-ghost btn-sm" href="/espace/compte">
              Changer de formule
            </a>
          ) : (
            <a className="btn btn-dark btn-sm" href="/espace/creation">
              + Créer un bien
            </a>
          )}
        </div>

        {properties.length === 0 ? (
          <div className="empty">
            <strong>Votre premier bien vous attend</strong>
            Renseignez son nom, une description et quelques photos. Vous ajouterez la visite 360° ou la vidéo juste
            après. <a href="/espace/creation">Commencer</a>
          </div>
        ) : (
          <div className="bien-grid">
            {[...properties]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((property) => {
                const cover = coverFor(property.id);
                const rooms = scenes.filter((scene) => scene.propertyId === property.id).length;
                return (
                  <a className="bien" key={property.id} href={`/espace/biens/${property.id}`}>
                    <div className="bien-cover">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" loading="lazy" />
                      ) : (
                        <span>aucune image</span>
                      )}
                      <span className={`badge ${property.status === 'published' ? 'badge-live' : 'badge-draft'}`}>
                        {property.status === 'published' ? 'En ligne' : 'Brouillon'}
                      </span>
                    </div>
                    <div className="bien-body">
                      <div className="bien-name">{property.name}</div>
                      <div className="tiny">
                        {property.city || 'ville non renseignée'} · {rooms} pièce{rooms > 1 ? 's' : ''} ·{' '}
                        {property.views} vue{property.views > 1 ? 's' : ''}
                      </div>
                    </div>
                  </a>
                );
              })}
          </div>
        )}
      </main>
    </div>
  );
}
