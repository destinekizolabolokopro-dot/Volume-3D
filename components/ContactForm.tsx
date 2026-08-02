'use client';

import { useState } from 'react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('sending');
    setMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Envoi impossible.');
      form.reset();
      setStatus('sent');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Envoi impossible.');
    }
  }

  if (status === 'sent') {
    return (
      <div className="form-feedback form-feedback-ok" role="status">
        <strong>Demande bien reçue.</strong> Nous revenons vers vous sous 24h pour convenir d’un créneau de scan.
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate={false}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Votre nom</label>
          <input id="name" name="name" type="text" required autoComplete="name" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" maxLength={200} />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="phone">Téléphone (facultatif)</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="city">Ville du logement</label>
          <input id="city" name="city" type="text" required maxLength={120} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="profile">Vous êtes</label>
        <select id="profile" name="profile" defaultValue="proprietaire">
          <option value="proprietaire">Propriétaire d’un ou deux logements</option>
          <option value="multi">Propriétaire de plusieurs logements</option>
          <option value="conciergerie">Conciergerie</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="message">Votre logement en deux mots (facultatif)</label>
        <textarea id="message" name="message" maxLength={2000} placeholder="T2 de 40 m² au 3e étage, deux chambres…" />
      </div>

      {/* Champ leurre : invisible à l'écran, seuls les robots le remplissent. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && (
        <div className="form-feedback form-feedback-error" role="alert">
          {message}
        </div>
      )}

      <button className="btn btn-accent" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Envoi…' : 'Demander un créneau'}
      </button>

      <p className="form-note">
        Réponse sous 24h. Vos coordonnées servent uniquement à vous recontacter, elles ne sont jamais revendues.
      </p>
    </form>
  );
}
