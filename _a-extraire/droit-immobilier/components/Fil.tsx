import { Reponse } from '@/components/Reponse';
import { Sources } from '@/components/Sources';
import { Lecture } from '@/components/Voix';
import type { Tour } from '@/components/useConsultation';

/**
 * Le fil de la conversation. Rien d'autre que du rendu — l'état est dans
 * `useConsultation`, le découpage des réponses dans `lib/mise-en-forme.ts`.
 */
export function Fil({
  tours,
  pending,
  attente,
  restaures = 0,
}: {
  tours: Tour[];
  pending: boolean;
  /** Ce qui s'affiche pendant l'attente : « Bail d'habitation examine… ». */
  attente: string;
  /**
   * Combien de messages viennent de la base plutôt que de cette page.
   *
   * Sert au mode mains libres, et à lui seul : une réponse restaurée ne se lit
   * pas toute seule. Rouvrir une consultation de la semaine dernière n'est pas
   * demander à l'entendre — et le navigateur refuse de toute façon de parler
   * sans un geste, si bien que la lecture aurait échoué en silence tout en
   * armant le micro.
   */
  restaures?: number;
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
          {tour.role === 'assistant' && <Sources references={tour.references ?? []} />}
          {tour.role === 'assistant' && (
            <Lecture
              texte={tour.content}
              dernier={index === tours.length - 1 && index >= restaures}
            />
          )}
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
