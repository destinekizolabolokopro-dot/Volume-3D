import type { Metadata } from 'next';
import { EtatCle, FormulaireCle, PortailReglages } from '@/components/Reglages';
import { estProprietaire, obstacle } from '@/lib/proprietaire';
import { etatDeLaCle } from '@/lib/reglages';
import { retirerLaCle, sortir } from './actions';

/**
 * L'espace du propriétaire.
 *
 * Il n'est lié depuis aucune page, il ne figure dans aucun plan de site, et
 * `noindex, nofollow` l'écarte des moteurs. Ce n'est pas ce qui le protège —
 * une adresse finit toujours par circuler — mais il n'y a aucune raison de la
 * publier. Ce qui le protège est le mot de passe, et lui seul.
 *
 * C'est la seule page du site sans pied de page, et donc sans la mention qui
 * dit ce que ce service n'est pas. C'est voulu : cette mention s'adresse à
 * qui pourrait prendre une réponse pour un conseil d'avocat, et personne ne
 * lit une clé d'API en croyant consulter. Ajouter ici un pied commercial —
 * formules, consultations, recours — reviendrait à vendre le service à celui
 * qui l'exploite.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Réglages',
  robots: { index: false, follow: false, nocache: true },
};

export default async function Reglages() {
  const dedans = await estProprietaire();

  if (!dedans) {
    return (
      <main className="jur-page jur-narrow">
        <h1 className="jur-h1 jur-h1-moyen">Réglages</h1>
        <p className="jur-lede">Cet espace n’est pas destiné aux clients du site.</p>
        <PortailReglages empeche={obstacle()} />
      </main>
    );
  }

  const etat = await etatDeLaCle();

  return (
    <main className="jur-page jur-narrow">
      <h1 className="jur-h1 jur-h1-moyen">Réglages</h1>
      <p className="jur-lede">
        La clé d’API du modèle. Sans elle, les fiches, les délais et le tableau des diagnostics
        restent consultables, mais aucune question ne peut recevoir de réponse.
      </p>

      <section className="jur-bloc">
        <EtatCle etat={etat} />
      </section>

      <section className="jur-bloc">
        <FormulaireCle etat={etat} />
      </section>

      {/* Le retrait est offert aussi quand la clé est ILLISIBLE — `source` vaut
          alors null, et la ligne n'en existe pas moins en base. Sans cette
          seconde condition, une clé chiffrée avec un AUTH_SECRET disparu ne
          pouvait plus qu'être écrasée, jamais enlevée. */}
      {(etat.source === 'reglages' || etat.illisible) && (
        <form action={retirerLaCle} className="jur-retrait">
          <button className="btn btn-ghost btn-sm" type="submit">
            Retirer la clé enregistrée
          </button>
          <p className="hint">
            {etat.illisible
              ? 'La ligne enregistrée est effacée. Elle ne se déchiffrait plus, elle ne servait donc à rien — mais la clé, elle, reste valable chez Anthropic : pour la révoquer vraiment, il faut le faire depuis leur console.'
              : 'L’assistant cesse aussitôt de répondre. La clé reste valable chez Anthropic : pour la révoquer vraiment, il faut le faire depuis leur console.'}
          </p>
        </form>
      )}

      <form action={sortir} className="jur-sortie">
        <button className="btn btn-ghost btn-sm" type="submit">
          Quitter les réglages
        </button>
      </form>
    </main>
  );
}
