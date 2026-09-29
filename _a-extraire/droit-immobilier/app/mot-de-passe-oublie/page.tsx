import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { DemandeDeLien } from '@/components/MotDePasse';
import { Pied } from '@/components/Pied';
import { courrielConfigure } from '@/lib/courriel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
  robots: { index: false, follow: false },
};

/**
 * Mot de passe oublié.
 *
 * L'écran dit AVANT le formulaire quand l'envoi de courriels n'est pas
 * configuré : proposer un champ dont on sait que rien ne sortira est la
 * définition d'un piège, et celui qui lit ce message est aussi celui qui peut
 * poser la clé.
 */
export default async function MotDePasseOublie() {
  const courrielPret = await courrielConfigure();

  return (
    <>
      <Barre retour={{ href: '/entrer', label: 'Connexion' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Reprendre la main</p>
        <h1 className="jur-h1 jur-h1-moyen">Mot de passe oublié</h1>
        <p className="jur-lede">
          Donnez l’adresse de votre compte : un lien vous y sera envoyé pour en choisir un nouveau.
          Vos consultations ne bougent pas.
        </p>

        {courrielPret ? (
          <DemandeDeLien />
        ) : (
          <div className="jur-portail">
            <p className="jur-erreur" role="status">
              Ce site ne peut pas encore envoyer de courriel : la clé RESEND_API_KEY est absente.
              Tant qu’elle manque, un mot de passe perdu ne peut pas être repris tout seul.
            </p>
            <a className="btn btn-ghost btn-block" href="/entrer">
              Revenir à la connexion
            </a>
          </div>
        )}
      </main>

      <Pied />
    </>
  );
}
