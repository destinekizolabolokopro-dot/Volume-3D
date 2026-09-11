import { Assistant } from '@/components/Assistant';
import { Barre } from '@/components/Barre';
import { Pied } from '@/components/Pied';
import { FORMULES, prixLisible, quotaLisible } from '@/lib/abonnements';
import { compteCourant } from '@/lib/comptes';
import { FAMILLES } from '@/lib/documents';
import { DOMAINES, domaine } from '@/lib/domaines';
import {
  ACCUEIL,
  APPEL,
  ETAPES,
  LIMITES,
  PREUVE,
  RASSURANCE,
  VITRINE_DOCUMENTS,
} from '@/lib/copie';
import { estJuristeConfigure } from '@/lib/juriste';
import { dateLisible, nombreLisible, preuveDuCorpus } from '@/lib/preuve';

export const dynamic = 'force-dynamic';

/**
 * L'accueil, qui fait deux métiers à la fois.
 *
 * C'est l'outil : on écrit, on envoie, le fil prend la place du reste. Et
 * c'est la vitrine : tout ce qui suit le champ — les dix spécialités, le
 * déroulé en trois temps, d'où viennent les réponses, les courriers, les
 * formules, les limites, l'appel — n'existe que tant qu'aucune question n'a
 * été posée, et passe donc en `children` de l'assistant.
 *
 * Les deux tiennent sur une seule page parce qu'ils se servent l'un l'autre :
 * la meilleure démonstration de ce service est le champ lui-même, et la
 * meilleure raison de s'en servir est ce qui est écrit dessous. Les séparer
 * aurait donné une page de vente qui parle d'un outil qu'on ne voit pas.
 *
 * Seul le strict nécessaire des fiches descend jusqu'au navigateur — nom,
 * résumé, délais, aide-mémoire. Le reste du catalogue (mots-clés
 * d'aiguillage, textes de référence, périmètre donné au modèle) pèse cinq
 * fois plus et ne sert qu'au serveur.
 */
export default async function AccueilJuridique() {
  const compte = await compteCourant();
  const preuve = await preuveDuCorpus();

  const fiches = DOMAINES.map((fiche) => ({
    id: fiche.id,
    label: fiche.label,
    resume: fiche.resume,
    delais: fiche.delais,
    verifications: fiche.verifications,
  }));

  /* Quatre exemples pris dans quatre spécialités différentes : ils montrent
     l'étendue du périmètre en même temps que le niveau de précision utile. Le
     dernier vient du métier — c'est le seul moyen qu'un agent immobilier
     comprenne, sans lire la grille, que sa propre réglementation est traitée
     ici et pas seulement celle de ses clients. */
  const exemples = (['bail-habitation', 'courte-duree', 'travaux', 'profession'] as const).map(
    (id) => domaine(id).exemples[0],
  );

  return (
    <>
      <Barre />

      <Assistant
        fiches={fiches}
        exemples={exemples}
        connecte={Boolean(compte)}
        actif={await estJuristeConfigure()}
        preuve={
          <aside className="jur-preuve-carte" aria-label={RASSURANCE.oeil}>
            <p className="jur-oeil">{RASSURANCE.oeil}</p>
            <ul>
              {RASSURANCE.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            {preuve && (
              <p className="jur-preuve-arrete">
                {RASSURANCE.pied} <strong>{dateLisible(preuve.arrete)}</strong>
              </p>
            )}
          </aside>
        }
      >
        <section className="jur-section jur-vitrine">
          <div className="jur-vitrine-tete">
            <p className="jur-oeil">Les dix spécialités</p>
            <h2 className="jur-h2">{ACCUEIL.grilleTitre}</h2>
            <p className="jur-sub">{ACCUEIL.grilleSous}</p>
          </div>

          <div className="jur-grid">
            {DOMAINES.map((fiche) => (
              <a className="jur-card" key={fiche.id} href={`/${fiche.id}`}>
                <h3>{fiche.label}</h3>
                <p>{fiche.resume}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="jur-section jur-vitrine">
          <div className="jur-vitrine-tete">
            <p className="jur-oeil">En trois temps</p>
            <h2 className="jur-h2">Comment ça se passe</h2>
          </div>

          <div className="jur-etapes">
            {ETAPES.map((etape) => (
              <div className="jur-etape" key={etape.amorce}>
                <strong>{etape.amorce}</strong>
                <p>{etape.suite}</p>
              </div>
            ))}
          </div>
        </section>

        {/* La section des chiffres ne s'affiche que si le corpus est
            construit : un dépôt fraîchement cloné n'a rien à prouver, et
            annoncer zéro article serait pire que se taire. */}
        {preuve && (
          <section className="jur-section jur-vitrine">
            <div className="jur-preuve">
              <div className="jur-preuve-texte">
                <p className="jur-oeil">{PREUVE.oeil}</p>
                <h2 className="jur-h2">{PREUVE.titre}</h2>
                <p>{PREUVE.corps}</p>
                <p className="jur-preuve-note">{PREUVE.note}</p>
              </div>

              <dl className="jur-chiffres">
                <div className="jur-chiffre">
                  <dt>{preuve.textes}</dt>
                  <dd>{PREUVE.labels.textes}</dd>
                </div>
                <div className="jur-chiffre">
                  <dt>{nombreLisible(preuve.articles)}</dt>
                  <dd>{PREUVE.labels.articles}</dd>
                </div>
                <div className="jur-chiffre">
                  <dt>{DOMAINES.length}</dt>
                  <dd>{PREUVE.labels.specialites}</dd>
                </div>
                <div className="jur-chiffre jur-chiffre-date">
                  <dt>{dateLisible(preuve.arrete)}</dt>
                  <dd>{PREUVE.labels.arrete}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        <section className="jur-section jur-vitrine">
          <div className="jur-vitrine-tete">
            <p className="jur-oeil">{VITRINE_DOCUMENTS.oeil}</p>
            <h2 className="jur-h2">{VITRINE_DOCUMENTS.titre}</h2>
            <p className="jur-sub">{VITRINE_DOCUMENTS.corps}</p>
          </div>

          <div className="jur-familles">
            {FAMILLES.map((famille) => (
              <a className="jur-famille" key={famille.id} href={`/documents#${famille.id}`}>
                <strong>{famille.label}</strong>
                <span>{famille.resume}</span>
              </a>
            ))}
          </div>

          <a className="btn btn-ghost" href="/documents">
            {VITRINE_DOCUMENTS.action}
          </a>
        </section>

        <section className="jur-section jur-vitrine">
          <div className="jur-vitrine-tete">
            <p className="jur-oeil">Formules</p>
            <h2 className="jur-h2">Ce que ça coûte</h2>
            <p className="jur-sub">
              Les fiches, les délais et les aide-mémoire restent lisibles sans compte et sans
              limite. Seules les questions posées à l’assistant sont comptées.
            </p>
          </div>

          <div className="jur-tarifs">
            {FORMULES.map((formule) => (
              <a className="jur-tarif" key={formule.id} href="/abonnement">
                <span className="jur-tarif-nom">{formule.nom}</span>
                <span className="jur-tarif-prix">{prixLisible(formule)}</span>
                <span className="jur-tarif-quota">{quotaLisible(formule)}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="jur-section jur-vitrine-aplat jur-bande">
          <p className="jur-oeil">Ce qu’il faut savoir</p>
          <h2>{ACCUEIL.limitesTitre}</h2>
          <p className="jur-bande-sous">{ACCUEIL.limitesSous}</p>

          <div className="jur-limites">
            {LIMITES.map((limite) => (
              <div className="jur-limite" key={limite.amorce}>
                <p>
                  <strong>{limite.amorce}</strong>
                  {limite.suite}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="jur-section jur-vitrine-aplat jur-appel">
          <h2>{APPEL.titre}</h2>
          <p>{APPEL.corps}</p>
          <div className="jur-appel-actions">
            <a className="btn btn-inverse" href="#poser">
              {APPEL.action}
            </a>
            <a className="btn btn-contour-clair" href="/abonnement">
              {APPEL.secondaire}
            </a>
          </div>
        </section>
      </Assistant>

      <Pied />
    </>
  );
}
