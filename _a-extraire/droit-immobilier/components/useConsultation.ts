'use client';

import { useCallback, useRef, useState } from 'react';
import type { Reference } from '@/lib/citations';
import type { SourceWeb } from '@/lib/veille';
import {
  decoupeur,
  lireEvenement,
  phraseDAttente,
  type Etape,
  type Fin,
  type PisteEnvoyee,
} from '@/lib/flux';
import type { Precision } from '@/lib/precision';

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
  /* Les pages consultées en ligne pour cette réponse-là. Même durée de vie
     que les articles cités, et pour la même raison : elles appartiennent au
     tour, pas à la page. */
  veille?: SourceWeb[];
}

/** Une autre spécialité plausible, renvoyée par l'aiguillage du serveur. */
export type Piste = PisteEnvoyee;

interface Options {
  /** Spécialité imposée par la page. Vide sur l'accueil : le serveur aiguille. */
  domaine?: string;
  label?: string;
  consultationInitiale?: string;
  toursInitiaux?: Tour[];
}

/**
 * Ce que renvoie un refus, avant que le flux ne s'ouvre.
 *
 * Quota atteint, question illisible, assistant non configuré : ces trois-là
 * se savent avant qu'un octet de réponse ne parte, et restent donc des codes
 * HTTP avec un corps JSON. Tout ce qui arrive ENSUITE passe par le flux.
 */
interface Refus {
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
  /* L'étape est lue dans la boucle de lecture, qui tourne hors du rendu : une
     référence donne sa valeur courante sans la faire dépendre d'un re-rendu. */
  const etapeRef = useRef<Etape | null>(null);

  /**
   * Ce qui se passe en ce moment, quand rien ne s'écrit encore.
   *
   * Sert à une seule ligne à l'écran, et cette ligne est la différence entre
   * « il travaille » et « c'est tombé en panne ».
   */
  const [etape, setEtape] = useState<Etape | null>(null);
  /* Vrai quand relancer la même question a une chance d'aboutir. Une clé
     mauvaise ne se répare pas en insistant : proposer le bouton serait cruel. */
  const [reessayable, setReessayable] = useState(false);

  /* La requête en cours, pour pouvoir l'interrompre. Sans ça, quitter la page
     ou recommencer laisse le flux tourner — et le calcul continue d'être
     facturé pour une réponse que plus personne ne lira. */
  const volRef = useRef<AbortController | null>(null);
  /* De quoi refaire exactement la même demande. Les `precedents` sont figés
     ici parce qu'après un échec le fil porte déjà la question : les relire
     l'y mettrait deux fois. */
  const derniereRef = useRef<{
    question: string;
    piece: File | null;
    choisi: string;
    precedents: Tour[];
    repartir: boolean;
  } | null>(null);

  const lancer = useCallback(
    async (
      question: string,
      piece: File | null,
      choisi: string,
      precedents: Tour[],
      repartir: boolean,
    ) => {
      derniereRef.current = { question, piece, choisi, precedents, repartir };

      const suite: Tour[] = [...precedents, { role: 'user', content: question, piece: piece?.name }];

      setTours(suite);
      setPending(true);
      setErreur('');
      setReessayable(false);
      setPistes([]);
      setPrecision(null);
      setQuotaAtteint(false);
      setEtape(null);

      volRef.current?.abort();
      const vol = new AbortController();
      volRef.current = vol;

      try {
        let requete: RequestInit;
        if (piece) {
          const form = new FormData();
          form.set('domaine', choisi);
          form.set('question', question);
          form.set('consultationId', repartir ? '' : consultationRef.current);
          form.set('historique', JSON.stringify(precedents));
          form.set('piece', piece);
          requete = { method: 'POST', body: form, signal: vol.signal };
        } else {
          requete = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domaine: choisi,
              question,
              consultationId: repartir ? '' : consultationRef.current,
              historique: precedents,
            }),
            signal: vol.signal,
          };
        }

        const reponse = await fetch('/api/consultation', requete);

        /* Les refus d'avant le flux : ils ont un code et un corps JSON. */
        if (!reponse.ok) {
          const corps = (await reponse.json().catch(() => ({}))) as Refus;
          setQuotaAtteint(Boolean(corps.abonnement));
          /* Un quota atteint ne se relance pas : il se lève en changeant de
             formule, et le bandeau porte déjà ce lien-là. */
          setReessayable(!corps.abonnement && reponse.status >= 500);
          throw new Error(corps.error ?? 'Réponse impossible.');
        }
        if (!reponse.body) throw new Error('Réponse vide.');

        /* ---------------------------------------------------- la lecture ---

           Le texte s'accumule ici et n'est reversé dans le fil qu'à cadence
           réduite. Rendre à chaque fragment ferait tourner le découpage de la
           réponse (lib/mise-en-forme.ts) cinquante fois par seconde pour un
           résultat que l'œil ne distingue pas — et sur un téléphone, ça se
           sent tout de suite. */
        const lecteur = reponse.body.getReader();
        const decodeur = new TextDecoder();
        const coupe = decoupeur();
        let accumule = '';
        let dernierRendu = 0;
        let termine = false;

        const rendre = (force: boolean) => {
          const maintenant = Date.now();
          if (!force && maintenant - dernierRendu < 60) return;
          dernierRendu = maintenant;
          setTours(
            accumule ? [...suite, { role: 'assistant', content: accumule }] : suite,
          );
        };

        const appliquerLaFin = (fin: Fin) => {
          termine = true;
          if (fin.consultationId) setConsultationId(fin.consultationId);
          if (fin.domaine) setSpecialite({ id: fin.domaine, label: fin.label });
          setPistes(fin.pistes ?? []);
          setRestant(fin.restant ?? null);
          setPrecision((fin.precision as Precision | null) ?? null);
          setEtape(null);

          /* Le texte affiché est celui de la FIN, pas celui qu'on a accumulé.
             Les deux ne diffèrent que lorsqu'une réponse a été coupée, mise
             en pause ou remplacée par un refus — c'est-à-dire exactement
             quand il ne faut pas montrer ce que le modèle avait commencé à
             écrire. Voir lib/flux.ts.

             Quand une question est posée, la bulle ne porte que ce qui la
             précède : la question a son encadré. Et s'il n'y a rien avant, il
             n'y a pas de bulle du tout — une bulle vide se voit. */
          const bulle = fin.precision ? (fin.preambule ?? '') : fin.reponse;
          setTours(
            bulle
              ? [
                  ...suite,
                  {
                    role: 'assistant',
                    content: bulle,
                    references: (fin.references ?? []) as Reference[],
                    veille: (fin.veille ?? []) as SourceWeb[],
                  },
                ]
              : suite,
          );
        };

        const traiter = (ligne: string) => {
          const evenement = lireEvenement(ligne);
          if (!evenement) return;
          if (evenement.t === 'mot') {
            accumule += evenement.d;
            /* Le premier mot chasse l'étape : à partir de là, c'est le texte
               lui-même qui prouve que ça avance. */
            if (etapeRef.current) {
              etapeRef.current = null;
              setEtape(null);
            }
            rendre(false);
            return;
          }
          if (evenement.t === 'etape') {
            etapeRef.current = evenement;
            setEtape(evenement);
            return;
          }
          if (evenement.t === 'cap') {
            setSpecialite({ id: evenement.domaine, label: evenement.label });
            setPistes(evenement.pistes ?? []);
            return;
          }
          if (evenement.t === 'fin') {
            appliquerLaFin(evenement);
            return;
          }
          if (evenement.t === 'erreur') {
            termine = true;
            setReessayable(evenement.reessayable);
            throw new Error(evenement.message);
          }
        };

        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          for (const ligne of coupe.avaler(decodeur.decode(value, { stream: true }))) {
            traiter(ligne);
          }
        }
        for (const ligne of coupe.fin()) traiter(ligne);

        /* LE FLUX S'EST FERMÉ SANS CONCLURE.

           Ça arrive : une coupure réseau, un serveur qui redémarre, un
           intermédiaire qui ferme la connexion. Rien n'a levé d'erreur, et
           sans ce garde-fou la page afficherait un début de réponse comme
           s'il était la réponse — le pire des deux mondes, puisqu'il a l'air
           fini. */
        if (!termine) {
          setReessayable(true);
          throw new Error(
            'La réponse s’est interrompue avant la fin. Votre question est conservée : relancez-la.',
          );
        }
      } catch (cause) {
        /* Une interruption voulue — on a quitté, ou relancé — n'est pas une
           panne et ne s'affiche pas. */
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        /* La question reste dans le fil : la retirer donnerait l'impression
           qu'elle n'a jamais été posée, et il faudrait la retaper. */
        setErreur(cause instanceof Error ? cause.message : 'Réponse impossible.');
        setEtape(null);
      } finally {
        if (volRef.current === vol) volRef.current = null;
        setPending(false);
      }
    },
    [],
  );

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
      await lancer(propre, piece, choisi, precedents, repartir);
    },
    [lancer],
  );

  /**
   * Reposer la question qui vient d'échouer, telle quelle.
   *
   * Elle repart avec le même fil de départ que la première fois : le fil
   * courant porte déjà la question, et la relire l'y mettrait deux fois.
   */
  const relancer = useCallback(async () => {
    const derniere = derniereRef.current;
    if (!derniere || pendingRef.current) return;
    await lancer(
      derniere.question,
      derniere.piece,
      derniere.choisi,
      derniere.precedents,
      derniere.repartir,
    );
  }, [lancer]);

  /** Repartir de zéro, sans recharger la page ni perdre la spécialité imposée. */
  const recommencer = useCallback(() => {
    /* Couper d'abord : sinon la réponse en cours continuerait d'arriver et se
       déverserait dans le fil qu'on vient de vider. */
    volRef.current?.abort();
    volRef.current = null;
    derniereRef.current = null;
    setEtape(null);
    setReessayable(false);
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
    /** Vrai quand la page peut proposer « Relancer la question ». */
    reessayable,
    restant,
    precision,
    consultationId,
    specialite,
    pistes,
    /** La ligne à afficher pendant l'attente, déjà écrite en français. */
    attente: phraseDAttente(specialite.label, etape),
    demander,
    relancer,
    recommencer,
  };
}
