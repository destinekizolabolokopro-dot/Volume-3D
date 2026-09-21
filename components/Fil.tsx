import { Reponse } from '@/components/Reponse';
import { Sources } from '@/components/Sources';
import { Veille } from '@/components/Veille';
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
          {tour.role === 'assistant' ? (
            /* Les textes cités rejoignent le détail juridique, à l'intérieur
               du repli : ils appartiennent au même niveau de lecture. Les
               laisser dehors aurait remis sous les yeux de tout le monde
               exactement ce qu'on venait d'en retirer. */
            <Reponse
              texte={tour.content}
              complement={
                <>
                  <Sources references={tour.references ?? []} />
                  {/* La veille vient APRÈS les textes cités, et l'ordre dit
                      quelque chose : la règle d'abord, ce qui l'actualise
                      ensuite. Inverser reviendrait à mettre une page de
                      fédération au-dessus d'un article de loi. */}
                  <Veille sources={tour.veille ?? []} />
                </>
              }
            />
          ) : (
            <p>{tour.content}</p>
          )}
          {tour.role === 'assistant' && (
            <Lecture
              texte={tour.content}
              dernier={index === tours.length - 1 && index >= restaures}
              /* La dernière bulle, tant que la réponse arrive, est une
                 réponse en train de s'écrire : il n'y a rien à lire à voix
                 haute d'un texte qui change encore. Voir components/Voix.tsx. */
              enEcriture={pending && index === tours.length - 1}
            />
          )}
        </div>
      ))}

      {/* La ligne d'attente ne s'affiche que TANT QUE RIEN N'EST ÉCRIT.
          Dès que le premier mot tombe, la bulle de réponse existe et prend le
          relais : garder les deux afficherait « il réfléchit… » sous un texte
          en train de s'écrire, ce qui est faux et donne l'impression que la
          page s'est dédoublée. */}
      {pending && tours[tours.length - 1]?.role !== 'assistant' && (
        <div className="jur-tour jur-de-lui">
          <p className="jur-attente">{attente}</p>
        </div>
      )}
    </div>
  );
}
