import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { Pied } from '@/components/Pied';
import { compteCourant } from '@/lib/comptes';
import { consultationsDuCompte } from '@/lib/consultations';
import { domaineOuNull } from '@/lib/domaines';
import { DOSSIERS } from '@/lib/copie';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes consultations',
  robots: { index: false, follow: false },
};

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * L'historique.
 *
 * Il n'existe que pour les comptes : sans connexion, il n'y a rien à
 * afficher parce qu'il n'y a rien d'enregistré — pas d'identifiant déposé
 * dans un cookie pour rattacher après coup des questions sur une garde à vue
 * ou un licenciement. La page le dit plutôt que de faire semblant d'être vide.
 */
export default async function Dossiers() {
  const compte = await compteCourant();

  if (!compte) {
    return (
      <>
        <Barre retour={{ href: '/', label: 'Toutes les spécialités' }} />
        <main className="jur-page jur-narrow">
          <h1 className="jur-h1">Mes consultations</h1>
          <p className="jur-lede">{DOSSIERS.anonyme}</p>
          <div className="jur-vide">
            <p>Connectez-vous pour retrouver vos consultations passées.</p>
            <a className="btn btn-accent" href="/compte/connexion">
              Se connecter
            </a>
          </div>
        </main>

        <Pied />
      </>
    );
  }

  const fils = await consultationsDuCompte(compte.id);

  return (
    <>
      <Barre retour={{ href: '/', label: 'Toutes les spécialités' }} />
      <main className="jur-page jur-narrow">
        <h1 className="jur-h1">Mes consultations</h1>
        <p className="jur-lede">
          {fils.length === 0
            ? 'Aucune consultation enregistrée pour l’instant.'
            : `${fils.length} consultation${fils.length > 1 ? 's' : ''}. Les documents que vous avez déposés n’y figurent pas : ils ne sont jamais conservés.`}
        </p>

        {fils.length === 0 ? (
          <div className="jur-vide">
            <p>{DOSSIERS.inviteQuestion}</p>
            <a className="btn btn-accent" href="/">
              Choisir une spécialité
            </a>
          </div>
        ) : (
          <ul className="jur-liste-fils">
            {fils.map((fil) => (
              <li key={fil.id}>
                <a className="jur-fil-ligne" href={`/dossiers/${fil.id}`}>
                  <span className="jur-fil-titre">{fil.titre}</span>
                  <span className="jur-fil-meta">
                    {domaineOuNull(fil.domaine)?.label ?? fil.domaine} ·{' '}
                    {JOUR.format(new Date(fil.updatedAt))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Pied />
    </>
  );
}
