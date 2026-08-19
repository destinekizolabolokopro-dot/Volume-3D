'use client';

import { useMemo, useState } from 'react';
import { CHANNELS, sentence, slotLabel, type Day } from '@/lib/booking';
import { CONTACT_EMAIL } from '@/lib/content';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export interface BookingFormProps {
  /** Créneaux calculés par le serveur au rendu de la page. */
  days: Day[];
}

/**
 * Le formulaire de rendez-vous.
 *
 * Un détail qui n'en est pas un : quand le serveur répond que le créneau vient
 * d'être pris, il renvoie **la liste à jour** avec son refus. Le formulaire
 * l'affiche aussitôt, et la personne rechoisit sans recharger. C'est la
 * différence entre une course perdue et une page cassée.
 */
export function BookingForm({ days: initial }: BookingFormProps) {
  const [days, setDays] = useState(initial);
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState('');

  const day = days[Math.min(dayIndex, days.length - 1)];
  const chosen = useMemo(
    () => days.flatMap((entry) => entry.slots).find((entry) => entry.start === slot),
    [days, slot],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!slot) {
      setStatus('error');
      setMessage('Choisissez d’abord un créneau.');
      return;
    }
    setStatus('sending');
    setMessage('');

    try {
      const response = await fetch('/api/rendez-vous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(form).entries()), slot }),
      });
      const body = (await response.json()) as { error?: string; slot?: string; days?: Day[] };
      if (!response.ok) {
        if (body.days) {
          setDays(body.days);
          setSlot('');
        }
        throw new Error(body.error ?? 'Enregistrement impossible.');
      }
      setConfirmed(body.slot || slotLabel(slot));
      setStatus('sent');
      form.reset();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  }

  /* Aucun e-mail automatique n'est envoyé : il n'y a pas d'expéditeur configuré
     dans ce projet. On ne promet donc pas de confirmation — on dit ce qui va
     réellement se passer, et on donne de quoi joindre en cas d'imprévu. */
  if (status === 'sent') {
    return (
      <div className="form-feedback form-feedback-ok" role="status">
        <strong>C’est noté pour {confirmed}.</strong> Le créneau est réservé, je vous contacte à
        l’heure dite. Un imprévu&nbsp;? Écrivez à{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> et on décale.
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="form-feedback form-feedback-error" role="status">
        <strong>Aucun créneau disponible pour l’instant.</strong> Écrivez-moi directement, on trouvera
        un moment.
      </div>
    );
  }

  return (
    <form className="form booking" onSubmit={onSubmit}>
      <fieldset className="booking-slots">
        <legend>Choisissez un créneau</legend>

        <div className="booking-days" role="group" aria-label="Jour du rendez-vous">
          {days.map((entry, index) => (
            <button
              key={entry.date}
              type="button"
              className="booking-day"
              aria-pressed={index === dayIndex}
              onClick={() => setDayIndex(index)}
            >
              {sentence(entry.label)}
            </button>
          ))}
        </div>

        <div className="booking-hours" role="group" aria-label={`Créneaux du ${day.label}`}>
          {day.slots.map((entry) => (
            <button
              key={entry.start}
              type="button"
              className="booking-hour"
              disabled={!entry.free}
              aria-pressed={entry.start === slot}
              onClick={() => setSlot(entry.start)}
            >
              {entry.label}
              {entry.free ? '' : ' · pris'}
            </button>
          ))}
        </div>

        <p className="booking-chosen" role="status">
          {chosen ? (
            <>
              Rendez-vous&nbsp;: <strong>{slotLabel(chosen.start)}</strong>, 30 minutes.
            </>
          ) : (
            'Aucun créneau sélectionné pour l’instant.'
          )}
        </p>
      </fieldset>

      <fieldset className="field-group">
        <legend>Comment vous joindre</legend>
        {CHANNELS.map((channel, index) => (
          <label key={channel.value} className="check">
            <input
              type="radio"
              name="channel"
              value={channel.value}
              defaultChecked={index === 0}
            />
            <span>
              {channel.label} <em>{channel.help}</em>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="form-row">
        <div className="field">
          <label htmlFor="rdv-name">Votre nom</label>
          <input id="rdv-name" name="name" type="text" required autoComplete="name" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="rdv-phone">Téléphone</label>
          <input id="rdv-phone" name="phone" type="tel" required autoComplete="tel" maxLength={40} />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="rdv-email">E-mail</label>
          <input id="rdv-email" name="email" type="email" required autoComplete="email" maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="rdv-city">Ville du logement</label>
          <input id="rdv-city" name="city" type="text" maxLength={120} autoComplete="address-level2" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="rdv-listings">Combien de logements&nbsp;?</label>
        <input
          id="rdv-listings"
          name="listings"
          type="number"
          min={0}
          max={500}
          defaultValue={1}
          inputMode="numeric"
        />
      </div>

      <div className="field">
        <label htmlFor="rdv-message">Quelque chose à préciser&nbsp;? (facultatif)</label>
        <textarea
          id="rdv-message"
          name="message"
          maxLength={1200}
          placeholder="T2 de 40 m² au 3e étage, loué presque en continu…"
        />
      </div>

      {/* Champ leurre : invisible à l'écran, seuls les robots le remplissent. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="rdv-website">Ne pas remplir</label>
        <input id="rdv-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && (
        <div className="form-feedback form-feedback-error" role="alert">
          {message}
        </div>
      )}

      <button className="btn btn-accent" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Enregistrement…' : 'Réserver ce créneau'}
      </button>

      <p className="form-note">
        Trente minutes, sans engagement. Vos coordonnées servent uniquement à ce rendez-vous, elles ne
        sont jamais revendues.
      </p>
    </form>
  );
}
