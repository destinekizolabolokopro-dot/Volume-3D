'use client';

import type { Precision } from '@/lib/precision';

/**
 * La question que le spécialiste pose avant de répondre.
 *
 * Elle est rendue à part du fil, juste au-dessus du champ, et ses réponses
 * sont des boutons. « Le bail est-il vide ou meublé ? » appelle deux clics,
 * pas un paragraphe — et le clic renvoie exactement le mot que le spécialiste
 * attendait, ce qu'une phrase retapée ne garantit jamais.
 *
 * Le bloc ne remplace pas le champ : quand aucune des réponses ne convient,
 * on écrit. Une question fermée qui enferme est pire que pas de question.
 */
export function Question({
  precision,
  onRepondre,
  actif,
}: {
  precision: Precision;
  onRepondre: (reponse: string) => void;
  actif: boolean;
}) {
  return (
    <section className="jur-question-posee" aria-label="Précision demandée">
      <p className="jur-oeil">Avant de répondre</p>
      <p className="jur-question-texte">{precision.question}</p>
      {precision.pourquoi && <p className="jur-question-pourquoi">{precision.pourquoi}</p>}

      {precision.options.length > 0 && (
        <div className="jur-question-options">
          {precision.options.map((option) => (
            <button
              key={option}
              type="button"
              className="jur-chip"
              disabled={!actif}
              onClick={() => onRepondre(option)}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            className="jur-chip jur-chip-neutre"
            disabled={!actif}
            onClick={() => onRepondre('Je ne sais pas.')}
          >
            Je ne sais pas
          </button>
        </div>
      )}
    </section>
  );
}
