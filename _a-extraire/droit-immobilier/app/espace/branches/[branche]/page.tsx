import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { attentesDuCompte } from '@/lib/attentes';
import { brancheOuNull } from '@/lib/branches';
import { compteCourant } from '@/lib/comptes';
import { basculerLAttente } from './actions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ branche: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { branche } = await params;
  const fiche = brancheOuNull(branche);
  return {
    title: fiche ? fiche.label : 'Branche',
    robots: { index: false, follow: false },
  };
}

/**
 * Une branche annoncée.
 *
 * Elle dit trois choses, et rien de plus : ce qu'elle couvrira, sur quels
 * textes elle s'appuiera, et comment être prévenu. Pas de date — il n'y en a
 * pas, et en inventer une transformerait une annonce honnête en promesse
 * manquée.
 *
 * La liste des spécialités et celle des textes sont écrites au même niveau de
 * détail que pour l'immobilier, et c'est le seul moyen de rendre l'annonce
 * vérifiable : le jour de l'ouverture, on pourra comparer ce qui est livré à
 * ce qui était dit ici.
 */
export default async function BrancheAnnoncee({ params }: Params) {
  const { branche } = await params;
  const fiche = brancheOuNull(branche);
  if (!fiche) notFound();

  /* Une branche ouverte n'a pas de page d'annonce : elle a l'assistant. */
  if (fiche.ouverte) redirect('/espace');

  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const attendues = await attentesDuCompte(compte.id);
  const inscrit = attendues.includes(fiche.id);

  return (
    <main className="jur-page jur-espace-page">
      <p className="jur-oeil">Branche à venir</p>
      <h1 className="jur-h1">{fiche.label}</h1>
      <p className="jur-lede">{fiche.resume}</p>

      <div className="jur-branche-attente" data-inscrit={inscrit ? '1' : undefined}>
        <div>
          <h2 className="jur-h2">
            {inscrit ? 'Vous serez prévenu' : 'Cette branche n’est pas encore ouverte'}
          </h2>
          <p>
            {inscrit
              ? 'Un seul message partira, le jour où elle ouvrira. Cette liste ne sert à rien d’autre.'
              : 'Ouvrir une branche, c’est construire son fonds : choisir les textes officiels, les découper en articles citables, relever les délais qui ne se rattrapent pas. Tant que ce n’est pas fait, elle ne répond pas — plutôt que de répondre sans citer.'}
          </p>
        </div>

        <form action={basculerLAttente}>
          <input type="hidden" name="branche" value={fiche.id} />
          {inscrit && <input type="hidden" name="retirer" value="1" />}
          <button className={inscrit ? 'btn btn-ghost' : 'btn btn-accent'} type="submit">
            {inscrit ? 'Ne plus être prévenu' : 'Prévenez-moi à l’ouverture'}
          </button>
        </form>
      </div>

      <section className="jur-section">
        <h2 className="jur-h2">Pour qui</h2>
        <p className="jur-sub">{fiche.pour}</p>
      </section>

      <div className="jur-fiche-annonce">
        <section className="jur-bloc">
          <h3>Ce qu’elle traitera</h3>
          <ul>
            {fiche.specialites.map((specialite) => (
              <li key={specialite}>{specialite}</li>
            ))}
          </ul>
        </section>

        <section className="jur-bloc">
          <h3>Les textes qui lui serviront</h3>
          <ul>
            {fiche.textes.map((texte) => (
              <li key={texte}>{texte}</li>
            ))}
          </ul>
          <p className="hint">
            Ce sont ces textes-là qui seront joints aux questions le jour de l’ouverture, et vous
            pourrez le vérifier : chaque réponse cite l’article exact sur lequel elle s’appuie.
          </p>
        </section>
      </div>

      <p className="jur-restant">
        En attendant, le droit immobilier est ouvert et répond.
        <a href="/espace">Poser une question</a>
      </p>
    </main>
  );
}
