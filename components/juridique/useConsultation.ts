'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * L'état d'une conversation avec un spécialiste.
 *
 * Deux surfaces s'en servent et n'affichent pas la même chose : l'accueil, où
 * la spécialité n'est pas encore choisie et où le fil occupe la page entière,
 * et la fiche d'un spécialiste, où elle est fixée d'avance. Ce qu'elles
 * partagent — l'envoi, le fil, l'attente, l'erreur, l'identifiant de
 * consultation — tient ici. Ce qui les distingue reste dans chaque composant.
 *
 * Le fil complet est renvoyé au serveur à chaque question tant que la personne
 * n'est pas connectée : l'API est sans état. Dès qu'elle l'est, le serveur
 * reprend le fil dans sa base et ignore ce que le navigateur envoie.
 */

export interface Tour {
  role: 'user' | 'assistant';
  content: string;
  piece?: string;
}

/** Une autre spécialité plausible, renvoyée par l'aiguillage du serveur. */
export interface Piste {
  id: string;
  label: string;
  resume: string;
}

interface Options {
  /** Spécialité imposée par la page. Vide sur l'accueil : le serveur aiguille. */
  domaine?: string;
  label?: string;
  consultationInitiale?: string;
  toursInitiaux?: Tour[];
}

interface Reponse {
  reponse?: string;
  domaine?: string;
  label?: string;
  pistes?: Piste[];
  consultationId?: string;
  error?: string;
}

export function useConsultation({
  domaine = '',
  label = '',
  consultationInitiale = '',
  toursInitiaux = [],
}: Options) {
  const [tours, setTours] = useState<Tour[]>(toursInitiaux);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState('');
  const [consultationId, setConsultationId] = useState(consultationInitiale);
  const [specialite, setSpecialite] = useState({ id: domaine, label });
  const [pistes, setPistes] = useState<Piste[]>([]);

  /* `tours` et la spécialité sont lus dans `demander` sans figurer dans ses
     dépendances : les références donnent la valeur courante sans reconstruire
     la fonction à chaque message. */
  const toursRef = useRef(tours);
  toursRef.current = tours;
  const specialiteRef = useRef(specialite);
  specialiteRef.current = specialite;
  const consultationRef = useRef(consultationId);
  consultationRef.current = consultationId;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const demander = useCallback(
    async (
      question: string,
      piece: File | null = null,
      domaineForce = '',
      /* Repose la question à un autre spécialiste : le fil recommence, parce
         qu'une consigne ne s'applique pas rétroactivement aux réponses déjà
         données par un autre. */
      repartir = false,
    ) => {
      const propre = question.trim();
      if (!propre || pendingRef.current) return;

      const choisi = domaineForce || specialiteRef.current.id;
      const precedents = repartir ? [] : toursRef.current;
      if (repartir) setConsultationId('');
      const suite: Tour[] = [...precedents, { role: 'user', content: propre, piece: piece?.name }];

      setTours(suite);
      setPending(true);
      setErreur('');
      setPistes([]);

      try {
        let requete: RequestInit;
        if (piece) {
          const form = new FormData();
          form.set('domaine', choisi);
          form.set('question', propre);
          form.set('consultationId', repartir ? '' : consultationRef.current);
          form.set('historique', JSON.stringify(precedents));
          form.set('piece', piece);
          requete = { method: 'POST', body: form };
        } else {
          requete = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domaine: choisi,
              question: propre,
              consultationId: repartir ? '' : consultationRef.current,
              historique: precedents,
            }),
          };
        }

        const reponse = await fetch('/api/juridique/consultation', requete);
        const corps = (await reponse.json()) as Reponse;
        if (!reponse.ok) throw new Error(corps.error ?? 'Réponse impossible.');

        if (corps.consultationId) setConsultationId(corps.consultationId);
        if (corps.domaine) setSpecialite({ id: corps.domaine, label: corps.label ?? '' });
        setPistes(corps.pistes ?? []);
        setTours([...suite, { role: 'assistant', content: corps.reponse ?? '' }]);
      } catch (cause) {
        /* La question reste dans le fil : la retirer donnerait l'impression
           qu'elle n'a jamais été posée, et il faudrait la retaper. */
        setErreur(cause instanceof Error ? cause.message : 'Réponse impossible.');
      } finally {
        setPending(false);
      }
    },
    [],
  );

  /** Repartir de zéro, sans recharger la page ni perdre la spécialité imposée. */
  const recommencer = useCallback(() => {
    setTours([]);
    setPistes([]);
    setErreur('');
    setConsultationId('');
    setSpecialite({ id: domaine, label });
  }, [domaine, label]);

  return {
    tours,
    pending,
    erreur,
    setErreur,
    consultationId,
    specialite,
    pistes,
    demander,
    recommencer,
  };
}
