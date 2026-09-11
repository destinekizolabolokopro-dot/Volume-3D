import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { NouveauMotDePasse } from '@/components/MotDePasse';
import { Pied } from '@/components/Pied';
import { relireJeton } from '@/lib/acces';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ jeton: string }> };

/**
 * Le bout du lien reçu par courriel.
 *
 * Le jeton est relu ICI, avant d'afficher quoi que ce soit : montrer deux
 * champs de mot de passe à quelqu'un dont le lien a expiré, pour le lui dire
 * après qu'il les a remplis, est une perte de temps doublée d'une vexation.
 *
 * Les trois refus disent trois choses différentes, et la nuance sert :
 * « expiré » veut dire redemandez, « déjà servi » veut dire c'est peut-être
 * fait, « pas valable » veut dire le lien est incomplet — ce qui arrive
 * souvent, un client mail coupant les longues adresses.
 */
export default async function ReprendreLeMotDePasse({ params }: Params) {
  const { jeton } = await params;
  const { etat } = await relireJeton(jeton, 'mot-de-passe');

  const refus = {
    expire: 'Ce lien a expiré : il n’était valable qu’une heure. Demandez-en un nouveau, c’est immédiat.',
    'deja-utilise':
      'Ce lien a déjà servi. Si vous avez bien choisi un nouveau mot de passe, connectez-vous ; sinon, demandez un nouveau lien.',
    inconnu:
      'Ce lien n’est pas valable. Il a peut-être été coupé en chemin par votre messagerie : recopiez-le en entier, ou demandez-en un nouveau.',
  } as const;

  return (
    <>
      <Barre retour={{ href: '/entrer', label: 'Connexion' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Reprendre la main</p>
        <h1 className="jur-h1 jur-h1-moyen">
          {etat === 'valide' ? 'Choisissez un mot de passe' : 'Ce lien ne fonctionne plus'}
        </h1>

        {etat === 'valide' ? (
          <>
            <p className="jur-lede">
              Il remplacera l’ancien immédiatement, et refermera les autres liens envoyés à votre
              adresse.
            </p>
            <NouveauMotDePasse jeton={jeton} />
          </>
        ) : (
          <div className="jur-portail">
            <p className="jur-erreur" role="alert">
              {refus[etat]}
            </p>
            <a className="btn btn-accent btn-block" href="/mot-de-passe-oublie">
              Demander un nouveau lien
            </a>
          </div>
        )}
      </main>

      <Pied />
    </>
  );
}
