import { compteCourant } from '@/lib/juridique/comptes';
import { MARQUE } from '@/lib/juridique/copie';

/**
 * La barre de la zone juridique.
 *
 * Elle ne reprend pas `ProBar` : celle-ci habille des outils de travail
 * derrière un mot de passe, quand cette zone est publique et se lit sans
 * compte. Elle ne renvoie nulle part ailleurs non plus : ce service se tient
 * seul, et un lien vers un produit de visites 3D n'apprendrait rien à
 * quelqu'un venu poser une question de droit.
 *
 * Elle est asynchrone parce qu'elle lit la session : montrer « Se connecter »
 * à quelqu'un qui l'est déjà est le genre de détail qui fait douter de tout
 * le reste.
 */
export async function Barre({ retour }: { retour?: { href: string; label: string } }) {
  const compte = await compteCourant();

  return (
    <header className="jur-bar">
      <a className="jur-bar-brand" href="/juridique">
        {MARQUE.nom}
        <small>{MARQUE.accroche}</small>
      </a>

      {retour && (
        <a className="jur-bar-link" href={retour.href}>
          ← {retour.label}
        </a>
      )}

      <a className="jur-bar-link" href="/juridique/abonnement">
        Formules
      </a>

      {compte ? (
        <>
          <a className="jur-bar-link" href="/juridique/dossiers">
            Mes consultations
          </a>
          <a className="jur-bar-link jur-bar-compte" href="/juridique/compte">
            {compte.nom?.split(' ')[0] || 'Mon compte'}
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
