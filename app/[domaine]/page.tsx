import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Barre } from '@/components/Barre';
import { Repli } from '@/components/Repli';
import { Pied } from '@/components/Pied';
import { Consultation } from '@/components/Consultation';
import { compteCourant } from '@/lib/comptes';
import { CALENDRIER, MAJORITES, PASSERELLES } from '@/lib/copropriete';
import { CALENDRIER_ENERGIE, DIAGNOSTICS } from '@/lib/diagnostics';
import { domaine, domaineOuNull, estDomaineId } from '@/lib/domaines';
import { SPECIALISTE } from '@/lib/copie';
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
  const compte = await compteCourant();
  const actif = await estJuristeConfigure();

  return (
    <>
      <Barre retour={{ href: '/', label: 'Toutes les spécialités' }} />

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
              connecte={Boolean(compte)}
              actif={actif}
            />
          </div>

          <aside className="jur-aside">
            <section className="jur-bloc jur-delais">
              <h3>Délais à ne pas manquer</h3>
              <Repli hauteur={340} quoi="les délais">
                <ul>
                  {fiche.delais.map((delai) => (
                    <li key={delai}>{delai}</li>
                  ))}
                </ul>
              </Repli>
              <p className="hint">{SPECIALISTE.delaisNote}</p>
            </section>

            <section className="jur-bloc">
              <h3>À vérifier avant d’agir</h3>
              <Repli hauteur={260} quoi="la liste">
                <ul>
                  {fiche.verifications.map((verification) => (
                    <li key={verification}>{verification}</li>
                  ))}
                </ul>
              </Repli>
            </section>

            <section className="jur-bloc">
              <h3>Ce que ce spécialiste traite</h3>
              <Repli hauteur={260} quoi="la liste">
                <ul>
                  {fiche.matieres.map((matiere) => (
                    <li key={matiere}>{matiere}</li>
                  ))}
                </ul>
              </Repli>
            </section>

            <section className="jur-bloc">
              <h3>Ce qui relève d’un autre</h3>
              <Repli hauteur={260} quoi="la liste">
                <ul>
                  {fiche.renvois.map((renvoi) => (
                    <li key={renvoi.quand}>
                      {renvoi.quand} —{' '}
                      <a href={`/${renvoi.vers}`}>{domaine(renvoi.vers).label}</a>
                    </li>
                  ))}
                </ul>
              </Repli>
            </section>

            <section className="jur-bloc">
              <h3>Textes de référence</h3>
              <Repli hauteur={260} quoi="la liste">
                <ul>
                  {fiche.sources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </Repli>
            </section>
          </aside>
        </div>

        {fiche.diagnostics && (
          <section className="jur-section">
            <h2 className="jur-h2">Diagnostics et durées de validité</h2>
            <p className="jur-sub">
              Le rapport remis porte sa propre date de réalisation et de fin de validité{'\u202f'}: c’est
              elle qui fait foi. Ce tableau dit ce qu’il faut y chercher.
            </p>

            {/* Douze diagnostics : c'est le plus long bloc de la fiche, et
                celui qu'on consulte pour UNE ligne — la validité de celui
                qu'on a en main. Replié, il tient en un écran et se déroule
                d'un clic. */}
            <Repli hauteur={420} quoi="le tableau">
              <div className="jur-tableau">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Diagnostic</th>
                      <th scope="col">Quand il est exigé</th>
                      <th scope="col">Validité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIAGNOSTICS.map((diagnostic) => (
                      <tr key={diagnostic.nom}>
                        <th scope="row">{diagnostic.nom}</th>
                        <td>{diagnostic.quand}</td>
                        <td>{diagnostic.validite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Repli>

            <h3 className="jur-h3">Interdictions de louer, selon la classe énergie</h3>
            <ul className="jur-calendrier">
              {CALENDRIER_ENERGIE.map((etape) => (
                <li key={etape}>{etape}</li>
              ))}
            </ul>
          </section>
        )}

        {fiche.copropriete && (
          <section className="jur-section">
            <h2 className="jur-h2">Quelle majorité pour quelle décision</h2>
            <p className="jur-sub">
              Une résolution votée à la mauvaise majorité est annulable, et l’annulation emporte
              les travaux, les appels de fonds et le marché signé. Le règlement de copropriété de
              votre immeuble peut être plus exigeant que la loi{' '}: c’est lui qui s’impose alors.
            </p>

            {/* La table que personne ne reconstruit de mémoire sans se tromper.
                Repliée comme celle des diagnostics, et pour la même raison :
                on l'ouvre pour UNE ligne — la décision qu'on a en tête. */}
            <Repli hauteur={420} quoi="le tableau">
              <div className="jur-tableau">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Majorité</th>
                      <th scope="col">Comment elle se compte</th>
                      <th scope="col">Ce qu’elle gouverne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MAJORITES.map((majorite) => (
                      <tr key={majorite.nom + majorite.article}>
                        <th scope="row">
                          {majorite.nom}
                          <span className="jur-source-texte"> — article {majorite.article}</span>
                        </th>
                        <td>{majorite.calcul}</td>
                        <td>
                          <ul>
                            {majorite.decisions.map((decision) => (
                              <li key={decision}>{decision}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Repli>

            <h3 className="jur-h3">Quand la majorité n’est pas atteinte</h3>
            <p className="jur-sub">
              C’est la partie que la plupart des gens ignorent, y compris des syndics{' '}: une
              résolution qui « échoue » peut souvent être adoptée dans la même séance, au second
              vote, sans reconvoquer.
            </p>
            <ul className="jur-calendrier">
              {PASSERELLES.map((passerelle) => (
                <li key={passerelle}>{passerelle}</li>
              ))}
            </ul>

            <h3 className="jur-h3">Le calendrier de l’assemblée</h3>
            <ul className="jur-calendrier">
              {CALENDRIER.map((etape) => (
                <li key={etape}>{etape}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="jur-avertissement jur-section">
          <p>{SPECIALISTE.avertissement}</p>
        </div>
      </main>

      <Pied />
    </>
  );
}
