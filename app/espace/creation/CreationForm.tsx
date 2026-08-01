'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { addPhotos, createProperty, type ActionResult } from '@/app/admin/actions';

/**
 * Création d'un bien : les informations que le client a sous la main, sans
 * matériel ni compétence particulière — un nom, une ville, une description et
 * quelques photos. La visite 360° ou la vidéo s'ajoutent ensuite, dans la fiche.
 */
export function CreationForm() {
  const router = useRouter();

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (previous, formData) => {
    const created = await createProperty(previous, formData);
    if (!created.ok || !created.id) return created;

    // Les photos ne peuvent partir qu'une fois le bien créé : elles lui sont rattachées.
    const files = formData.getAll('photos').filter((entry) => entry instanceof File && entry.size > 0);
    if (files.length > 0) {
      const payload = new FormData();
      payload.set('propertyId', created.id);
      for (const file of files) payload.append('photos', file);
      const uploaded = await addPhotos(null, payload);
      if (!uploaded.ok) return { ok: false, error: `Bien créé, mais les photos n’ont pas pu être envoyées : ${uploaded.error}` };
    }

    router.push(`/espace/biens/${created.id}`);
    return created;
  }, null);

  return (
    <form action={action} className="form-card form-grid">
      <div className="form-two">
        <div className="field">
          <label htmlFor="c-name">Nom du bien *</label>
          <input id="c-name" name="name" required maxLength={140} placeholder="Appartement lumineux — Le Marais" />
        </div>
        <div className="field">
          <label htmlFor="c-city">Ville</label>
          <input id="c-city" name="city" maxLength={120} placeholder="Paris 3e" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="c-description">Description du bien</label>
        <textarea
          id="c-description"
          name="description"
          rows={6}
          maxLength={4000}
          placeholder="T2 de 42 m² au 3e étage avec ascenseur. Chambre séparée avec lit double, salon lumineux exposé sud, cuisine équipée. Proche métro Saint-Paul."
        />
        <p className="hint">
          Ce texte s’affiche sous la visite, et c’est aussi lui que l’assistant utilise pour répondre à vos
          voyageurs. Plus il est précis, moins vous recevrez de messages.
        </p>
      </div>

      <div className="field">
        <label htmlFor="c-photos">Photos du bien</label>
        <div className="drop">
          <input id="c-photos" name="photos" type="file" accept="image/*" multiple />
          <p className="hint">
            Vos photos habituelles d’annonce. Elles sont recompressées automatiquement et illustrent la page de
            visite. Ce ne sont pas les panoramas 360° — ceux-ci s’ajoutent dans la fiche du bien.
          </p>
        </div>
      </div>

      {state?.error && (
        <div className="form-feedback form-feedback-error" role="alert">
          {state.error}
        </div>
      )}

      <button className="btn btn-dark" type="submit" disabled={pending}>
        {pending ? 'Création…' : 'Créer le bien'}
      </button>
    </form>
  );
}
