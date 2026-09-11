'use client';

import { useEffect, useRef } from 'react';
import { Alerte } from '@/components/Alerte';
import { Composeur } from '@/components/Composeur';
import { Fil } from '@/components/Fil';
import { FournisseurVoix, InterrupteurVoix } from '@/components/Voix';
import { Question } from '@/components/Question';
import { useConsultation, type Tour } from '@/components/useConsultation';

export type { Tour };

/**
 * Le fil sur la fiche d'un spécialiste, et sur une consultation reprise.
 *
 * Ici la spécialité est fixée par la page et ne change plus : c'est la
 * différence avec l'accueil, où elle est décidée par l'aiguillage. Le reste —
 * l'envoi, le fil, l'attente — vient de `useConsultation`, partagé entre les
 * deux surfaces.
 */

interface Props {
  domaine: string;
  label: string;
  exemples: string[];
  /**
   * Propose le mode mains libres. Vrai dans l'espace de travail, faux sur la
   * fiche publique d'une spécialité : on n'y est pas venu pour travailler à
   * la voix, on y lit un périmètre et des délais.
   */
  mainsLibres?: boolean;
  /** Fil déjà enregistré qu'on reprend, s'il y en a un. */
  consultationInitiale?: string;
  toursInitiaux?: Tour[];
  /** Question arrivée par l'URL depuis l'accueil : elle part toute seule. */
  questionInitiale?: string;
  /** Change le pied du composeur : conservé ou non. */
  connecte: boolean;
  /**
   * Faux quand aucune clé d'API n'est configurée. Le composeur s'éteint alors
   * plutôt que d'accepter une question qui reviendra en erreur : le bandeau
   * au-dessus a déjà dit pourquoi, l'inviter à écrire serait un piège.
   */
  actif?: boolean;
}

export function Consultation({
  domaine,
  label,
  exemples,
  consultationInitiale = '',
  toursInitiaux = [],
  questionInitiale = '',
  connecte,
  actif = true,
  mainsLibres = false,
}: Props) {
  const { tours, pending, erreur, quotaAtteint, restant, precision, demander } = useConsultation({
    domaine,
    label,
    consultationInitiale,
    toursInitiaux,
  });
  const finRef = useRef<HTMLDivElement>(null);
  const envoiAuto = useRef(false);

  useEffect(() => {
    if (tours.length > 0 || pending) {
      finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [tours, pending]);

  useEffect(() => {
    if (!actif || !questionInitiale || envoiAuto.current || toursInitiaux.length > 0) return;
    envoiAuto.current = true;
    void demander(questionInitiale);
  }, [actif, questionInitiale, toursInitiaux.length, demander]);

  return (
    <FournisseurVoix propose={mainsLibres}>
    <div>
      {tours.length === 0 && !pending && (
        <div className="jur-suggestions">
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
      )}

      {mainsLibres && <InterrupteurVoix />}

      <Fil
        tours={tours}
        pending={pending}
        attente={`${label} examine votre question…`}
        restaures={toursInitiaux.length}
      />
      <div ref={finRef} />

      {precision && !pending && (
        <Question
          precision={precision}
          actif={actif}
          onRepondre={(reponse) => void demander(reponse)}
        />
      )}

      {erreur && <Alerte message={erreur} quota={quotaAtteint} />}

      <Composeur
        onEnvoyer={(question, piece) => void demander(question, piece)}
        pending={pending}
        actif={actif}
        connecte={connecte}
        placeholder={
          tours.length === 0
            ? 'Décrivez votre situation : la date des faits, le type de bien, et ce que vous cherchez à obtenir.'
            : 'Précisez, ou posez la question suivante.'
        }
      />

      {restant !== null && (
        <p className="jur-restant">
          {restant > 0
            ? `Il vous reste ${restant} question${restant > 1 ? 's' : ''} ce mois-ci.`
            : 'C’était votre dernière question du mois.'}
          <a href="/abonnement">Changer de formule</a>
        </p>
      )}
      </div>
    </FournisseurVoix>
  );
}
