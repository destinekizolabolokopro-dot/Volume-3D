import { Barre } from '@/components/juridique/Barre';
import { Orientation } from '@/components/juridique/Orientation';
import { DOMAINES } from '@/lib/domaines';

/**
 * L'accueil.
 *
 * Deux entrées vers la même chose, et aucune n'est cachée derrière l'autre :
 * le champ libre pour qui sait décrire sa situation mais pas la nommer, la
 * grille pour qui sait déjà où il va. L'aiguillage automatique seul serait un
 * pari — il se trompe parfois — et la grille seule demanderait au visiteur de
 * connaître le découpage du droit avant d'avoir posé sa question.
 */
export default function AccueilJuridique() {
  return (
    <>
      <Barre />

      <main className="jur-page">
        <h1 className="jur-h1">Posez votre question. Elle ira au bon spécialiste.</h1>
        <p className="jur-lede">
          Treize spécialités, chacune avec son périmètre, ses textes de référence et ses délais.
          Écrivez votre situation comme vous la raconteriez : l’orientation se fait toute seule, et
          vous pouvez la corriger.
        </p>

        <Orientation />

        <h2 className="jur-h2">Ou choisissez directement</h2>
        <p className="jur-sub">
          Chaque fiche indique ce que le spécialiste traite, ce qu’il ne traite pas, et les délais à
          ne pas manquer.
        </p>

        <div className="jur-grid">
          {DOMAINES.map((domaine) => (
            <a className="jur-card" key={domaine.id} href={`/juridique/${domaine.id}`}>
              <h3>{domaine.label}</h3>
              <p>{domaine.resume}</p>
            </a>
          ))}
        </div>

        <h2 className="jur-h2">Ce que cet assistant est, et ce qu’il n’est pas</h2>
        <div className="jur-avertissement">
          <p style={{ marginTop: 0 }}>
            <strong>Il donne une information juridique</strong> : ce que dit la règle, ce que vous
            pouvez faire, dans quel délai, et vers qui vous tourner. C’est utile pour comprendre une
            situation, préparer un rendez-vous, ou savoir s’il y a urgence.
          </p>
          <p>
            <strong>Il ne remplace pas un avocat.</strong> Il ne connaît de votre dossier que ce que
            vous lui en dites, il ne peut ni vous représenter, ni signer, ni agir avant l’expiration
            d’un délai. Une consultation d’avocat est gratuite dans les points-justice et les maisons
            de justice et du droit, et l’aide juridictionnelle peut en couvrir le coût.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Il ne cite pas de numéros d’article.</strong> C’est délibéré : une référence
            inexacte a l’apparence exacte d’une vraie et se retrouve recopiée dans un courrier. Il
            nomme les textes, il ne les numérote pas.
          </p>
        </div>
      </main>
    </>
  );
}
