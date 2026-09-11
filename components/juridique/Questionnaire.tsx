'use client';

import { useState } from 'react';
import { enregistrerProfil } from '@/app/juridique/compte/actions';
import { QUESTIONS, estProfessionnel } from '@/lib/juridique/profils';

/**
 * Les trois questions d'entrée.
 *
 * Une seule page, trois blocs, des cartes qu'on clique — pas de menus
 * déroulants. À ce stade la personne vient d'ouvrir un compte pour poser une
 * question de droit : chaque seconde passée sur un formulaire est une seconde
 * volée à ce pour quoi elle est venue.
 *
 * Tout est facultatif, et l'écran le dit. Le bouton « passer » n'est pas caché
 * en gris clair : un questionnaire qu'on ne peut pas éviter se remplit au
 * hasard, et un profil faux oriente les réponses dans le mauvais sens pendant
 * des mois.
 */
export function Questionnaire({ profil }: { profil: { metier: string; volume: string; usage: string } }) {
  const [reponses, setReponses] = useState(profil);

  const complet = Object.values(reponses).filter(Boolean).length;
  const pro = estProfessionnel(reponses);

  return (
    <form action={enregistrerProfil} className="jur-questionnaire">
      {QUESTIONS.map((question) => (
        <fieldset className="jur-question" key={question.cle}>
          <legend>{question.titre}</legend>
          <p className="jur-question-aide">{question.aide}</p>

          <div className="jur-choix">
            {question.choix.map((choix) => (
              <label
                className="jur-choix-carte"
                key={choix.id}
                data-choisi={reponses[question.cle] === choix.id ? '1' : undefined}
              >
                <input
                  type="radio"
                  name={question.cle}
                  value={choix.id}
                  checked={reponses[question.cle] === choix.id}
                  onChange={() => setReponses({ ...reponses, [question.cle]: choix.id })}
                />
                <span className="jur-choix-titre">{choix.label}</span>
                {choix.detail && <span className="jur-choix-detail">{choix.detail}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {pro && (
        <p className="jur-note-pro">
          Vous êtes un professionnel : les réponses iront droit au fait, emploieront le vocabulaire
          du métier, et vous diront ce qu’il faut écrire et conserver — pas seulement ce qu’il faut
          faire. La spécialité « métier de l’agent immobilier » traite votre propre réglementation,
          mandat et honoraires compris.
        </p>
      )}

      <div className="jur-questionnaire-pied">
        <button className="btn btn-accent" type="submit">
          {complet === 0 ? 'Continuer sans répondre' : 'Enregistrer et commencer'}
        </button>
        <p className="hint">
          Tout est facultatif, et modifiable plus tard. Ces réponses servent au spécialiste, pas à un
          fichier commercial : elles ne sortent pas d’ici.
        </p>
      </div>
    </form>
  );
}
