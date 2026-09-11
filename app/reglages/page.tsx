import type { Metadata } from 'next';
import { EtatCle, FormulaireCle, PortailReglages, type FicheSecret } from '@/components/Reglages';
import { decompteDesAttentes } from '@/lib/attentes';
import { BRANCHES } from '@/lib/branches';
import { expediteurEstProvisoire } from '@/lib/courriel';
import { estProprietaire, obstacle } from '@/lib/proprietaire';
import { etatDuSecret } from '@/lib/reglages';
import {
  poserLaCle,
  poserLaCleCourriel,
  retirerLaCle,
  retirerLaCleCourriel,
  sortir,
} from './actions';

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const MODELE: FicheSecret = {
  titre: 'Clé d’API Anthropic',
  fournisseur: 'Anthropic',
  exemple: 'sk-ant-api03-…',
  variable: 'ANTHROPIC_API_KEY',
  sansElle: 'Aucune clé n’est configurée : l’assistant ne peut répondre à personne.',
};

const COURRIEL: FicheSecret = {
  titre: 'Clé d’API Resend',
  fournisseur: 'Resend',
  exemple: 're_…',
  variable: 'RESEND_API_KEY',
  sansElle:
    'Aucune clé n’est configurée : un mot de passe perdu ne peut pas être repris, et les adresses ne peuvent pas être confirmées.',
};

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

  const [cleModele, cleCourriel, attentes] = await Promise.all([
    etatDuSecret('cle-modele'),
    etatDuSecret('cle-courriel'),
    /* Le relevé est lu sous garde, comme les clés le sont déjà.
    
       C'est la page où l'on vient RÉPARER ce qui ne va pas : la faire tomber
       en erreur 500 parce que la table des attentes manque — un schéma pas
       encore rejoué, une base qui hoquette — fermerait aussi le formulaire de
       clé, qui est précisément ce dont on a besoin à ce moment-là. Un relevé
       vide se lit comme « personne pour l'instant », ce qui est au pire
       trompeur pendant une panne, jamais bloquant. */
    decompteDesAttentes().catch(() => new Map<string, { nombre: number; derniere: string }>()),
  ]);

  return (
    <main className="jur-page jur-narrow">
      <h1 className="jur-h1 jur-h1-moyen">Réglages</h1>
      <p className="jur-lede">
        Les deux clés dont ce site a besoin, et ce que vos clients attendent. Rien d’autre : cette
        page existe pour des gestes qu’on fait deux fois par an.
      </p>

      <section className="jur-section">
        <h2 className="jur-h2">Le modèle</h2>
        <p className="jur-sub">
          Sans elle, les fiches, les délais et le tableau des diagnostics restent consultables, mais
          aucune question ne peut recevoir de réponse.
        </p>

        <div className="jur-bloc">
          <EtatCle fiche={MODELE} etat={cleModele} />
        </div>

        <div className="jur-bloc">
          <FormulaireCle fiche={MODELE} etat={cleModele} poser={poserLaCle} />
        </div>

        {/* Le retrait est offert aussi quand la clé est ILLISIBLE — `source`
            vaut alors null, et la ligne n'en existe pas moins en base. Sans
            cette seconde condition, une clé chiffrée avec un AUTH_SECRET
            disparu ne pouvait plus qu'être écrasée, jamais enlevée. */}
        {(cleModele.source === 'reglages' || cleModele.illisible) && (
          <form action={retirerLaCle} className="jur-retrait">
            <button className="btn btn-ghost btn-sm" type="submit">
              Retirer la clé enregistrée
            </button>
            <p className="hint">
              {cleModele.illisible
                ? 'La ligne enregistrée est effacée. Elle ne se déchiffrait plus, elle ne servait donc à rien — mais la clé, elle, reste valable chez Anthropic : pour la révoquer vraiment, il faut le faire depuis leur console.'
                : 'L’assistant cesse aussitôt de répondre. La clé reste valable chez Anthropic : pour la révoquer vraiment, il faut le faire depuis leur console.'}
            </p>
          </form>
        )}
      </section>

      <section className="jur-section">
        <h2 className="jur-h2">Les courriels</h2>
        <p className="jur-sub">
          Confirmation d’adresse et mot de passe oublié. Sans elle, les comptes fonctionnent — on
          entre, on pose ses questions, on rédige ses courriers — mais personne ne peut reprendre la
          main sur un compte dont le mot de passe est perdu.
        </p>

        <div className="jur-bloc">
          <EtatCle fiche={COURRIEL} etat={cleCourriel} />
        </div>

        <div className="jur-bloc">
          <FormulaireCle fiche={COURRIEL} etat={cleCourriel} poser={poserLaCleCourriel} />
        </div>

        {(cleCourriel.source === 'reglages' || cleCourriel.illisible) && (
          <form action={retirerLaCleCourriel} className="jur-retrait">
            <button className="btn btn-ghost btn-sm" type="submit">
              Retirer la clé enregistrée
            </button>
          </form>
        )}

        {/* L'adresse d'expédition n'est pas un secret : elle se pose en clair,
            sur l'hébergeur. Le dire ici évite la surprise de messages qui
            partent bien mais n'arrivent qu'à soi. */}
        {cleCourriel.source && expediteurEstProvisoire() && (
          <p className="note">
            Aucune adresse d’expédition n’est posée : les messages partent du domaine d’essai de
            Resend, qui n’écrit qu’au titulaire du compte. Posez COURRIEL_EXPEDITEUR au format
            « Nom &lt;adresse@votre-domaine.fr&gt; » pour écrire à vos clients.
          </p>
        )}
      </section>

      <section className="jur-section">
        <h2 className="jur-h2">Les branches attendues</h2>
        <p className="jur-sub">
          Qui a demandé à être prévenu, et pour quoi. C’est le seul chiffre qui dise laquelle
          construire ensuite — les adresses restent en base pour le jour de l’ouverture, et ne
          s’affichent pas ici.
        </p>

        {BRANCHES.filter((branche) => !branche.ouverte).map((branche) => {
          const attente = attentes.get(branche.id);
          return (
            <div className="jur-attente-ligne" key={branche.id}>
              <span className="jur-attente-nom">{branche.label}</span>
              <span className="jur-attente-nombre">{attente?.nombre ?? 0}</span>
              <span className="jur-attente-date">
                {attente ? `dernière demande le ${JOUR.format(new Date(attente.derniere))}` : 'personne pour l’instant'}
              </span>
            </div>
          );
        })}
      </section>

      <form action={sortir} className="jur-sortie">
        <button className="btn btn-ghost btn-sm" type="submit">
          Quitter les réglages
        </button>
      </form>
    </main>
  );
}
