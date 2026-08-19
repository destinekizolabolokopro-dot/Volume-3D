'use client';

import { useActionState, useState } from 'react';
import { signin, signup, type OwnerResult } from '../actions';

const PLANS = [
  { id: 'essentiel', name: 'Essentiel', price: '29€ /mois', note: '1 logement, visite 360° + vidéo, assistant inclus.' },
  { id: 'pro', name: 'Pro', price: '79€ /mois', note: 'Jusqu’à 5 logements, statistiques détaillées.' },
  { id: 'conciergerie', name: 'Conciergerie', price: 'Sur devis', note: 'Logements illimités, interlocuteur dédié.' },
];

export function AuthForms() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loginState, loginAction, loginPending] = useActionState<OwnerResult | null, FormData>(signin, null);
  const [joinState, joinAction, joinPending] = useActionState<OwnerResult | null, FormData>(signup, null);

  return (
    <>
      <div className="auth-switch" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>
          J’ai un compte
        </button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
          Créer un compte
        </button>
      </div>

      {mode === 'signin' ? (
        <form action={loginAction} className="form-grid">
          <div className="field">
            <label htmlFor="in-email">Email</label>
            <input id="in-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="in-password">Mot de passe</label>
            <input id="in-password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {loginState?.error && (
            <div className="form-feedback form-feedback-error" role="alert">
              {loginState.error}
            </div>
          )}
          <button className="btn btn-accent" type="submit" disabled={loginPending}>
            {loginPending ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      ) : (
        <form action={joinAction} className="form-grid">
          <div className="form-two">
            <div className="field">
              <label htmlFor="up-name">Votre nom *</label>
              <input id="up-name" name="name" required maxLength={140} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="up-company">Société (facultatif)</label>
              <input id="up-company" name="company" maxLength={140} autoComplete="organization" />
            </div>
          </div>

          <div className="form-two">
            <div className="field">
              <label htmlFor="up-email">Email *</label>
              <input id="up-email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="up-phone">Téléphone</label>
              <input id="up-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="up-password">Mot de passe *</label>
            <input
              id="up-password"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
            <p className="hint">Dix caractères minimum.</p>
          </div>

          <div className="field">
            <label>Votre formule</label>
            <div className="plans">
              {PLANS.map((plan, index) => (
                <label className="plan" key={plan.id}>
                  <input type="radio" name="plan" value={plan.id} defaultChecked={index === 0} />
                  <span className="plan-name">{plan.name}</span>
                  <div className="plan-price">{plan.price}</div>
                  <div className="plan-note">{plan.note}</div>
                </label>
              ))}
            </div>
            <p className="hint">
              Aucun paiement n’est demandé ici : nous vous recontactons pour mettre en place l’abonnement.
            </p>
          </div>

          {joinState?.error && (
            <div className="form-feedback form-feedback-error" role="alert">
              {joinState.error}
            </div>
          )}

          <button className="btn btn-accent" type="submit" disabled={joinPending}>
            {joinPending ? 'Création…' : 'Créer mon espace'}
          </button>
        </form>
      )}
    </>
  );
}
