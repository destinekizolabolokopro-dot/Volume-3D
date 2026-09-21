'use client';

import { useCallback, useRef, useState } from 'react';
import type { Reference } from '@/lib/juridique/citations';
import type { Precision } from '@/lib/juridique/precision';

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
  /* Les articles cités par cette réponse-là, attachés au tour et non à l'état
     de la page : dans un fil de six questions, chaque réponse a les siens.
     Ils vivent le temps de la séance — une consultation rouverte depuis la
     base montre le texte des réponses, où les articles cités figurent déjà. */
  references?: Reference[];
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
  /** Ce qu'il reste de questions ce mois-ci. `null` quand c'est illimité. */
  restant?: number | null;
  /** La question posée par le spécialiste avant de répondre, s'il en pose une. */
  precision?: Precision | null;
  /** Ce qui précède la question, sans elle. Vide quand il n'y a que la question. */
  preambule?: string;
  /** Les articles du corpus officiel sur lesquels la réponse s'appuie. */
  references?: Reference[];
  error?: string;
  /** Vrai quand le refus vient d'un quota : la page propose alors une issue. */
  abonnement?: boolean;
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
  const [restant, setRestant] = useState<number | null>(null);
  /* La question en attente. Elle n'est pas dans `tours` : le fil garde le
     texte, l'état garde les boutons. Répondre l'efface. */
  const [precision, setPrecision] = useState<Precision | null>(null);
  /* Vrai quand la dernière erreur est un quota atteint plutôt qu'une panne :
     la page montre alors la sortie au lieu d'un simple message rouge. */
  const [quotaAtteint, setQuotaAtteint] = useState(false);

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
      setPrecision(null);
      setQuotaAtteint(false);

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
        if (!reponse.ok) {
          setQuotaAtteint(Boolean(corps.abonnement));
          throw new Error(corps.error ?? 'Réponse impossible.');
        }

        if (corps.consultationId) setConsultationId(corps.consultationId);
        if (corps.domaine) setSpecialite({ id: corps.domaine, label: corps.label ?? '' });
        setPistes(corps.pistes ?? []);
        setRestant(corps.restant ?? null);
        setPrecision(corps.precision ?? null);

        /* Quand une question est posée, la bulle ne porte que ce qui la
           précède — la question a son encadré. Et s'il n'y a rien avant, il
           n'y a pas de bulle du tout : une bulle vide se voit. */
        const bulle = corps.precision ? (corps.preambule ?? '') : (corps.reponse ?? '');
        setTours(
          bulle
            ? [...suite, { role: 'assistant', content: bulle, references: corps.references ?? [] }]
            : suite,
        );
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
    setPrecision(null);
    setErreur('');
    setQuotaAtteint(false);
    setConsultationId('');
    setSpecialite({ id: domaine, label });
  }, [domaine, label]);

  return {
    tours,
    pending,
    erreur,
    setErreur,
    quotaAtteint,
    restant,
    precision,
    consultationId,
    specialite,
    pistes,
    demander,
    recommencer,
  };
}
