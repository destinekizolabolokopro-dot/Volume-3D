'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tag } from '@/components/pro/Pro';
import { CopyField } from '@/components/CopyField';
import type { Lead, Preview } from '@/lib/types';
import {
  createPreview,
  createProperty,
  deleteLead,
  deletePreview,
  toggleLead,
  type ActionResult,
} from './actions';

/* ------------------------------------------------------ nouveau logement --- */

export function NewPropertyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (previous, formData) => {
      const result = await createProperty(previous, formData);
      if (result.ok && result.id) router.push(`/admin/logements/${result.id}`);
      return result;
    },
    null,
  );

  if (!open) {
    return (
      <button type="button" className="btn btn-accent btn-sm" onClick={() => setOpen(true)}>
        Nouveau logement
      </button>
    );
  }

  return (
    <form action={formAction} className="card stack" style={{ marginTop: 14 }}>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="np-name">Nom du logement *</label>
          <input id="np-name" name="name" required maxLength={140} placeholder="Appartement lumineux — Le Marais" />
        </div>
        <div className="field">
          <label htmlFor="np-city">Ville</label>
          <input id="np-city" name="city" maxLength={120} placeholder="Paris 3e" />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="np-owner">Propriétaire</label>
          <input id="np-owner" name="ownerName" maxLength={140} />
        </div>
        <div className="field">
          <label htmlFor="np-email">Email du propriétaire</label>
          <input id="np-email" name="ownerEmail" type="email" maxLength={200} />
        </div>
      </div>

      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}

      <div className="row">
        <button className="btn btn-accent btn-sm" type="submit" disabled={pending}>
          {pending ? 'Création…' : 'Créer et ouvrir l’éditeur'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------- aperçu simulé --- */

export function NewPreviewForm({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createPreview, null);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Nouvel aperçu
      </button>
    );
  }

  return (
    <form action={formAction} className="card stack" style={{ marginTop: 14 }}>
      <div className="callout-box callout-warn">
        <strong>Document commercial, non contractuel.</strong> Les vues produites ici sont partiellement inventées par
        l’IA. Elles s’affichent avec filigrane et avertissement, et ne doivent être montrées qu’au propriétaire —
        jamais à un voyageur, jamais sur une annonce.
      </div>

      {!aiConfigured && (
        <div className="callout-box">
          Aucune clé d’API image n’est configurée : l’aperçu affichera les photos d’origine dans l’habillage Volume3D,
          sans extension IA. Ajoutez <code>GOOGLE_AI_API_KEY</code> dans <code>.env.local</code> pour activer la
          génération.
        </div>
      )}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="pv-name">Nom du logement *</label>
          <input id="pv-name" name="propertyName" required maxLength={140} placeholder="Studio cosy centre-ville" />
        </div>
        <div className="field">
          <label htmlFor="pv-city">Ville</label>
          <input id="pv-city" name="city" maxLength={120} />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="pv-listing">Lien de l’annonce</label>
          <input id="pv-listing" name="listingUrl" type="url" placeholder="https://www.airbnb.fr/rooms/…" />
        </div>
        <div className="field">
          <label htmlFor="pv-email">Email du prospect</label>
          <input id="pv-email" name="ownerEmail" type="email" maxLength={200} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pv-photos">Photos de l’annonce (8 maximum) *</label>
        <div className="file-drop">
          <input id="pv-photos" name="photos" type="file" accept="image/*" multiple required />
          <p className="tiny" style={{ margin: '8px 0 0' }}>
            Enregistrez les photos depuis l’annonce publique du prospect. La génération prend quelques dizaines de
            secondes par photo.
          </p>
        </div>
      </div>

      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}

      <div className="row">
        <button className="btn btn-accent btn-sm" type="submit" disabled={pending}>
          {pending ? 'Génération en cours…' : 'Générer l’aperçu'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------- lignes listées --- */

export function PreviewRow({ preview, origin }: { preview: Preview; origin: string }) {
  const [pending, start] = useTransition();
  const expired = Date.parse(preview.expiresAt) < Date.now();

  /* Une ligne dans un bloc, pas une carte : la carte est déjà autour. */
  return (
    <div>
      <div className="pro-row-top">
        <div>
          <p className="pro-row-title">{preview.propertyName}</p>
          <p className="pro-row-sub">
            {preview.city ? `${preview.city} · ` : ''}
            {preview.views} vue{preview.views > 1 ? 's' : ''} ·{' '}
            {expired ? 'lien expiré' : `expire le ${new Date(preview.expiresAt).toLocaleDateString('fr-FR')}`}
          </p>
        </div>
        <div className="pro-row-side">
          <Tag tone="demo">Aperçu simulé</Tag>
          <button
            type="button"
            className="mini-btn mini-btn-danger"
            title="Supprimer cet aperçu"
            disabled={pending}
            onClick={() => {
              if (confirm(`Supprimer l’aperçu « ${preview.propertyName} » ? Le lien cessera de fonctionner.`)) {
                start(() => void deletePreview(preview.id));
              }
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {preview.error && <p className="pro-row-warn">{preview.error}</p>}

      {!expired && (
        <div style={{ marginTop: 12 }}>
          <CopyField value={`${origin}/demo/${preview.token}`} label={preview.id} name="le lien de l’aperçu" />
        </div>
      )}

      {preview.listingUrl && (
        <a className="pro-row-link" href={preview.listingUrl} target="_blank" rel="noopener noreferrer">
          Voir l’annonce d’origine ↗
        </a>
      )}
    </div>
  );
}

export function LeadRow({ lead }: { lead: Lead }) {
  const [pending, start] = useTransition();

  return (
    <div data-handled={lead.handled ? '1' : undefined} className="pro-row">
      <div className="pro-row-top">
        <div>
          <p className="pro-row-title">
            {lead.name} · <a href={`mailto:${lead.email}`}>{lead.email}</a>
          </p>
          <p className="pro-row-sub">
            {lead.city} · {lead.profile} · {lead.phone || 'sans téléphone'} ·{' '}
            {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="pro-row-side">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => start(() => void toggleLead(lead.id, !lead.handled))}
          >
            {lead.handled ? 'À rappeler' : 'Traité ✓'}
          </button>
          <button
            type="button"
            className="mini-btn mini-btn-danger"
            title="Supprimer"
            disabled={pending}
            onClick={() => {
              if (confirm(`Supprimer la demande de ${lead.name} ?`)) start(() => void deleteLead(lead.id));
            }}
          >
            ✕
          </button>
        </div>
      </div>
      {lead.message && <p className="pro-row-quote">{lead.message}</p>}
    </div>
  );
}
