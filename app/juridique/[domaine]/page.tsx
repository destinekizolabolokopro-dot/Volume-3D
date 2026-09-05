import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Barre } from '@/components/juridique/Barre';
import { Consultation } from '@/components/juridique/Consultation';
import { currentAccount } from '@/lib/accounts';
import { domaine, domaineOuNull, estDomaineId } from '@/lib/domaines';
import { SPECIALISTE } from '@/lib/juridique-copie';
import { estJuristeConfigure } from '@/lib/juriste';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ domaine: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { domaine: id } = await params;
  const fiche = domaineOuNull(id);
  if (!fiche) return { title: 'Spécialité introuvable' };
  return {
    title: fiche.label,
    description: `${fiche.resume} Ce que dit la règle, ce que vous pouvez faire, et les délais à ne pas manquer.`,
  };
}

/**
 * La page d'un spécialiste.
 *
 * La fiche est affichée avant la première question, et non pliée derrière un
 * bouton : ce que le spécialiste ne traite pas, et surtout les délais, valent
 * souvent plus que la première réponse. Quelqu'un qui apprend en arrivant
 * qu'il lui reste deux mois pour contester a déjà obtenu ce qu'il venait
 * chercher.
 */
export default async function PageDomaine({ params, searchParams }: Params) {
  const { domaine: id } = await params;
  if (!estDomaineId(id)) notFound();

  const fiche = domaine(id);
  const { q } = await searchParams;
  const account = await currentAccount();
  const actif = estJuristeConfigure();

  return (
    <>
      <Barre retour={{ href: '/juridique', label: 'Toutes les spécialités' }} />

      <main className="jur-page">
        <h1 className="jur-h1">{fiche.label}</h1>
        <p className="jur-lede">{fiche.resume}</p>

        {!actif && <p className="jur-erreur">{SPECIALISTE.inactif}</p>}

        <div className="jur-fiche">
          <div>
            <Consultation
              domaine={fiche.id}
              label={fiche.label}
              exemples={fiche.exemples}
              questionInitiale={q ?? ''}
              connecte={Boolean(account)}
              actif={actif}
            />
          </div>

          <aside className="jur-aside">
            <section className="jur-bloc jur-delais">
              <h3>Délais à ne pas manquer</h3>
              <ul>
                {fiche.delais.map((delai) => (
                  <li key={delai}>{delai}</li>
                ))}
              </ul>
              <p className="hint">{SPECIALISTE.delaisNote}</p>
            </section>

            <section className="jur-bloc">
              <h3>Ce que ce spécialiste traite</h3>
              <ul>
                {fiche.matieres.map((matiere) => (
                  <li key={matiere}>{matiere}</li>
                ))}
              </ul>
            </section>

            <section className="jur-bloc">
              <h3>Ce qui relève d’un autre</h3>
              <ul>
                {fiche.renvois.map((renvoi) => (
                  <li key={renvoi.quand}>
                    {renvoi.quand} —{' '}
                    <a href={`/juridique/${renvoi.vers}`}>{domaine(renvoi.vers).label}</a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="jur-bloc">
              <h3>Textes de référence</h3>
              <ul>
                {fiche.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <div className="jur-avertissement jur-section">
          <p>{SPECIALISTE.avertissement}</p>
        </div>
      </main>
    </>
  );
}
