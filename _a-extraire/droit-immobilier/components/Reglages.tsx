'use client';

import { useActionState } from 'react';
import { entrer, poserLaCle, type Resultat } from '@/app/reglages/actions';
import type { EtatDeLaCle } from '@/lib/reglages';

/**
 * L'espace du propriétaire : coller la clé du modèle, et rien d'autre.
 *
 * Deux états seulement — dehors, dedans. Pas de tableau de bord, pas de
 * statistiques : cette page existe pour une action qu'on fait deux fois par
 * an, et tout ce qu'on y ajouterait serait du bruit devant un champ qui reçoit
 * un moyen de paiement.
 *
 * La clé n'est jamais renvoyée ici. Le serveur n'envoie que son empreinte —
 * les huit derniers caractères — et la date de pose. C'est assez pour
 * reconnaître la sienne et vérifier qu'une rotation a eu lieu, et ça ne permet
 * rien d'autre.
 */

export function PortailReglages({ empeche }: { empeche: string }) {
  const [etat, action, enCours] = useActionState<Resultat | null, FormData>(entrer, null);

  if (empeche) {
    return (
      <div className="jur-erreur" role="alert">
        <p>{empeche}</p>
      </div>
    );
  }

  return (
    <form action={action} className="jur-form jur-portail">
      <div className="field">
        <label htmlFor="reglages-mdp">Mot de passe des réglages</label>
        <input
          id="reglages-mdp"
          name="motdepasse"
          type="password"
          required
          autoComplete="off"
          autoFocus
        />
        <p className="hint">
          Ce n’est pas le mot de passe d’un compte client : c’est celui posé dans la variable
          ADMIN_PASSWORD de l’hébergeur.
        </p>
      </div>

      {etat?.error && (
        <p className="jur-erreur" role="alert">
          {etat.error}
        </p>
      )}

      <button className="btn btn-accent btn-block" type="submit" disabled={enCours}>
        {enCours ? 'Vérification…' : 'Entrer'}
      </button>
    </form>
  );
}

const JOUR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function FormulaireCle({ etat }: { etat: EtatDeLaCle }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(poserLaCle, null);
  const parVariable = etat.source === 'environnement';

  return (
    <form action={action} className="jur-form">
      <div className="field">
        <label htmlFor="cle">
          {etat.source ? 'Remplacer la clé' : 'Clé d’API Anthropic'}
        </label>
        <input
          id="cle"
          name="cle"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-api03-…"
        />
        <p className="hint">
          Elle est essayée auprès d’Anthropic avant d’être enregistrée, puis chiffrée en base. Elle
          ne sera jamais réaffichée : seuls ses huit derniers caractères le seront.
        </p>
      </div>

      {resultat?.error && (
        <p className="jur-erreur" role="alert">
          {resultat.error}
        </p>
      )}
      {resultat?.ok && (
        <p className="jur-succes" role="status">
          {resultat.message}
        </p>
      )}

      <button className="btn btn-accent" type="submit" disabled={enCours || parVariable}>
        {enCours ? 'Vérification auprès d’Anthropic…' : 'Vérifier et enregistrer'}
      </button>

      {parVariable && (
        <p className="hint">
          Une variable ANTHROPIC_API_KEY est posée sur l’hébergeur, et elle l’emporte sur ce
          formulaire. Retirez-la si vous préférez gérer la clé ici.
        </p>
      )}
    </form>
  );
}

export function EtatCle({ etat }: { etat: EtatDeLaCle }) {
  if (etat.illisible) {
    return (
      <div className="jur-erreur" role="alert">
        <p>
          Une clé est enregistrée mais ne se déchiffre plus. C’est ce qui arrive quand AUTH_SECRET a
          changé depuis : le chiffrement en dépend. Collez la clé à nouveau ci-dessous.
        </p>
      </div>
    );
  }

  if (!etat.source) {
    return (
      <div className="jur-vide">
        <p>Aucune clé n’est configurée : l’assistant ne peut répondre à personne.</p>
      </div>
    );
  }

  return (
    <dl className="jur-etat-cle">
      <div>
        <dt>Clé en place</dt>
        <dd className="jur-empreinte">{etat.empreinte}</dd>
      </div>
      <div>
        <dt>Elle vient de</dt>
        <dd>
          {etat.source === 'environnement'
            ? 'la variable ANTHROPIC_API_KEY de l’hébergeur'
            : 'cet espace, chiffrée en base'}
        </dd>
      </div>
      {etat.depuis && (
        <div>
          <dt>Posée le</dt>
          <dd>{JOUR.format(new Date(etat.depuis))}</dd>
        </div>
      )}
    </dl>
  );
}
