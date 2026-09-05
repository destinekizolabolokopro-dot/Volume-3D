import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Barre } from '@/components/juridique/Barre';
import { Consultation } from '@/components/juridique/Consultation';
import { currentAccount } from '@/lib/accounts';
import { domaine, domaineOuNull, estDomaineId } from '@/lib/domaines';
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

  return (
    <>
      <Barre retour={{ href: '/juridique', label: 'Toutes les spécialités' }} />

      <main className="jur-page">
        <h1 className="jur-h1">{fiche.label}</h1>
        <p className="jur-lede">{fiche.resume}</p>

        {!estJuristeConfigure() && (
          <p className="jur-erreur">
            L’assistant n’est pas configuré sur ce site : la clé ANTHROPIC_API_KEY est absente. La
            fiche ci-dessous reste consultable, mais aucune question ne peut être posée.
          </p>
        )}

        <div className="jur-fiche">
          <div>
            <Consultation
              domaine={fiche.id}
              label={fiche.label}
              exemples={fiche.exemples}
              questionInitiale={q ?? ''}
              connecte={Boolean(account)}
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
              <p className="hint" style={{ marginTop: 12 }}>
                Si un document que vous avez reçu mentionne un autre délai, c’est lui qui fait foi.
              </p>
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

        <div className="jur-avertissement">
          Cette réponse est une information juridique, pas une consultation d’avocat. Elle ne tient
          compte que de ce que vous avez écrit, et rien n’y remplace la lecture de vos documents par
          un professionnel. En cas de délai en cours, prenez conseil sans attendre : un point-justice
          reçoit gratuitement, et l’aide juridictionnelle peut prendre en charge un avocat.
        </div>
      </main>
    </>
  );
}
