import { renvoyerLaVerification } from '@/app/espace/actions';
import { MARQUE } from '@/lib/copie';

/**
 * La barre de l'espace de travail.
 *
 * Trois chemins, et le nom de la marque qui ramène à l'accueil public. Elle ne
 * propose ni « Formules » ni « Entrer » : on est entré, et la formule se change
 * depuis son compte. Une barre d'espace de travail qui continue de vendre
 * donne l'impression qu'on n'est jamais vraiment client.
 */
export function BarreEspace({ nom, verifie }: { nom: string; verifie: boolean }) {
  const prenom = nom?.split(' ')[0] || 'Mon compte';

  return (
    <>
      <header className="jur-bar jur-bar-espace">
        <a className="jur-bar-brand" href="/">
          {MARQUE.nom}
          <small>votre espace</small>
        </a>

        <a className="jur-bar-link" href="/espace">
          Poser une question
        </a>
        <a className="jur-bar-link" href="/espace/dossiers">
          Mes consultations
        </a>
        <a className="jur-bar-link" href="/documents">
          Rédiger un courrier
        </a>
        <a className="jur-bar-link jur-bar-compte" href="/espace/compte">
          {prenom}
        </a>
      </header>

      {/* Le rappel de confirmation, et ce qu'il n'est pas : un mur. L'adresse
          non confirmée n'empêche ni de poser une question ni de rédiger un
          courrier — seulement de passer à une formule payante. Le bandeau dit
          donc ce qu'on y gagne, pas ce qu'on risque. */}
      {!verifie && (
        <div className="jur-bandeau" role="status">
          <p>
            <strong>Confirmez votre adresse.</strong> Elle vous servira à reprendre la main sur votre
            compte, et il faut l’avoir confirmée pour passer à une formule payante. Tout le reste
            fonctionne sans.
          </p>
          <form action={renvoyerLaVerification}>
            <button className="btn btn-ghost btn-sm" type="submit">
              Renvoyer le lien
            </button>
          </form>
        </div>
      )}
    </>
  );
}
