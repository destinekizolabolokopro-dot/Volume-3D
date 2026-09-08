import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Barre } from '@/components/Barre';
import { Portail } from '@/components/Portail';
import { compteCourant, sessionsConfigurees } from '@/lib/comptes';
import { isLocalStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entrer',
  robots: { index: false, follow: false },
};

type Params = { searchParams: Promise<{ mode?: string }> };

/**
 * Ce qui manque à l'hébergement pour qu'un compte tienne, ou une chaîne vide.
 *
 * Dit avant le formulaire plutôt qu'après l'envoi : proposer un champ de mot
 * de passe qu'on sait inopérant est la définition d'un piège.
 */
function obstacle(): string {
  if (!sessionsConfigurees()) {
    return 'Ce site n’est pas encore configuré pour tenir des comptes : la variable AUTH_SECRET est absente. L’assistant, les fiches et les délais restent accessibles sans compte.';
  }
  if (isLocalStore() && process.env.NODE_ENV === 'production') {
    return 'Ce site n’est pas encore relié à une base de données : un compte créé ici serait perdu au premier redéploiement. L’assistant reste accessible sans compte.';
  }
  return '';
}

export default async function Connexion({ searchParams }: Params) {
  if (await compteCourant()) redirect('/compte');
  const { mode } = await searchParams;
  const empeche = obstacle();

  return (
    <>
      <Barre retour={{ href: '/', label: 'L’assistant' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Votre compte</p>
        <h1 className="jur-h1 jur-h1-moyen">Vos consultations, retrouvées.</h1>
        <p className="jur-lede">
          Un compte sert à trois choses : conserver vos échanges et les rouvrir, déposer un document
          à faire lire, et lever la limite de trois questions par jour. Rien n’y est demandé de plus
          que votre nom et une adresse.
        </p>

        {empeche ? (
          <div className="jur-portail">
            <p className="jur-erreur" role="status">
              {empeche}
            </p>
            <a className="btn btn-accent btn-block" href="/">
              Poser une question sans compte
            </a>
          </div>
        ) : (
          <Portail depart={mode === 'inscription' ? 'inscription' : 'connexion'} />
        )}
      </main>
    </>
  );
}
