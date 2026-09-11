'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alerte } from '@/components/Alerte';
import { Composeur } from '@/components/Composeur';
import { Fil } from '@/components/Fil';
import { Mention } from '@/components/Mention';
import { Question } from '@/components/Question';
import { useConsultation } from '@/components/useConsultation';
import { ACCUEIL, ORIENTATION } from '@/lib/copie';

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
  verifications: string[];
}

interface Props {
  fiches: FicheLegere[];
  /** Questions d'exemple montrées au repos. */
  exemples: string[];
  connecte: boolean;
  actif: boolean;
  /**
   * Le cartouche des chiffres du fonds, posé à droite du champ.
   *
   * Il arrive rendu depuis le serveur plutôt que construit ici : les chiffres
   * sont lus dans l'index du corpus, qui n'a rien à faire dans un composant
   * client. Absent quand le corpus n'est pas construit.
   */
  preuve?: ReactNode;
  /**
   * Vrai sur la vitrine : une question, puis le mur.
   *
   * Ce n'est pas le quota qui change ici — il est tenu par le serveur, et un
   * drapeau de navigateur ne garde aucune porte. C'est ce qu'on montre APRÈS
   * la réponse : quelqu'un qui vient de lire un avis sourcé est exactement au
   * moment où créer un compte a du sens, et lui laisser un champ qui répondra
   * « quota atteint » gâcherait ce moment-là.
   */
  essai?: boolean;
  /**
   * Le surtitre, le titre et l'amorce, quand ce ne sont pas ceux de la
   * vitrine. L'espace de travail a les siens : on n'y vend plus, on y
   * travaille — voir `ESPACE` dans lib/copie.ts.
   */
  entete?: { oeil: string; titreLignes: readonly string[]; lede: string; invite: string };
  /** Ce qui n'a de sens qu'avant la première question : la grille, les limites. */
  children: ReactNode;
}

export function Assistant({
  fiches,
  exemples,
  connecte,
  actif,
  preuve,
  essai = false,
  entete,
  children,
}: Props) {
  const tete = entete ?? {
    oeil: ACCUEIL.oeil,
    titreLignes: ACCUEIL.titreLignes,
    lede: ACCUEIL.lede,
    invite: ORIENTATION.invite,
  };
  const {
    tours,
    pending,
    erreur,
    quotaAtteint,
    restant,
    precision,
    specialite,
    pistes,
    demander,
    recommencer,
  } = useConsultation({});
  const [delaisOuverts, setDelaisOuverts] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  /* La dernière question posée, pour pouvoir la reposer à un autre
     spécialiste sans la faire retaper. */
  const derniere = [...tours].reverse().find((tour) => tour.role === 'user')?.content ?? '';

  const enConversation = tours.length > 0;
  /* Une réponse est arrivée, et pas seulement une question partie. */
  const repondu = tours.some((tour) => tour.role === 'assistant');
  const fiche = fiches.find((entree) => entree.id === specialite.id) ?? null;

  useEffect(() => {
    if (enConversation) finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [tours, pending, enConversation]);

  if (!enConversation) {
    return (
      <main className="jur-page jur-accueil">
        {/* Deux colonnes : ce qu'on demande de faire à gauche, d'où viennent
            les réponses à droite. Le cartouche disparaît sous 1040 px, où la
            place manque et où il passerait derrière le champ — les chiffres
            sont alors repris en pleine section plus bas. */}
        <div className="jur-haut" id="poser">
          <div className="jur-haut-colonne">
            <p className="jur-oeil">{tete.oeil}</p>
            <h1 className="jur-h1">
              {tete.titreLignes.map((ligne) => (
                <span key={ligne}>{ligne}</span>
              ))}
            </h1>
            <p className="jur-lede">{tete.lede}</p>

            <Composeur
              onEnvoyer={(question, piece) => void demander(question, piece)}
              pending={pending}
              actif={actif}
              connecte={connecte}
              placeholder={ORIENTATION.placeholder}
              action="Poser la question"
              grand
            />

            <p className="jur-invite">{tete.invite}</p>

            {erreur && (
              <div className="jur-erreur-ask">
                <Alerte message={erreur} quota={quotaAtteint} />
              </div>
            )}

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
          </div>

          {preuve}
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
          {fiche && <a href={`/${fiche.id}`}>fiche</a>}
        </span>

        {fiche && fiche.delais.length > 0 && (
          <button
            type="button"
            className="jur-bar-link jur-bouton-plat"
            aria-expanded={delaisOuverts}
            onClick={() => setDelaisOuverts((ouvert) => !ouvert)}
          >
            Délais et vérifications {delaisOuverts ? '▴' : '▾'}
          </button>
        )}

        <button type="button" className="jur-bar-link jur-bouton-plat" onClick={recommencer}>
          Nouvelle question
        </button>
      </div>

      {/* Le rappel est ici et nulle part ailleurs dans le fil : au-dessus de
          la première réponse, là où quelqu'un pourrait la prendre pour un
          conseil d'avocat. Le texte entier reste en pied de page. */}
      <Mention forme="rappel" />

      {fiche && delaisOuverts && (
        <div className="jur-reperes">
          <section className="jur-bloc jur-delais">
            <h3>Délais à ne pas manquer</h3>
            <ul>
              {fiche.delais.map((delai) => (
                <li key={delai}>{delai}</li>
              ))}
            </ul>
          </section>

          <section className="jur-bloc">
            <h3>À vérifier avant d’agir</h3>
            <ul>
              {fiche.verifications.map((verification) => (
                <li key={verification}>{verification}</li>
              ))}
            </ul>
          </section>
        </div>
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

      {precision && !pending && (
        <Question
          precision={precision}
          actif={actif}
          onRepondre={(reponse) => void demander(reponse)}
        />
      )}

      {erreur && <Alerte message={erreur} quota={quotaAtteint} />}

      {/* Le mur de la vitrine : il remplace le champ, il ne s'ajoute pas à lui.
          Laisser les deux reviendrait à proposer d'écrire une question dont on
          sait déjà qu'elle sera refusée.
          
          Il attend une RÉPONSE, pas seulement une question posée. La question
          entre dans le fil avant que le serveur ait répondu — c'est ce qui
          fait qu'elle reste à l'écran si l'appel échoue, plutôt que d'être à
          retaper. Sans cette condition, une panne passagère coûtait l'essai :
          le champ disparaissait, le mur s'affichait, et quelqu'un qui n'avait
          rien obtenu s'entendait dire qu'il venait de voir comment ça
          répond. */}
      {essai && repondu && !pending ? (
        <section className="jur-mur">
          <p className="jur-oeil">La suite</p>
          <h2>Vous venez de voir comment il répond.</h2>
          <p>
            Cette question était votre essai. Un compte gratuit en donne dix par mois, conserve vos
            consultations pour les rouvrir, et ouvre la rédaction de courriers. Sans carte bancaire.
          </p>
          <div className="jur-mur-actions">
            <a className="btn btn-accent" href="/entrer?mode=inscription">
              Créer un compte gratuit
            </a>
            <a className="btn btn-ghost" href="/entrer">
              J’ai déjà un compte
            </a>
          </div>
        </section>
      ) : (
        <Composeur
          onEnvoyer={(question, piece) => void demander(question, piece)}
          pending={pending}
          actif={actif}
          connecte={connecte}
          placeholder="Précisez, ou posez la question suivante."
        />
      )}

      {!essai && restant !== null && (
        <p className="jur-restant">
          {restant > 0
            ? `Il vous reste ${restant} question${restant > 1 ? 's' : ''} ce mois-ci.`
            : 'C’était votre dernière question du mois.'}
          <a href="/abonnement">Changer de formule</a>
        </p>
      )}
    </main>
  );
}
