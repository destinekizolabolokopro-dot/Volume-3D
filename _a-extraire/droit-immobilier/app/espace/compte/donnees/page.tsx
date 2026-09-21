import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supprimerMonCompte } from '@/app/espace/actions';
import { compteCourant } from '@/lib/comptes';
import { consultationsDuCompte } from '@/lib/consultations';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes données',
  robots: { index: false, follow: false },
};

type Params = { searchParams: Promise<{ erreur?: string }> };

/**
 * Mes données : emporter, ou effacer.
 *
 * Les deux droits que le RGPD accorde à tout le monde et que presque personne
 * n'exerce, parce qu'ils sont d'ordinaire enterrés derrière un formulaire de
 * contact et un délai d'un mois. Ici, deux boutons.
 *
 * L'inventaire de ce qui sera emporté — ou effacé — est affiché AVANT les
 * boutons, et compté pour de vrai. « Vos données » ne veut rien dire ; « trois
 * consultations, quarante et un messages, deux courriers » se comprend, et
 * c'est ce qui permet de décider.
 */
export default async function MesDonnees({ searchParams }: Params) {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const { erreur } = await searchParams;

  const fils = await consultationsDuCompte(compte.id);
  const courriers = await getStore().list('documentsRediges', { compteId: compte.id });

  /* Compté fil par fil : la couche de stockage ne rend qu'un millier de lignes
     d'un coup, et un total faux sur cette page-ci serait le pire endroit. */
  let messages = 0;
  for (const fil of fils) {
    messages += (await getStore().list('consultationTours', { consultationId: fil.id })).length;
  }

  return (
    <main className="jur-page jur-espace-page jur-etroit">
      <p className="jur-oeil">Mon compte</p>
      <h1 className="jur-h1 jur-h1-moyen">Mes données</h1>
      <p className="jur-lede">
        Ce que ce site détient sur vous, en entier. Vous pouvez en emporter une copie ou tout
        effacer, sans rien demander à personne.
      </p>

      <section className="jur-inventaire">
        <h2>Ce qu’il y a</h2>
        <dl>
          <div>
            <dt>{fils.length}</dt>
            <dd>consultation{fils.length > 1 ? 's' : ''}</dd>
          </div>
          <div>
            <dt>{messages}</dt>
            <dd>message{messages > 1 ? 's' : ''} dans ces fils</dd>
          </div>
          <div>
            <dt>{courriers.length}</dt>
            <dd>courrier{courriers.length > 1 ? 's' : ''} rédigé{courriers.length > 1 ? 's' : ''}</dd>
          </div>
        </dl>
        <p className="jur-inventaire-note">
          Plus votre nom, votre adresse et votre formule. Les documents que vous avez joints à une
          question ne sont pas dans cette liste : ils n’ont jamais été enregistrés. Le détail est
          sur la page <a href="/confidentialite">Vos données</a>.
        </p>
      </section>

      <section className="jur-geste">
        <h2>Emporter une copie</h2>
        <p>
          Un fichier JSON, lisible par vous comme par un autre service : votre compte, vos
          consultations avec tous leurs messages, et la liste des courriers rédigés. Ni votre mot
          de passe ni les jetons de service n’y figurent — ce sont des secrets du serveur, pas des
          données sur vous.
        </p>
        <a className="btn btn-ghost" href="/api/mes-donnees" download>
          Télécharger mes données
        </a>
      </section>

      <section className="jur-geste jur-geste-grave">
        <h2>Tout effacer</h2>
        <p>
          La suppression efface le compte, les {fils.length} consultation
          {fils.length > 1 ? 's' : ''}, leurs messages et la trace des courriers. Elle est
          immédiate et sans retour : il n’y a pas de corbeille, et nous ne gardons pas de copie.
        </p>
        <p>
          Si vous voulez garder une trace de vos échanges, téléchargez-les d’abord — après, ce sera
          trop tard.
        </p>

        {erreur === 'adresse' && (
          <p className="jur-erreur" role="alert">
            L’adresse recopiée ne correspond pas à celle du compte. Rien n’a été effacé.
          </p>
        )}

        <form action={supprimerMonCompte} className="jur-geste-forme">
          <label htmlFor="confirmation">
            Pour confirmer, recopiez votre adresse : <strong>{compte.email}</strong>
          </label>
          <input
            id="confirmation"
            name="confirmation"
            type="email"
            autoComplete="off"
            spellCheck={false}
            required
            placeholder={compte.email}
          />
          <button className="btn btn-ghost btn-danger" type="submit">
            Supprimer définitivement mon compte
          </button>
        </form>
      </section>
    </main>
  );
}
