'use client';

import { useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { prefillFacts, saveFacts, type ActionResult } from '@/app/admin/actions';
import { FACT_QUESTIONS, reviewFacts } from '@/lib/facts';
import type { IntakeReport } from '@/lib/intake';
import type { PropertyFact } from '@/lib/types';

/**
 * Fiche de renseignements du logement, et état d'avancement du dossier.
 *
 * Deux blocs, dans cet ordre : ce qu'il reste à fournir, puis les questions.
 * Le premier dit toujours *quoi faire* — « il manque une photo de la chambre »
 * plutôt que « dossier incomplet ». Le second est pré-rempli par la lecture des
 * photos, et chaque proposition est signalée comme telle jusqu'à confirmation.
 */
export function FactsPanel({
  propertyId,
  facts,
  intake,
  readerConfigured,
  hasPhotos,
}: {
  propertyId: string;
  facts: PropertyFact[];
  intake: IntakeReport;
  readerConfigured: boolean;
  hasPhotos: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const review = reviewFacts(facts);
  const byKey = new Map(facts.map((fact) => [fact.key, fact]));

  const [state, action, saving] = useActionState<ActionResult | null, FormData>(
    async (previous, formData) => {
      const result = await saveFacts(previous, formData);
      if (result.ok) router.refresh();
      return result;
    },
    null,
  );

  const blocking = intake.gaps.filter((gap) => gap.severity === 'blocking');
  const advice = intake.gaps.filter((gap) => gap.severity === 'advice');

  return (
    <>
      <section className="card">
        <h2 className="admin-h2">
          Ce qu’il reste à faire <small>avant de publier</small>
        </h2>

        {intake.ready && review.ready ? (
          <div className="note">
            <strong>Le dossier est complet.</strong> Vous pouvez publier la visite.
          </div>
        ) : (
          <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {blocking.map((gap) => (
              <li key={gap.code + (gap.roomId ?? '')} className="callout-box callout-warn">
                {gap.message}
              </li>
            ))}
            {!review.ready && (
              <li className="callout-box callout-warn">
                Complétez la fiche ci-dessous : {review.unanswered.filter((q) => q.required).length} réponse(s)
                obligatoire(s) manquante(s).
              </li>
            )}
            {advice.map((gap) => (
              <li key={gap.code} className="note">
                {gap.message}
              </li>
            ))}
          </ul>
        )}

        <p className="tiny" style={{ marginTop: 12 }}>
          Photos : {Math.round(intake.coverage * 100)} % des pièces couvertes · Fiche :{' '}
          {Math.round(review.progress * 100)} % des réponses obligatoires
        </p>
      </section>

      <section className="card">
        <h2 className="admin-h2">
          Fiche du logement <small>elle nourrit la présentation et l’assistant</small>
        </h2>

        <div className="row" style={{ marginBottom: 16 }}>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={pending || !readerConfigured || !hasPhotos}
            onClick={() =>
              start(async () => {
                await prefillFacts(propertyId);
                router.refresh();
              })
            }
          >
            {pending ? 'Lecture des photos…' : 'Pré-remplir depuis les photos'}
          </button>
          <span className="tiny">
            {!readerConfigured
              ? 'Lecture automatique non configurée.'
              : !hasPhotos
                ? 'Ajoutez des photos pour activer le pré-remplissage.'
                : 'L’IA répond à ce qui se voit ; vous vérifiez.'}
          </span>
        </div>

        {review.toConfirm.length > 0 && (
          <div className="note" style={{ marginBottom: 16 }}>
            <strong>{review.toConfirm.length} réponse(s) proposée(s) d’après vos photos.</strong> Elles
            n’apparaîtront ni dans la présentation ni dans les réponses de l’assistant tant que vous ne les
            avez pas enregistrées.
          </div>
        )}

        <form action={action} className="form-grid">
          <input type="hidden" name="propertyId" value={propertyId} />

          {FACT_QUESTIONS.map((question) => {
            const fact = byKey.get(question.key);
            const proposed = fact?.source === 'ia';
            const chosen = new Set((fact?.value ?? '').split(',').map((part) => part.trim()));

            const title = (
              <>
                {question.label}
                {question.required && ' *'}
                {proposed && <span className="tag tag-demo" style={{ marginLeft: 8 }}>Proposé</span>}
              </>
            );

            /* Un choix multiple n'a pas de champ unique à désigner : un `for`
               pointerait dans le vide. C'est le rôle de fieldset/legend, qui
               annonce le groupe avant d'énumérer les cases. */
            if (question.kind === 'multi' && question.options) {
              return (
                <fieldset className="field field-group" key={question.key}>
                  <legend>{title}</legend>
                  <div className="row" style={{ gap: 10 }}>
                    {question.options.map((option) => (
                      <label key={option} className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <input
                          type="checkbox"
                          name={`fait-${question.key}`}
                          value={option}
                          defaultChecked={chosen.has(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {question.help && <p className="hint">{question.help}</p>}
                </fieldset>
              );
            }

            return (
              <div className="field" key={question.key}>
                <label htmlFor={`fait-${question.key}`}>{title}</label>

                {question.kind === 'choice' && question.options ? (
                  <select id={`fait-${question.key}`} name={`fait-${question.key}`} defaultValue={fact?.value ?? ''}>
                    <option value="">— à renseigner —</option>
                    {question.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`fait-${question.key}`}
                    name={`fait-${question.key}`}
                    type="text"
                    maxLength={400}
                    defaultValue={fact?.value ?? ''}
                  />
                )}

                {question.help && <p className="hint">{question.help}</p>}
              </div>
            );
          })}

          {state && !state.ok && <div className="callout-box callout-warn">{state.error}</div>}

          <div className="row">
            <button className="btn btn-dark btn-sm" type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer la fiche'}
            </button>
            <span className="tiny">
              Les réponses enregistrées alimentent la présentation publique et l’assistant des visites.
            </span>
          </div>
        </form>
      </section>
    </>
  );
}
