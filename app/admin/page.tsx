import { headers } from 'next/headers';
import { LogoMark } from '@/components/Logo';
import { isAiConfigured } from '@/lib/ai-preview';
import { upcoming } from '@/lib/booking';
import { requireAuth } from '@/lib/require-auth';
import { getStore, isLocalStore } from '@/lib/store';
import { logout } from './actions';
import { LeadRow, NewPreviewForm, NewPropertyForm, PreviewRow } from './DashboardForms';

export const dynamic = 'force-dynamic';

/** Reconstruit l'origine publique pour composer les liens à copier. */
async function currentOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const protocol = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function AdminHome() {
  await requireAuth();

  const store = getStore();
  const [properties, previews, leads, appointments] = await Promise.all([
    store.list('properties'),
    store.list('previews'),
    store.list('leads'),
    store.list('appointments'),
  ]);
  const origin = await currentOrigin();

  const byDate = <T extends { createdAt: string }>(list: T[]) =>
    [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pendingLeads = leads.filter((lead) => !lead.handled).length;
  const pendingAppointments = upcoming(appointments, new Date()).filter(
    (appointment) => appointment.status === 'demande',
  ).length;

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-bar-brand">
          <LogoMark size={20} onDark />
          <span>
            Volume<span>3D</span>
          </span>
        </div>
        <nav className="admin-nav">
          <a href="/admin/rendez-vous">
            Rendez-vous{pendingAppointments > 0 ? ` (${pendingAppointments})` : ''}
          </a>
          <a href="/admin/demarchage">Fiche de démarchage</a>
          <a href="/" target="_blank" rel="noopener noreferrer">
            Voir le site ↗
          </a>
          <form action={logout}>
            <button type="submit" className="btn btn-on-dark btn-sm">
              Déconnexion
            </button>
          </form>
        </nav>
      </header>

      <main className="admin-main">
        <h1 className="admin-h1">Tableau de bord</h1>
        <p className="admin-sub">
          {properties.length} logement{properties.length > 1 ? 's' : ''} ·{' '}
          {properties.filter((property) => property.status === 'published').length} visite
          {properties.filter((property) => property.status === 'published').length > 1 ? 's' : ''} en ligne ·{' '}
          {pendingLeads} demande{pendingLeads > 1 ? 's' : ''} à traiter
        </p>

        {isLocalStore() && (
          <div className="callout-box" style={{ marginBottom: 24 }}>
            <strong>Mode développement.</strong> Les données sont enregistrées dans le dossier <code>.data/</code> de ce
            projet, et disparaîtront au prochain déploiement. Renseignez <code>SUPABASE_URL</code> et{' '}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> pour passer sur la base hébergée.
          </div>
        )}

        {/* ---------------------------------------------------- logements --- */}
        <section>
          <div className="row row-between" style={{ marginBottom: 14 }}>
            <h2 className="admin-h2">
              Logements <small>visites réelles, scannées sur place</small>
            </h2>
            <NewPropertyForm />
          </div>

          {properties.length === 0 ? (
            <div className="empty">
              Aucun logement pour l’instant. Créez-en un, ajoutez les panoramas de chaque pièce, puis publiez.
            </div>
          ) : (
            <div className="grid-cards">
              {byDate(properties).map((property) => (
                <a className="property-card" key={property.id} href={`/admin/logements/${property.id}`}>
                  <div className="row row-between" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="property-name">{property.name}</div>
                      <div className="tiny">
                        {property.city || 'ville non renseignée'} · {property.views} vue
                        {property.views > 1 ? 's' : ''}
                      </div>
                    </div>
                    <span className={`tag ${property.status === 'published' ? 'tag-live' : 'tag-draft'}`}>
                      {property.status === 'published' ? 'En ligne' : 'Brouillon'}
                    </span>
                  </div>
                  {property.ownerName && <div className="tiny" style={{ marginTop: 8 }}>{property.ownerName}</div>}
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------ aperçus --- */}
        <section>
          <div className="row row-between" style={{ marginBottom: 14 }}>
            <h2 className="admin-h2">
              Aperçus de démarchage <small>simulations IA, privées et temporaires</small>
            </h2>
            <NewPreviewForm aiConfigured={isAiConfigured()} />
          </div>

          {previews.length === 0 ? (
            <div className="empty">
              Aucun aperçu. Partez des photos publiques d’une annonce pour montrer à son propriétaire ce que donnerait
              une visite — en lui indiquant clairement qu’il s’agit d’une simulation.
            </div>
          ) : (
            <div className="stack">
              {byDate(previews).map((preview) => (
                <PreviewRow key={preview.id} preview={preview} origin={origin} />
              ))}
            </div>
          )}
        </section>

        {/* ----------------------------------------------------- demandes --- */}
        <section>
          <h2 className="admin-h2">
            Demandes reçues <small>formulaire de la landing</small>
          </h2>

          {leads.length === 0 ? (
            <div className="empty">Aucune demande pour l’instant.</div>
          ) : (
            <div className="stack">
              {byDate(leads).map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
