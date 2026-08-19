import { headers } from 'next/headers';
import { AdminBar } from '@/components/pro/AdminBar';
import { Empty, ProHead, Section, Stat, StatBand } from '@/components/pro/Pro';
import { PropertyTile } from '@/components/pro/PropertyTile';
import { isAiConfigured } from '@/lib/ai-preview';
import { upcoming } from '@/lib/booking';
import { reviewMany } from '@/lib/queries';
import { requireAuth } from '@/lib/require-auth';
import { getStore, isLocalStore } from '@/lib/store';
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

/**
 * Le back-office.
 *
 * Il ouvre sur des chiffres, et c'est le point : un outil de travail répond
 * d'abord à « où j'en suis », pas à « qu'est-ce que je peux faire ». Ce qui
 * attend d'être traité — un rendez-vous à confirmer, une demande sans réponse —
 * passe en tuile d'alerte plutôt que de se cacher au bas d'une liste.
 */
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
  // Une seule passe pour tous les dossiers : le coût ne dépend pas du nombre
  // de logements.
  const journeys = await reviewMany(properties);

  const byDate = <T extends { createdAt: string }>(list: T[]) =>
    [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const live = properties.filter((property) => property.status === 'published');
  const views = properties.reduce((total, property) => total + property.views, 0);
  const pendingLeads = leads.filter((lead) => !lead.handled).length;
  const nextAppointments = upcoming(appointments, new Date());
  const toConfirm = nextAppointments.filter((appointment) => appointment.status === 'demande').length;
  const waiting = pendingLeads + toConfirm;

  return (
    <div className="pro">
      <AdminBar current="/admin" toConfirm={toConfirm} />

      <main className="pro-page">
        <ProHead
          title="Tableau de bord"
          sub={
            waiting > 0
              ? `${waiting} chose${waiting > 1 ? 's' : ''} vous attend${waiting > 1 ? 'ent' : ''}.`
              : 'Rien en attente. Tout est traité.'
          }
          actions={<NewPropertyForm />}
        />

        <StatBand>
          <Stat
            label="Logements"
            value={properties.length}
            hint={`${live.length} en ligne`}
          />
          <Stat label="Vues cumulées" value={views} hint="Toutes visites confondues" />
          <Stat
            label="Rendez-vous"
            value={nextAppointments.length}
            hint={toConfirm > 0 ? `${toConfirm} à confirmer` : 'Tous confirmés'}
            alert={toConfirm > 0}
          />
          <Stat
            label="Demandes"
            value={pendingLeads}
            hint={pendingLeads > 0 ? 'Sans réponse' : 'Toutes traitées'}
            alert={pendingLeads > 0}
          />
        </StatBand>

        {isLocalStore() && (
          <p className="pro-notice">
            <span>
              <strong>Mode développement.</strong> Les données sont enregistrées dans <code>.data/</code>
              et disparaîtront au prochain déploiement. Renseignez <code>SUPABASE_URL</code> et{' '}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> pour passer sur la base hébergée.
            </span>
          </p>
        )}

        {/* ---------------------------------------------------- logements --- */}
        <Section title="Logements" note="visites réelles, scannées sur place">
          {properties.length === 0 ? (
            <Empty title="Aucun logement pour l’instant" action={<NewPropertyForm />}>
              Créez-en un, envoyez le plan et les photos de chaque pièce, puis publiez. Le lien de visite
              se génère tout seul.
            </Empty>
          ) : (
            <div className="pro-grid">
              {byDate(properties).map((property) => (
                <PropertyTile
                  key={property.id}
                  property={property}
                  href={`/admin/logements/${property.id}`}
                  journey={journeys.get(property.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ------------------------------------------------------ aperçus --- */}
        <Section
          title="Aperçus de démarchage"
          note="simulations, privées et temporaires"
          action={<NewPreviewForm aiConfigured={isAiConfigured()} />}
        >
          {previews.length === 0 ? (
            <Empty title="Aucun aperçu">
              Partez des photos publiques d’une annonce pour montrer à son propriétaire ce que donnerait
              une visite — en lui indiquant clairement qu’il s’agit d’une simulation.
            </Empty>
          ) : (
            <div className="pro-panel pro-rows">
              {byDate(previews).map((preview) => (
                <PreviewRow key={preview.id} preview={preview} origin={origin} />
              ))}
            </div>
          )}
        </Section>

        {/* ----------------------------------------------------- demandes --- */}
        <Section title="Demandes reçues" note="formulaire de la page d’accueil">
          {leads.length === 0 ? (
            <Empty title="Aucune demande pour l’instant">
              Les messages laissés depuis la page d’accueil arrivent ici. Les rendez-vous, eux, ont leur
              propre page.
            </Empty>
          ) : (
            <div className="pro-panel pro-rows">
              {byDate(leads).map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}
