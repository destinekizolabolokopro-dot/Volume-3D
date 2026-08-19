'use client';

import { useActionState } from 'react';
import { updateAccount, type OwnerResult } from '../actions';
import type { Account } from '@/lib/types';

const PLANS = [
  { id: 'essentiel', name: 'Essentiel', price: '29€ /mois', note: '1 logement, visite 360° + vidéo, assistant inclus.' },
  { id: 'pro', name: 'Pro', price: '79€ /mois', note: 'Jusqu’à 5 logements, statistiques détaillées.' },
  { id: 'conciergerie', name: 'Conciergerie', price: 'Sur devis', note: 'Logements illimités, interlocuteur dédié.' },
];

export function AccountForm({ account, used, limit }: { account: Account; used: number; limit: number }) {
  const [state, action, pending] = useActionState<OwnerResult | null, FormData>(updateAccount, null);

  return (
    <form action={action} className="form-card form-grid">
      <div className="form-two">
        <div className="field">
          <label htmlFor="a-name">Votre nom</label>
          <input id="a-name" name="name" defaultValue={account.name} required maxLength={140} />
        </div>
        <div className="field">
          <label htmlFor="a-company">Société</label>
          <input id="a-company" name="company" defaultValue={account.company} maxLength={140} />
        </div>
      </div>

      <div className="form-two">
        <div className="field">
          <label htmlFor="a-email">Email</label>
          <input id="a-email" defaultValue={account.email} disabled />
          <p className="hint">Écrivez-nous pour changer d’adresse.</p>
        </div>
        <div className="field">
          <label htmlFor="a-phone">Téléphone</label>
          <input id="a-phone" name="phone" type="tel" defaultValue={account.phone} maxLength={40} />
        </div>
      </div>

      <div className="field">
        <label>Formule</label>
        <div className="plans">
          {PLANS.map((plan) => (
            <label className="plan" key={plan.id}>
              <input type="radio" name="plan" value={plan.id} defaultChecked={account.plan === plan.id} />
              <span className="plan-name">{plan.name}</span>
              <div className="plan-price">{plan.price}</div>
              <div className="plan-note">{plan.note}</div>
            </label>
          ))}
        </div>
        <p className="hint">
          Vous utilisez {used} bien{used > 1 ? 's' : ''}
          {limit !== Infinity && ` sur ${limit}`}. Un changement de formule est confirmé par nos soins avant
          facturation.
        </p>
      </div>

      {state?.ok && (
        <div className="form-feedback form-feedback-ok" role="status">
          Modifications enregistrées.
        </div>
      )}
      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}

      <button className="btn btn-accent" type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
