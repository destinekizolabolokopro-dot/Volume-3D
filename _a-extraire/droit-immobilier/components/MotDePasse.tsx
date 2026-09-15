'use client';

import { useActionState } from 'react';
import { demanderLeLien, reinitialiser, type Resultat } from '@/app/entrer/actions';

/**
 * Les deux écrans du mot de passe oublié.
 *
 * ── Demander le lien ───────────────────────────────────────────────────────
 * Le message de réponse est le MÊME que l'adresse ait un compte ou non, et il
 * reste à l'écran à la place du formulaire : renvoyer le champ vide laisserait
 * croire qu'il ne s'est rien passé, et la personne redemanderait trois liens
 * de suite, invalidant les deux premiers.
 */
export function DemandeDeLien() {
  const [etat, action, enCours] = useActionState<Resultat | null, FormData>(demanderLeLien, null);

  if (etat?.message) {
    return (
      <div className="jur-portail">
        <p className="jur-succes" role="status">
          {etat.message}
        </p>
        <a className="btn btn-ghost btn-block" href="/entrer">
          Revenir à la connexion
        </a>
      </div>
    );
  }

  return (
    <div className="jur-portail">
      <form action={action} className="jur-form">
        <div className="field">
          <label htmlFor="oubli-email">Adresse électronique</label>
          <input id="oubli-email" name="email" type="email" required autoComplete="email" autoFocus />
        </div>

        {etat?.error && (
          <p className="jur-erreur" role="alert">
            {etat.error}
          </p>
        )}

        <button className="btn btn-accent btn-block" type="submit" disabled={enCours}>
          {enCours ? 'Envoi…' : 'Recevoir un lien'}
        </button>
        <p className="hint">
          Le lien est valable une heure et ne sert qu’une fois. En demander un nouveau annule le
          précédent.
        </p>
      </form>
    </div>
  );
}

/**
 * ── Poser le nouveau mot de passe ──────────────────────────────────────────
 * Le jeton voyage dans un champ caché plutôt que d'être relu depuis l'adresse
 * au moment de l'envoi : la page l'a déjà validé pour s'afficher, et il n'y a
 * aucune raison qu'il reparte faire le tour du navigateur.
 *
 * La confirmation est demandée deux fois. Sur un écran où l'on ne voit pas ce
 * qu'on tape et où l'on n'a plus accès à l'ancien mot de passe, une faute de
 * frappe enferme dehors pour de bon.
 */
export function NouveauMotDePasse({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState<Resultat | null, FormData>(reinitialiser, null);

  return (
    <div className="jur-portail">
      <form action={action} className="jur-form">
        <input type="hidden" name="jeton" value={jeton} />

        <div className="field">
          <label htmlFor="mdp-1">Nouveau mot de passe</label>
          <input
            id="mdp-1"
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            autoFocus
          />
          <p className="hint">Dix caractères au minimum.</p>
        </div>

        <div className="field">
          <label htmlFor="mdp-2">Répétez-le</label>
          <input id="mdp-2" name="password2" type="password" required minLength={10} autoComplete="new-password" />
        </div>

        {etat?.error && (
          <p className="jur-erreur" role="alert">
            {etat.error}
          </p>
        )}

        <button className="btn btn-accent btn-block" type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Choisir ce mot de passe'}
        </button>
      </form>
    </div>
  );
}
