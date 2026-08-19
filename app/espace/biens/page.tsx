import { EspaceNav } from '@/components/EspaceNav';
import { Empty, ProHead, Section } from '@/components/pro/Pro';
import { PropertyTile } from '@/components/pro/PropertyTile';
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
    <div className="pro">
      <EspaceNav account={account} current="/espace/biens" />

      <main className="pro-page">
        <ProHead
          title="Mes biens"
          sub={`${properties.length} bien${properties.length > 1 ? 's' : ''}${
            limit !== Infinity ? ` sur ${limit} autorisé${limit > 1 ? 's' : ''} par votre formule` : ''
          }.`}
          actions={
            full ? (
              <a className="btn btn-ghost btn-sm" href="/espace/compte">
                Changer de formule
              </a>
            ) : (
              <a className="btn btn-accent btn-sm" href="/espace/creation">
                Créer un bien
              </a>
            )
          }
        />

        <Section title="Vos logements" note="cliquez pour ouvrir le dossier">
          {properties.length === 0 ? (
            <Empty
              title="Votre premier bien vous attend"
              action={
                <a className="btn btn-accent btn-sm" href="/espace/creation">
                  Commencer
                </a>
              }
            >
              Renseignez son nom, une description et quelques photos. Vous ajouterez la visite 360° ou la
              vidéo juste après.
            </Empty>
          ) : (
            <div className="pro-grid">
              {[...properties]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((property) => {
                  const rooms = scenes.filter((scene) => scene.propertyId === property.id).length;
                  return (
                    <PropertyTile
                      key={property.id}
                      property={property}
                      href={`/espace/biens/${property.id}`}
                      cover={coverFor(property.id)}
                      note={`${rooms} pièce${rooms > 1 ? 's' : ''}`}
                    />
                  );
                })}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}
