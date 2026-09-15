import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { Pied } from '@/components/Pied';
import { confirmerLAdresse } from '@/lib/acces';
import { compteCourant } from '@/lib/comptes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirmation de votre adresse',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ jeton: string }> };

/**
 * Le lien de confirmation d'adresse.
 *
 * Il consomme le jeton au chargement, et c'est volontaire : demander un clic
 * de plus sur un bouton « confirmer » après avoir cliqué dans un courriel est
 * une étape que personne ne comprend. Le risque est connu — un antivirus ou un
 * aperçu de messagerie peut préouvrir le lien —, et il est sans conséquence
 * ici : confirmer une adresse n'ouvre aucune session et ne change rien d'autre
 * que la date de confirmation.
 *
 * C'est la raison pour laquelle le mot de passe, lui, n'est PAS posé au
 * chargement de son lien : là, un préchargement changerait un secret.
 */
export default async function Verifier({ params }: Params) {
  const { jeton } = await params;
  const etat = await confirmerLAdresse(jeton);
  const compte = await compteCourant();

  const messages = {
    valide: {
      titre: 'Votre adresse est confirmée',
      corps:
        'C’est fait. Vous pouvez passer à une formule payante, et reprendre la main sur votre compte par courriel si vous en perdez le mot de passe.',
    },
    expire: {
      titre: 'Ce lien a expiré',
      corps:
        'Il n’était valable qu’une heure. Votre compte fonctionne normalement : demandez un nouveau lien depuis votre espace, c’est immédiat.',
    },
    'deja-utilise': {
      titre: 'Cette adresse est déjà confirmée',
      corps: 'Il n’y a rien à faire de plus. Ce lien a servi une première fois et ne resservira pas.',
    },
    inconnu: {
      titre: 'Ce lien n’est pas valable',
      corps:
        'Il a peut-être été coupé en chemin par votre messagerie. Recopiez-le en entier, ou demandez-en un nouveau depuis votre espace.',
    },
  } as const;

  const { titre, corps } = messages[etat];

  return (
    <>
      <Barre retour={{ href: '/', label: 'L’assistant' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Votre compte</p>
        <h1 className="jur-h1 jur-h1-moyen">{titre}</h1>
        <p className="jur-lede">{corps}</p>

        <div className="jur-portail">
          {compte ? (
            <a className="btn btn-accent btn-block" href="/espace">
              Aller à mon espace
            </a>
          ) : (
            <a className="btn btn-accent btn-block" href="/entrer">
              Me connecter
            </a>
          )}
        </div>
      </main>

      <Pied />
    </>
  );
}
