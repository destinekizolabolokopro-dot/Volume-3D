import { AdminBar } from '@/components/pro/AdminBar';
import { Empty, ProHead, Section, Tag } from '@/components/pro/Pro';
import { channelLabel, slotLabel, upcoming, type Appointment } from '@/lib/booking';
import { requireAuth } from '@/lib/require-auth';
import { getStore } from '@/lib/store';
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
    <div className="pro">
      <AdminBar current="/admin/rendez-vous" toConfirm={waiting} />

      <main className="pro-page">
        <ProHead
          title="Rendez-vous"
          sub="Pris depuis la page d’accueil. Aucun e-mail de confirmation n’est envoyé pour l’instant : cette page est le seul endroit où vous les voyez arriver."
        />

        <Section
          title="À venir"
          note={next.length === 0 ? 'aucun' : `${next.length} · ${waiting} à confirmer`}
        >
          {next.length === 0 ? (
            <Empty title="Rien de prévu">
              Les rendez-vous pris depuis la page d’accueil arriveront ici, le plus proche en premier.
            </Empty>
          ) : (
            <div className="pro-panel pro-rows">
              {next.map((appointment) => (
                <AppointmentRow key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </Section>

        {past.length > 0 && (
          <Section title="Passés et annulés" note={String(past.length)}>
            <div className="pro-panel pro-rows">
              {past.slice(0, 25).map((appointment) => (
                <AppointmentRow key={appointment.id} appointment={appointment} past />
              ))}
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}

function AppointmentRow({ appointment, past = false }: { appointment: Appointment; past?: boolean }) {
  const state =
    appointment.status === 'annule'
      ? { tone: 'draft' as const, label: 'Annulé' }
      : appointment.status === 'confirme'
        ? { tone: 'live' as const, label: 'Confirmé' }
        : { tone: 'warn' as const, label: 'À confirmer' };

  return (
    <article>
      <div className="pro-row-top">
        <div>
          <p className="pro-row-title">{slotLabel(appointment.slot)}</p>
          <p className="pro-row-sub">
            {appointment.name} · {channelLabel(appointment.channel)}
            {appointment.city ? ` · ${appointment.city}` : ''}
            {appointment.listings > 0
              ? ` · ${appointment.listings} logement${appointment.listings > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
        <Tag tone={state.tone}>{state.label}</Tag>
      </div>

      {/* Le numéro d'abord : c'est par là que ça commence, et depuis un
          téléphone le lien compose directement. */}
      <p className="pro-row-links">
        <a href={`tel:${appointment.phone.replace(/\s/g, '')}`}>{appointment.phone}</a>
        <a href={`mailto:${appointment.email}`}>{appointment.email}</a>
      </p>

      {appointment.message && <p className="pro-row-quote">{appointment.message}</p>}

      {!past && (
        <div className="pro-row-actions">
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
