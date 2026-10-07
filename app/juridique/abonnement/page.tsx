import type { Metadata } from 'next';
import { changerFormule } from '@/app/juridique/compte/actions';
import { Barre } from '@/components/juridique/Barre';
import {
  FORMULES,
  QUOTA_ANONYME,
  formuleDuCompte,
  paiementConfigure,
  prixLisible,
} from '@/lib/juridique/abonnements';
import { compteCourant } from '@/lib/juridique/comptes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Formules',
  description:
    'Trois formules pour l’assistant juridique immobilier : Découverte gratuite, Pro pour plusieurs biens, Cabinet pour une agence.',
};

/**
 * Les formules.
 *
 * Trois colonnes, celle du milieu marquée : c'est la forme qui se lit le plus
 * vite, et la seule qui permette d'ancrer un prix — la formule haute existe
 * autant pour rendre la médiane raisonnable que pour être vendue.
 *
 * Chaque colonne porte le même nombre de lignes et une action unique. Une
 * page de prix qui propose deux boutons par colonne fait hésiter là où elle
 * devrait faire choisir.
 */
export default async function Abonnement() {
  const compte = await compteCourant();
  const actuelle = compte ? formuleDuCompte(compte.abonnement) : null;

  return (
    <>
      <Barre retour={{ href: '/juridique', label: 'L’assistant' }} />

      <main className="jur-page">
        <div className="jur-tete-centree">
          <p className="jur-oeil">Formules</p>
          <h1 className="jur-h1">Trois formules, sans engagement.</h1>
          <p className="jur-lede jur-lede-centree">
            Sans compte, l’assistant répond à {QUOTA_ANONYME} questions par jour. Un compte gratuit
            conserve vos consultations ; les formules payantes lèvent la limite et ouvrent le dépôt
            de documents.
          </p>
        </div>

        <div className="jur-formules">
          {FORMULES.map((formule) => {
            const courante = actuelle?.id === formule.id;
            return (
              <section
                key={formule.id}
                className="jur-formule"
                data-recommandee={formule.recommandee ? '1' : undefined}
                data-courante={courante ? '1' : undefined}
              >
                {formule.recommandee && <p className="jur-badge">La plus choisie</p>}
                {courante && !formule.recommandee && <p className="jur-badge jur-badge-neutre">Votre formule</p>}

                <h2>{formule.nom}</h2>
                <p className="jur-formule-prix">
                  {prixLisible(formule)}
                  {formule.prix > 0 && <span> / mois</span>}
                </p>
                <p className="jur-formule-pour">{formule.pour}</p>

                <ul className="jur-formule-liste">
                  {formule.avantages.map((avantage) => (
                    <li key={avantage}>{avantage}</li>
                  ))}
                </ul>

                {!compte ? (
                  <a
                    className={`btn btn-block ${formule.recommandee ? 'btn-accent' : 'btn-ghost'}`}
                    href={`/juridique/compte/connexion?mode=inscription`}
                  >
                    {formule.prix === 0 ? 'Ouvrir un compte gratuit' : `Prendre ${formule.nom}`}
                  </a>
                ) : courante ? (
                  <p className="jur-formule-actuelle">Formule active</p>
                ) : (
                  <form action={changerFormule}>
                    <input type="hidden" name="formule" value={formule.id} />
                    <button
                      className={`btn btn-block ${formule.recommandee ? 'btn-accent' : 'btn-ghost'}`}
                      type="submit"
                    >
                      Passer à {formule.nom}
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>

        {!paiementConfigure() && (
          <p className="jur-note-paiement">
            Aucun prestataire de paiement n’est branché sur ce site : les formules payantes
            s’activent immédiatement et gratuitement, et rien ne vous sera demandé. C’est écrit ici
            plutôt que caché derrière une page de carte bancaire qui n’encaisserait rien.
          </p>
        )}

        <div className="jur-rassurance">
          <div>
            <h3>Sans engagement</h3>
            <p>On change de formule ou on arrête quand on veut. Rien ne se reconduit sans le dire.</p>
          </div>
          <div>
            <h3>Vos documents ne sont pas conservés</h3>
            <p>
              Un bail déposé traverse le serveur le temps de la réponse. Seul le nom du fichier reste
              dans le fil, quelle que soit la formule.
            </p>
          </div>
          <div>
            <h3>Le compteur repart le 1ᵉʳ</h3>
            <p>
              Les questions non posées ne se reportent pas, et aucune limite ne s’applique aux
              délais ni aux fiches, qui restent lisibles sans compte.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
