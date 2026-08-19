'use client';

import { useActionState } from 'react';
import { login } from '../actions';
import type { ActionResult } from '../actions';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(login, null);

  return (
    <form action={formAction} className="stack">
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
      </div>

      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}

      <button className="btn btn-accent" type="submit" disabled={pending}>
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
