import { Mention } from '@/components/Mention';
import { compteCourant } from '@/lib/comptes';
import { MARQUE, PIED } from '@/lib/copie';

/**
 * Le pied de page.
 *
 * Il porte maintenant la mention EN ENTIER, et non plus un résumé : depuis
 * qu'elle a quitté le haut de page, c'est ici qu'elle se lit, et un pied de
 * page est le seul endroit d'un site où personne ne s'étonne d'en trouver une.
 *
 * Il nomme aussi les recours — ADIL, point-justice, aide juridictionnelle —
 * dans leur propre colonne plutôt que noyés dans la mention. Quelqu'un dont
 * la situation dépasse une information doit pouvoir les trouver sans lire un
 * paragraphe de précautions : c'est le seul endroit du site qui envoie
 * ailleurs, et il le fait clairement.
 *
 * Il lit la session pour une seule ligne : proposer « Se connecter » à
 * quelqu'un qui l'est déjà est le genre de détail qui fait douter du reste.
 */
export async function Pied() {
  const compte = await compteCourant();

  return (
    <footer className="jur-pied">
      <div className="jur-pied-corps">
        <div className="jur-pied-marque">
          <p className="jur-pied-nom">{MARQUE.nom}</p>
          <p className="jur-pied-accroche">{MARQUE.accroche}</p>
        </div>

        {PIED.colonnes.map((colonne) => (
          <nav className="jur-pied-colonne" key={colonne.titre} aria-label={colonne.titre}>
            <p className="jur-pied-titre">{colonne.titre}</p>
            <ul>
              {colonne.liens.map((lien) => {
                const connecte = lien.href === '/entrer' && compte;
                return (
                  <li key={lien.href}>
                    <a href={connecte ? '/espace' : lien.href}>
                      {connecte ? 'Mon espace' : lien.libelle}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}

        <div className="jur-pied-colonne jur-pied-recours">
          <p className="jur-pied-titre">{PIED.recoursTitre}</p>
          <p>{PIED.recours}</p>
        </div>
      </div>

      <div className="jur-pied-mention">
        <Mention />
      </div>
    </footer>
  );
}
