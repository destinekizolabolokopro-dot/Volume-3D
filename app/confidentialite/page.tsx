import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { PageLegale } from '@/components/PageLegale';
import { Pied } from '@/components/Pied';
import { courrielDeContact } from '@/lib/editeur';
import { CONFIDENTIALITE, SOUS_TRAITANTS } from '@/lib/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vos données',
  description:
    'Ce que ce site enregistre, ce qu’il n’enregistre pas, à qui il le confie, combien de temps, et comment reprendre la main.',
};

/**
 * La politique de confidentialité.
 *
 * Elle décrit le traitement RÉEL, pas un traitement type : les sous-traitants
 * sont nommés un par un parce que chacun correspond à une dépendance du code,
 * et la liste de ce qui est enregistré est celle du schéma de la base.
 *
 * Le tableau des sous-traitants est posé au milieu de la page plutôt qu'en
 * annexe : c'est la question que se pose vraiment quelqu'un qui hésite à
 * déposer un bail — où va mon document ?
 */
export default function Confidentialite() {
  const contact = courrielDeContact();

  return (
    <>
      <Barre retour={{ href: '/', label: 'L’assistant' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Le cadre</p>
        <h1 className="jur-h1 jur-h1-moyen">Vos données</h1>
        <p className="jur-lede">
          Ce qui est enregistré, ce qui ne l’est pas, à qui c’est confié, combien de temps, et
          comment tout effacer en un geste.
        </p>

        <PageLegale articles={CONFIDENTIALITE} />

        <section className="jur-article">
          <h2>
            <span aria-hidden="true">{CONFIDENTIALITE.length + 1}</span>
            À qui c’est confié
          </h2>
          <p>
            Trois prestataires, et aucun autre. Chacun ne reçoit que ce que sa fonction exige.
          </p>

          <div className="jur-traitants">
            {SOUS_TRAITANTS.map((t) => (
              <article className="jur-traitant" key={t.nom}>
                <h3>{t.nom}</h3>
                {/* Le rôle en capitales, le lieu en bas de casse. Les deux sur
                    la même ligne de capitales espacées faisaient six lignes
                    illisibles : les petites capitales ne supportent pas la
                    longueur. */}
                <p className="jur-traitant-role">{t.role}</p>
                <p className="jur-traitant-lieu">{t.lieu}</p>
                <p>{t.quoi}</p>
                <p className="jur-traitant-note">{t.note}</p>
              </article>
            ))}
          </div>
        </section>

        <p className="jur-legal-pied">
          Pour exercer un droit qui ne s’exerce pas depuis votre espace,{' '}
          {contact ? (
            <>
              écrivez à <a href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            <>
              écrivez à l’adresse de contact figurant dans les{' '}
              <a href="/mentions-legales">mentions légales</a>.
            </>
          )}
        </p>
      </main>

      <Pied />
    </>
  );
}
