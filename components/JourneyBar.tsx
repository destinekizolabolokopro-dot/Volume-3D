import type { Journey } from '@/lib/journey';

/**
 * Le parcours du bien, en une bande au-dessus de l'éditeur.
 *
 * Elle répond à une seule question, celle qu'un propriétaire se pose en
 * arrivant : *où j'en suis, et qu'est-ce que je fais maintenant ?* D'où la
 * phrase sous les étapes — l'action précise, pas un pourcentage.
 *
 * Rien n'y est cliquable, et c'est volontaire : les étapes ne verrouillent
 * rien, tout est modifiable dans n'importe quel ordre plus bas dans la page.
 * Une bande qui prétendrait naviguer promettrait un cheminement contraint que
 * l'éditeur n'impose pas.
 */
export function JourneyBar({ journey }: { journey: Journey }) {
  const done = journey.steps.filter((step) => step.state === 'done').length;

  return (
    <section className="journey" aria-label="Avancement du dossier">
      <ol className="journey-steps">
        {journey.steps.map((step) => (
          <li key={step.key} className={`journey-step journey-step-${step.state}`}>
            <span className="journey-dot" aria-hidden="true">
              {step.state === 'done' ? '✓' : ''}
            </span>
            <span className="journey-label">{step.label}</span>
            {step.state === 'current' && <span className="sr-only"> — étape en cours</span>}
          </li>
        ))}
      </ol>

      <p className="journey-todo">
        {journey.current ? (
          <>
            <strong>Prochaine étape — {journey.current.label.toLowerCase()} :</strong> {journey.current.todo}
          </>
        ) : (
          <strong>La visite est en ligne. Le dossier est complet.</strong>
        )}
      </p>

      <p className="tiny">
        {done} étape{done > 1 ? 's' : ''} sur {journey.steps.length}.
      </p>
    </section>
  );
}
