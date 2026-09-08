import { compteCourant } from '@/lib/comptes';
import { MARQUE } from '@/lib/copie';

/**
 * La barre de la zone juridique.
 *
 * Quatre entrées, pas plus : les formules, les consultations passées, le
 * compte. Tout le reste du site se rejoint depuis la page d'accueil, et une
 * barre qui propose huit chemins n'en fait prendre aucun.
 *
 * Elle est asynchrone parce qu'elle lit la session : montrer « Se connecter »
 * à quelqu'un qui l'est déjà est le genre de détail qui fait douter de tout
 * le reste.
 */
export async function Barre({ retour }: { retour?: { href: string; label: string } }) {
  const compte = await compteCourant();

  return (
    <header className="jur-bar">
      <a className="jur-bar-brand" href="/">
        {MARQUE.nom}
        <small>{MARQUE.accroche}</small>
      </a>

      {retour && (
        <a className="jur-bar-link" href={retour.href}>
          ← {retour.label}
        </a>
      )}

      <a className="jur-bar-link" href="/abonnement">
        Formules
      </a>

      {compte ? (
        <>
          <a className="jur-bar-link" href="/dossiers">
            Mes consultations
          </a>
          <a className="jur-bar-link jur-bar-compte" href="/compte">
            {compte.nom?.split(' ')[0] || 'Mon compte'}
          </a>
        </>
      ) : (
        <a className="jur-bar-link jur-bar-compte" href="/compte/connexion">
          Entrer
        </a>
      )}
    </header>
  );
}
