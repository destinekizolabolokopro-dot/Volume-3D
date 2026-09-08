import { ACCUEIL } from '@/lib/juridique-copie';

/**
 * Le pied de page.
 *
 * Il porte la mention qui doit suivre le visiteur partout — information et non
 * consultation — et les quelques liens qu'on ne met pas dans le chemin
 * principal. Le haut de page ne propose qu'une chose à faire ; tout le reste
 * finit ici.
 */
export function Pied() {
  return (
    <footer className="jur-pied">
      <div className="jur-pied-corps">
        <p>{ACCUEIL.piedMention}</p>
        <nav aria-label="Liens de pied de page">
          <a href="/juridique">L’assistant</a>
          <a href="/juridique/abonnement">Formules</a>
          <a href="/juridique/compte">Mon compte</a>
          <a href="/">Volume3D</a>
        </nav>
      </div>
    </footer>
  );
}
