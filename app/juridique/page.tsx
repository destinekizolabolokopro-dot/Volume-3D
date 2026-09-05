import { Assistant } from '@/components/juridique/Assistant';
import { Barre } from '@/components/juridique/Barre';
import { currentAccount } from '@/lib/accounts';
import { DOMAINES, domaine } from '@/lib/domaines';
import { ACCUEIL, LIMITES } from '@/lib/juridique-copie';
import { estJuristeConfigure } from '@/lib/juriste';

export const dynamic = 'force-dynamic';

/**
 * L'accueil.
 *
 * La conversation est la page : on écrit, on envoie, le fil prend la place du
 * reste. Ce qui suit — la grille des neuf spécialités et ce que l'assistant
 * n'est pas — n'existe que tant qu'aucune question n'a été posée, et passe
 * donc en `children` de l'assistant plutôt que d'être rendu à côté de lui.
 *
 * La grille reste : les fiches valent pour elles-mêmes, elles s'indexent, et
 * quelqu'un qui sait déjà que sa question porte sur la copropriété n'a pas à
 * la formuler pour y arriver.
 *
 * Seul le strict nécessaire des fiches descend jusqu'au navigateur — nom,
 * résumé, délais. Le reste du catalogue (mots-clés d'aiguillage, textes de
 * référence, périmètre donné au modèle) pèse cinq fois plus et ne sert qu'au
 * serveur.
 */
export default async function AccueilJuridique() {
  const account = await currentAccount();

  const fiches = DOMAINES.map((fiche) => ({
    id: fiche.id,
    label: fiche.label,
    resume: fiche.resume,
    delais: fiche.delais,
  }));

  /* Quatre exemples pris dans quatre spécialités différentes : ils montrent
     l'étendue du périmètre en même temps que le niveau de précision utile. */
  const exemples = (['bail-habitation', 'courte-duree', 'copropriete', 'travaux'] as const).map(
    (id) => domaine(id).exemples[0],
  );

  return (
    <>
      <Barre />

      <Assistant
        fiches={fiches}
        exemples={exemples}
        connecte={Boolean(account)}
        actif={estJuristeConfigure()}
      >
        <section className="jur-section">
          <h2 className="jur-h2">{ACCUEIL.grilleTitre}</h2>
          <p className="jur-sub">{ACCUEIL.grilleSous}</p>

          <div className="jur-grid">
            {DOMAINES.map((fiche) => (
              <a className="jur-card" key={fiche.id} href={`/juridique/${fiche.id}`}>
                <h3>{fiche.label}</h3>
                <p>{fiche.resume}</p>
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
      </Assistant>
    </>
  );
}
