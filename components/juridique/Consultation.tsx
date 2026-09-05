'use client';

import { useEffect, useRef, useState } from 'react';
import { Reponse } from '@/components/juridique/Reponse';
import { MAX_PIECE_BYTES } from '@/lib/piece';

/**
 * Le fil avec un spécialiste.
 *
 * Trois états y sont visibles en permanence, et c'est voulu :
 *  — la spécialité (elle ne change pas en cours de fil) ;
 *  — si la consultation est conservée ou non ;
 *  — ce qui a été déposé comme document, par son nom.
 *
 * Le fil complet est renvoyé au serveur à chaque question tant que la
 * personne n'est pas connectée : l'API est sans état. Dès qu'elle l'est, le
 * serveur reprend le fil dans sa base et ignore ce que le navigateur envoie.
 */

export interface Tour {
  role: 'user' | 'assistant';
  content: string;
  piece?: string;
}

interface Props {
  domaine: string;
  label: string;
  exemples: string[];
  /** Fil déjà enregistré qu'on reprend, s'il y en a un. */
  consultationInitiale?: string;
  toursInitiaux?: Tour[];
  /** Question arrivée par l'URL depuis la page d'accueil : elle part toute seule. */
  questionInitiale?: string;
  /** Change le pied du composeur : conservé ou non. */
  connecte: boolean;
}

export function Consultation({
  domaine,
  label,
  exemples,
  consultationInitiale = '',
  toursInitiaux = [],
  questionInitiale = '',
  connecte,
}: Props) {
  const [tours, setTours] = useState<Tour[]>(toursInitiaux);
  const [brouillon, setBrouillon] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [consultationId, setConsultationId] = useState(consultationInitiale);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState('');
  const finRef = useRef<HTMLDivElement>(null);
  const envoiAuto = useRef(false);

  /* `tours` est lu dans `demander` mais n'est pas dans ses dépendances : la
     référence donne toujours la valeur courante sans reconstruire la fonction
     à chaque message. */
  const toursRef = useRef(tours);
  toursRef.current = tours;

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [tours, pending]);

  async function demander(question: string, piece: File | null = null) {
    const propre = question.trim();
    if (!propre || pending) return;

    const precedents = toursRef.current;
    const suite: Tour[] = [
      ...precedents,
      { role: 'user', content: propre, piece: piece?.name },
    ];
    setTours(suite);
    setBrouillon('');
    setFichier(null);
    setPending(true);
    setErreur('');

    try {
      let requete: RequestInit;
      if (piece) {
        const form = new FormData();
        form.set('domaine', domaine);
        form.set('question', propre);
        form.set('consultationId', consultationId);
        form.set('historique', JSON.stringify(precedents));
        form.set('piece', piece);
        requete = { method: 'POST', body: form };
      } else {
        requete = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domaine,
            question: propre,
            consultationId,
            historique: precedents,
          }),
        };
      }

      const reponse = await fetch('/api/juridique/consultation', requete);
      const corps = (await reponse.json()) as {
        reponse?: string;
        consultationId?: string;
        error?: string;
      };
      if (!reponse.ok) throw new Error(corps.error ?? 'Réponse impossible.');

      if (corps.consultationId) setConsultationId(corps.consultationId);
      setTours([...suite, { role: 'assistant', content: corps.reponse ?? '' }]);
    } catch (cause) {
      /* La question reste dans le fil : la retirer donnerait l'impression
         qu'elle n'a jamais été posée, et il faudrait la retaper. */
      setErreur(cause instanceof Error ? cause.message : 'Réponse impossible.');
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!questionInitiale || envoiAuto.current || toursInitiaux.length > 0) return;
    envoiAuto.current = true;
    void demander(questionInitiale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionInitiale]);

  function choisirFichier(event: React.ChangeEvent<HTMLInputElement>) {
    const choisi = event.target.files?.[0] ?? null;
    if (choisi && choisi.size > MAX_PIECE_BYTES) {
      setErreur(`« ${choisi.name} » dépasse ${MAX_PIECE_BYTES / 1024 / 1024} Mo.`);
      event.target.value = '';
      return;
    }
    setErreur('');
    setFichier(choisi);
  }

  return (
    <div>
      {tours.length === 0 && !pending && (
        <div className="jur-suggestions">
          {exemples.map((exemple) => (
            <button
              key={exemple}
              type="button"
              className="jur-chip"
              onClick={() => void demander(exemple)}
            >
              {exemple}
            </button>
          ))}
        </div>
      )}

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
            <p className="jur-attente">{label} examine votre question…</p>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {erreur && <p className="jur-erreur">{erreur}</p>}

      <form
        className="jur-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void demander(brouillon, fichier);
        }}
      >
        <label className="sr-only" htmlFor="brouillon">
          Votre question
        </label>
        <textarea
          id="brouillon"
          value={brouillon}
          onChange={(event) => setBrouillon(event.target.value)}
          placeholder={
            tours.length === 0
              ? 'Décrivez votre situation : ce qui s’est passé, quand, et ce que vous cherchez à obtenir.'
              : 'Précisez, ou posez la question suivante.'
          }
          maxLength={6000}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void demander(brouillon, fichier);
            }
          }}
        />

        <div className="jur-composer-foot">
          <label className="jur-fichier">
            <input
              type="file"
              accept=".pdf,.txt,.md,.csv,image/jpeg,image/png,image/webp"
              onChange={choisirFichier}
            />
            <span aria-hidden="true">📎</span>
            {fichier ? fichier.name : 'Joindre un document'}
          </label>

          <p className="jur-hint">
            {connecte
              ? 'Cette consultation est enregistrée dans vos dossiers. Le document joint, lui, n’est jamais conservé.'
              : 'Rien n’est conservé : en fermant cet onglet, le fil disparaît. Connectez-vous pour le retrouver.'}
          </p>

          <button className="btn btn-accent" type="submit" disabled={pending || !brouillon.trim()}>
            {pending ? 'En cours…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  );
}
