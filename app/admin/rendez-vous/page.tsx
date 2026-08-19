import { LogoMark } from '@/components/Logo';
import { channelLabel, slotLabel, upcoming, type Appointment } from '@/lib/booking';
import { requireAuth } from '@/lib/require-auth';
import { getStore } from '@/lib/store';
import { logout } from '../actions';
import { setAppointmentStatus } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Les rendez-vous pris depuis le site.
 *
 * Aucun message n'est envoyé automatiquement : il n'y a pas d'expéditeur
 * configuré dans ce projet. Cette page est donc **le seul endroit** où l'on
 * apprend qu'un rendez-vous a été pris, et elle est écrite pour ça — le
 * prochain en haut, le numéro lisible d'un coup d'œil, et de quoi appeler en
 * un clic depuis un téléphone.
 */
export default async function AppointmentsPage() {
  await requireAuth();

  const all = await getStore().list('appointments');
  const now = new Date();
  const next = upcoming(all, now);
  const past = all
    .filter((appointment) => !next.includes(appointment))
    .sort((a, b) => b.slot.localeCompare(a.slot));
  const waiting = next.filter((appointment) => appointment.status === 'demande').length;

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
          <a href="/admin">← Tableau de bord</a>
          <form action={logout}>
            <button type="submit" className="btn btn-on-dark btn-sm">
              Déconnexion
            </button>
          </form>
        </nav>
      </header>

      <main className="admin-main">
        <h1 className="admin-h1">Rendez-vous</h1>
        <p className="admin-sub">
          Pris depuis la page d’accueil. Aucun e-mail de confirmation n’est envoyé pour l’instant : cette
          page est le seul endroit où vous les voyez arriver.
        </p>

        <section>
          <h2 className="admin-h2">
            À venir
            <small>
              {next.length === 0
                ? 'aucun'
                : `${next.length} · ${waiting} à confirmer`}
            </small>
          </h2>
          {next.length === 0 ? (
            <p className="empty">Rien de prévu. Les demandes arriveront ici.</p>
          ) : (
            <div className="stack">
              {next.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="admin-h2">
              Passés et annulés<small>{past.length}</small>
            </h2>
            <div className="stack">
              {past.slice(0, 25).map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} past />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function AppointmentCard({ appointment, past = false }: { appointment: Appointment; past?: boolean }) {
  const tag =
    appointment.status === 'annule'
      ? { className: 'tag tag-draft', label: 'Annulé' }
      : appointment.status === 'confirme'
        ? { className: 'tag tag-live', label: 'Confirmé' }
        : { className: 'tag tag-draft', label: 'À confirmer' };

  return (
    <article className="card">
      <div className="row row-between">
        <div>
          <p className="property-name">{slotLabel(appointment.slot)}</p>
          <p className="muted">
            {appointment.name} · {channelLabel(appointment.channel)}
            {appointment.city ? ` · ${appointment.city}` : ''}
            {appointment.listings > 0
              ? ` · ${appointment.listings} logement${appointment.listings > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
        <span className={tag.className}>{tag.label}</span>
      </div>

      <p className="row" style={{ marginTop: 12 }}>
        <a href={`tel:${appointment.phone.replace(/\s/g, '')}`}>{appointment.phone}</a>
        <a href={`mailto:${appointment.email}`}>{appointment.email}</a>
      </p>

      {appointment.message && <p className="muted">« {appointment.message} »</p>}

      {!past && (
        <div className="row" style={{ marginTop: 12 }}>
          {appointment.status !== 'confirme' && (
            <form action={setAppointmentStatus}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="status" value="confirme" />
              <button className="btn btn-sm" type="submit">
                Marquer confirmé
              </button>
            </form>
          )}
          {appointment.status !== 'annule' && (
            <form action={setAppointmentStatus}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="status" value="annule" />
              <button className="btn btn-sm btn-danger" type="submit">
                Annuler et libérer le créneau
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
