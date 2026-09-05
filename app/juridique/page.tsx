import { Barre } from '@/components/juridique/Barre';
import { Orientation } from '@/components/juridique/Orientation';
import { DOMAINES } from '@/lib/domaines';
import { ACCUEIL, LIMITES } from '@/lib/juridique-copie';

/**
 * L'accueil.
 *
 * Deux entrées vers la même chose, et aucune n'est cachée derrière l'autre :
 * le champ libre pour qui sait décrire sa situation mais pas la nommer, la
 * grille pour qui sait déjà où il va. L'aiguillage automatique seul serait un
 * pari — il se trompe parfois — et la grille seule demanderait au visiteur de
 * connaître le découpage du droit immobilier avant d'avoir posé sa question.
 *
 * La copie vient de `lib/juridique-copie.ts` : voir l'en-tête de ce fichier
 * pour la raison, qui tient à une espace de trois dixièmes de cadratin.
 */
export default function AccueilJuridique() {
  return (
    <>
      <Barre />

      <main className="jur-page">
        <h1 className="jur-h1">{ACCUEIL.titre}</h1>
        <p className="jur-lede">{ACCUEIL.lede}</p>

        <Orientation />

        <section className="jur-section">
          <h2 className="jur-h2">{ACCUEIL.grilleTitre}</h2>
          <p className="jur-sub">{ACCUEIL.grilleSous}</p>

          <div className="jur-grid">
            {DOMAINES.map((domaine) => (
              <a className="jur-card" key={domaine.id} href={`/juridique/${domaine.id}`}>
                <h3>{domaine.label}</h3>
                <p>{domaine.resume}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="jur-section">
          <h2 className="jur-h2">{ACCUEIL.limitesTitre}</h2>
          <p className="jur-sub">{ACCUEIL.limitesSous}</p>

          <div className="jur-avertissement">
            {LIMITES.map((limite) => (
              <p key={limite.amorce}>
                <strong>{limite.amorce}</strong>
                {limite.suite}
              </p>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
