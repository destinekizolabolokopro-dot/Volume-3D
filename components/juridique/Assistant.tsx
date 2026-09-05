'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Composeur } from '@/components/juridique/Composeur';
import { Fil } from '@/components/juridique/Fil';
import { useConsultation } from '@/components/juridique/useConsultation';
import { ACCUEIL, ORIENTATION } from '@/lib/juridique-copie';

/**
 * L'accueil : la conversation EST la page.
 *
 * Deux états, et un seul composant, parce que le passage de l'un à l'autre ne
 * doit pas être une navigation — on écrit, on envoie, la page devient le fil.
 * Faire changer d'URL à ce moment-là coûterait un chargement au moment précis
 * où quelqu'un attend sa réponse, et ferait perdre le fil au retour arrière.
 *
 *  — au repos : le titre, le champ, quelques questions d'exemple, et tout ce
 *    que la page raconte d'elle-même (passé en `children`) ;
 *  — en conversation : une sous-barre qui nomme le spécialiste retenu et
 *    donne accès à ses délais, le fil, le champ. Le reste s'efface.
 *
 * La spécialité n'est pas choisie ici : la question part sans elle, et c'est
 * le serveur qui aiguille (voir app/api/juridique/consultation/route.ts). Un
 * aller-retour de moins, et l'aiguillage reste au même endroit pour tout le
 * monde.
 */

export interface FicheLegere {
  id: string;
  label: string;
  resume: string;
  delais: string[];
}

interface Props {
  fiches: FicheLegere[];
  /** Questions d'exemple montrées au repos. */
  exemples: string[];
  connecte: boolean;
  actif: boolean;
  /** Ce qui n'a de sens qu'avant la première question : la grille, les limites. */
  children: ReactNode;
}

export function Assistant({ fiches, exemples, connecte, actif, children }: Props) {
  const { tours, pending, erreur, specialite, pistes, demander, recommencer } = useConsultation({});
  const [delaisOuverts, setDelaisOuverts] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  /* La dernière question posée, pour pouvoir la reposer à un autre
     spécialiste sans la faire retaper. */
  const derniere = [...tours].reverse().find((tour) => tour.role === 'user')?.content ?? '';

  const enConversation = tours.length > 0;
  const fiche = fiches.find((entree) => entree.id === specialite.id) ?? null;

  useEffect(() => {
    if (enConversation) finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [tours, pending, enConversation]);

  if (!enConversation) {
    return (
      <main className="jur-page jur-accueil">
        <h1 className="jur-h1">{ACCUEIL.titre}</h1>
        <p className="jur-lede">{ACCUEIL.lede}</p>

        <Composeur
          onEnvoyer={(question, piece) => void demander(question, piece)}
          pending={pending}
          actif={actif}
          connecte={connecte}
          placeholder={ORIENTATION.placeholder}
          action="Poser la question"
          grand
        />

        <p className="jur-invite">{ORIENTATION.invite}</p>

        {erreur && <p className="jur-erreur jur-erreur-ask">{erreur}</p>}

        <div className="jur-suggestions jur-suggestions-accueil">
          {exemples.map((exemple) => (
            <button
              key={exemple}
              type="button"
              className="jur-chip"
              disabled={!actif || pending}
              onClick={() => void demander(exemple)}
            >
              {exemple}
            </button>
          ))}
        </div>

        {children}
      </main>
    );
  }

  return (
    <main className="jur-page jur-narrow jur-conversation">
      <div className="jur-sousbarre">
        <span className="jur-specialite">
          {specialite.label || 'Aiguillage'}
          {fiche && <a href={`/juridique/${fiche.id}`}>fiche</a>}
        </span>

        {fiche && fiche.delais.length > 0 && (
          <button
            type="button"
            className="jur-bar-link jur-bouton-plat"
            aria-expanded={delaisOuverts}
            onClick={() => setDelaisOuverts((ouvert) => !ouvert)}
          >
            Délais {delaisOuverts ? '▴' : '▾'}
          </button>
        )}

        <button type="button" className="jur-bar-link jur-bouton-plat" onClick={recommencer}>
          Nouvelle question
        </button>
      </div>

      {fiche && delaisOuverts && (
        <section className="jur-bloc jur-delais jur-delais-fil">
          <h3>Délais à ne pas manquer</h3>
          <ul>
            {fiche.delais.map((delai) => (
              <li key={delai}>{delai}</li>
            ))}
          </ul>
        </section>
      )}

      <Fil tours={tours} pending={pending} attente={`${specialite.label || 'L’assistant'} examine votre question…`} />
      <div ref={finRef} />

      {pistes.length > 0 && !pending && (
        <p className="jur-autres jur-autres-fil">
          {ORIENTATION.autres}{' '}
          {pistes.map((piste) => (
            <button
              key={piste.id}
              type="button"
              className="jur-bouton-lien"
              onClick={() => void demander(derniere, null, piste.id, true)}
            >
              {piste.label}
            </button>
          ))}
        </p>
      )}

      {erreur && <p className="jur-erreur">{erreur}</p>}

      <Composeur
        onEnvoyer={(question, piece) => void demander(question, piece)}
        pending={pending}
        actif={actif}
        connecte={connecte}
        placeholder="Précisez, ou posez la question suivante."
      />
    </main>
  );
}
