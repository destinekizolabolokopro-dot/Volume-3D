import { Reponse } from '@/components/juridique/Reponse';
import type { Tour } from '@/components/juridique/useConsultation';

/**
 * Le fil de la conversation. Rien d'autre que du rendu — l'état est dans
 * `useConsultation`, le découpage des réponses dans `lib/mise-en-forme.ts`.
 */
export function Fil({
  tours,
  pending,
  attente,
}: {
  tours: Tour[];
  pending: boolean;
  /** Ce qui s'affiche pendant l'attente : « Bail d'habitation examine… ». */
  attente: string;
}) {
  return (
    <div className="jur-fil">
      {tours.map((tour, index) => (
        <div
          key={index}
          className={`jur-tour ${tour.role === 'user' ? 'jur-de-vous' : 'jur-de-lui'}`}
        >
          {tour.piece && (
            <span className="jur-piece">
              <span aria-hidden="true">📎</span> {tour.piece}
            </span>
          )}
          {tour.role === 'assistant' ? <Reponse texte={tour.content} /> : <p>{tour.content}</p>}
        </div>
      ))}

      {pending && (
        <div className="jur-tour jur-de-lui">
          <p className="jur-attente">{attente}</p>
        </div>
      )}
    </div>
  );
}
