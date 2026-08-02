'use client';

import { useActionState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  confirmPlan,
  deletePlan,
  readPropertyPlan,
  sortPhotosIntoPlan,
  type ActionResult,
} from '@/app/admin/actions';
import { roomArea, totalArea } from '@/lib/plan';
import type { FloorPlan, Photo, PlanDoor } from '@/lib/types';

/**
 * Reconstruction d'une visite à partir du plan du logement.
 *
 * Ce panneau existe pour un cas précis : le propriétaire n'a pas de panorama
 * 360°, mais il a son plan et ses photos. Le plan donne les dimensions, les
 * photos donnent l'apparence — assemblés, ils font une visite parcourable où
 * rien n'est inventé.
 *
 * Le relevé automatique n'est jamais publié tel quel. Il s'affiche ici, pièce
 * par pièce, avec les surfaces obtenues, et le propriétaire confirme. C'est lui
 * qui connaît son logement ; le modèle, lui, peut mal lire une cote.
 */
export function PlanPanel({
  propertyId,
  plan,
  doors,
  photos,
  readerConfigured,
}: {
  propertyId: string;
  plan: FloorPlan | null;
  doors: PlanDoor[];
  photos: Photo[];
  readerConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const [state, action, reading] = useActionState<ActionResult | null, FormData>(
    async (previous, formData) => {
      const result = await readPropertyPlan(previous, formData);
      if (result.ok) {
        form.current?.reset();
        router.refresh();
      }
      return result;
    },
    null,
  );

  const attached = photos.filter((photo) => photo.roomId).length;
  const measured = plan ? totalArea(plan.rooms) : 0;
  const passages = doors.filter((door) => door.kind !== 'window' && door.to).length;

  return (
    <section className="card">
      <h2 className="admin-h2">
        Visite depuis le plan <small>quand il n’y a pas de panorama 360°</small>
      </h2>

      {!readerConfigured && (
        <div className="callout-box callout-warn">
          La lecture automatique demande une clé Anthropic (<code>ANTHROPIC_API_KEY</code>). Sans elle, ce
          format reste indisponible.
        </div>
      )}

      {!plan && (
        <p className="muted">
          Envoyez le plan du logement : on en tire les dimensions de chaque pièce et un volume que le
          voyageur peut parcourir. Vos photos viennent ensuite s’accrocher sur les murs qu’elles montrent.
        </p>
      )}

      <form ref={form} action={action} className="stack" style={{ marginTop: 14 }}>
        <input type="hidden" name="propertyId" value={propertyId} />

        <div className="grid-2">
          <div className="field">
            <label htmlFor="plan-file">Image du plan</label>
            <input id="plan-file" name="plan" type="file" accept="image/*" required disabled={!readerConfigured} />
          </div>
          <div className="field">
            <label htmlFor="plan-area">Surface annoncée (m²)</label>
            <input
              id="plan-area"
              name="area"
              type="number"
              min={5}
              max={2000}
              step="0.5"
              required
              disabled={!readerConfigured}
              placeholder="42"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="plan-hint">Précisions (facultatif)</label>
          <input
            id="plan-hint"
            name="hint"
            type="text"
            maxLength={400}
            disabled={!readerConfigured}
            placeholder="La petite pièce du fond est un cellier, pas une chambre."
          />
          <p className="hint">
            La surface sert de mètre étalon : les proportions viennent du plan, l’échelle vient de vous.
          </p>
        </div>

        <div className="row">
          <button className="btn btn-dark btn-sm" type="submit" disabled={reading || !readerConfigured}>
            {reading ? 'Lecture du plan…' : plan ? 'Relire le plan' : 'Lire le plan'}
          </button>
          {reading && <span className="tiny">Comptez une trentaine de secondes.</span>}
        </div>

        {state && !state.ok && <div className="callout-box callout-warn">{state.error}</div>}
      </form>

      {plan && (
        <>
          <div className="row row-between" style={{ marginTop: 22 }}>
            <strong>{plan.rooms.length} pièces relevées</strong>
            <span className="tiny">
              {measured.toFixed(1)} m² mesurés · {passages} passage(s) · lu par {plan.readBy}
            </span>
          </div>

          <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
            {plan.rooms.map((room) => {
              const inside = photos.filter((photo) => photo.roomId === room.id).length;
              return (
                <li key={room.id} className="row row-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  <span>{room.name}</span>
                  <span className="tiny">
                    {roomArea(room).toFixed(1)} m² · {room.height.toFixed(2)} m sous plafond ·{' '}
                    {inside > 0 ? `${inside} photo(s)` : 'aucune photo'}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="row" style={{ marginTop: 16 }}>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={pending || photos.length === 0 || !readerConfigured}
              onClick={() => start(async () => {
                await sortPhotosIntoPlan(propertyId);
                router.refresh();
              })}
            >
              Ranger les photos dans les pièces
            </button>
            <span className="tiny">
              {attached}/{photos.length} photo(s) rattachée(s)
            </span>
          </div>

          <div className="note" style={{ marginTop: 16 }}>
            {plan.confirmed ? (
              <>
                <strong>Relevé confirmé.</strong> Le format « Plan 3D » est visible par vos voyageurs.
              </>
            ) : (
              <>
                <strong>À relire avant publication.</strong> Vérifiez les surfaces ci-dessus : elles viennent
                d’une lecture automatique. Tant que vous n’avez pas confirmé, ce format n’apparaît pas dans
                la visite.
              </>
            )}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button
              className={plan.confirmed ? 'btn btn-ghost btn-sm' : 'btn btn-dark btn-sm'}
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                await confirmPlan(plan.id, !plan.confirmed);
                router.refresh();
              })}
            >
              {plan.confirmed ? 'Retirer de la visite' : 'Confirmer et publier ce format'}
            </button>
            <button
              className="mini-btn mini-btn-danger"
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                await deletePlan(plan.id);
                router.refresh();
              })}
            >
              Supprimer le plan
            </button>
          </div>
        </>
      )}
    </section>
  );
}
