'use client';

import { useActionState, useState } from 'react';
import { connexion, inscription, type Resultat } from '@/app/entrer/actions';

/**
 * Entrer, ou ouvrir un compte.
 *
 * Un seul écran et deux onglets plutôt que deux pages : à ce moment-là, la
 * personne a déjà une question en tête et vient de se heurter à une limite.
 * Lui faire chercher un lien « pas encore inscrit ? » en bas de page est le
 * meilleur moyen qu'elle referme l'onglet.
 *
 * L'inscription ne demande que trois choses — un nom, une adresse, un mot de
 * passe. Le téléphone et la société attendront : chaque champ de plus est un
 * abandon de plus, et rien ici n'a besoin d'eux.
 */
export function Portail({
  depart = 'connexion',
  repris = false,
}: {
  depart?: 'connexion' | 'inscription';
  repris?: boolean;
}) {
  const [mode, setMode] = useState<'connexion' | 'inscription'>(depart);
  const [etatEntree, actionEntree, entreeEnCours] = useActionState<Resultat | null, FormData>(
    connexion,
    null,
  );
  const [etatOuverture, actionOuverture, ouvertureEnCours] = useActionState<Resultat | null, FormData>(
    inscription,
    null,
  );

  return (
    <div className="jur-portail">
      <div className="jur-onglets" role="tablist" aria-label="Entrer ou créer un compte">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'connexion'}
          onClick={() => setMode('connexion')}
        >
          J’ai un compte
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'inscription'}
          onClick={() => setMode('inscription')}
        >
          Créer un compte
        </button>
      </div>

      {/* Au retour d'une réinitialisation. La session n'est volontairement pas
          ouverte à ce moment-là — voir app/entrer/actions.ts —, donc il faut
          dire pourquoi on redemande d'entrer. */}
      {repris && mode === 'connexion' && (
        <p className="jur-succes" role="status">
          Votre mot de passe est changé. Connectez-vous avec le nouveau.
        </p>
      )}

      {mode === 'connexion' ? (
        <form action={actionEntree} className="jur-form">
          <div className="field">
            <label htmlFor="entree-email">Adresse électronique</label>
            <input id="entree-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="entree-mdp">Mot de passe</label>
            <input
              id="entree-mdp"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>

          {etatEntree?.error && (
            <p className="jur-erreur" role="alert">
              {etatEntree.error}
            </p>
          )}

          <button className="btn btn-accent btn-block" type="submit" disabled={entreeEnCours}>
            {entreeEnCours ? 'Connexion…' : 'Entrer'}
          </button>

          {/* Sous le bouton, et non en haut de page : on ne cherche ce lien
              qu'après avoir essayé un mot de passe qui n'a pas marché. */}
          <p className="jur-oubli">
            <a href="/mot-de-passe-oublie">Mot de passe oublié ?</a>
          </p>
        </form>
      ) : (
        <form action={actionOuverture} className="jur-form">
          <div className="field">
            <label htmlFor="ouvre-nom">Votre nom</label>
            <input id="ouvre-nom" name="name" required maxLength={140} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="ouvre-email">Adresse électronique</label>
            <input id="ouvre-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="ouvre-mdp">Mot de passe</label>
            <input
              id="ouvre-mdp"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
            <p className="hint">Dix caractères au minimum.</p>
          </div>
          {/* Il y avait ici un champ « Société ou agence ». Il est retiré : rien
              ne le lisait, aucune colonne ne l'attendait, et il partait à la
              poubelle à chaque création de compte. Demander une information
              pour la jeter est pire que ne pas la demander — le formulaire
              s'allonge, la personne renseigne, et le service n'en sait rien.
              Ce qu'il faut savoir d'elle est demandé après, dans le profil :
              voir lib/profils.ts. */}

          {etatOuverture?.error && (
            <p className="jur-erreur" role="alert">
              {etatOuverture.error}
            </p>
          )}

          <button className="btn btn-accent btn-block" type="submit" disabled={ouvertureEnCours}>
            {ouvertureEnCours ? 'Création…' : 'Ouvrir un compte gratuit'}
          </button>
          <p className="hint">
            La formule Découverte est gratuite et sans carte bancaire : dix questions par mois, et vos
            consultations conservées.
          </p>
        </form>
      )}
    </div>
  );
}
