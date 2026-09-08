import { currentAccount } from '@/lib/accounts';

/**
 * La barre de la zone juridique.
 *
 * Elle ne reprend pas `ProBar` : celle-ci habille des outils de travail
 * derrière un mot de passe, quand cette zone est publique et se lit sans
 * compte. Le nom du site reste présent, en petit, parce que c'est lui qui
 * répond de ce qui est écrit ici.
 *
 * Elle est asynchrone parce qu'elle lit la session : montrer « Se connecter »
 * à quelqu'un qui l'est déjà est le genre de détail qui fait douter de tout
 * le reste.
 */
export async function Barre({ retour }: { retour?: { href: string; label: string } }) {
  const account = await currentAccount();

  return (
    <header className="jur-bar">
      <a className="jur-bar-brand" href="/juridique">
        Droit immobilier
        <small>l’assistant de Volume3D</small>
      </a>

      {retour && (
        <a className="jur-bar-link" href={retour.href}>
          ← {retour.label}
        </a>
      )}

      <a className="jur-bar-link" href="/juridique/abonnement">
        Formules
      </a>

      {account ? (
        <>
          <a className="jur-bar-link" href="/juridique/dossiers">
            Mes consultations
          </a>
          <a className="jur-bar-link jur-bar-compte" href="/juridique/compte">
            {account.name?.split(' ')[0] || 'Mon compte'}
          </a>
        </>
      ) : (
        <a className="jur-bar-link jur-bar-compte" href="/juridique/compte/connexion">
          Entrer
        </a>
      )}
    </header>
  );
}
