import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Barre } from '@/components/Barre';
import { Pied } from '@/components/Pied';
import { Redaction } from '@/components/Redaction';
import { domaine } from '@/lib/domaines';
import { modeleOuNull } from '@/lib/documents';
import { estJuristeConfigure } from '@/lib/juriste';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ modele: string }>;
}): Promise<Metadata> {
  const { modele: id } = await params;
  const modele = modeleOuNull(id);
  if (!modele) return { title: 'Document introuvable' };
  return { title: modele.titre, description: modele.resume };
}

/**
 * Un document : ce qu'il doit contenir, puis sa rédaction.
 *
 * Les mentions et les pièges sont affichés AVANT le champ, et pas après le
 * courrier. Quelqu'un qui découvre en lisant la liste que son congé doit porter
 * le prix de vente a déjà obtenu l'essentiel — même s'il repart écrire la
 * lettre lui-même.
 */
export default async function Document({ params }: { params: Promise<{ modele: string }> }) {
  const { modele: id } = await params;
  const modele = modeleOuNull(id);
  if (!modele) notFound();

  const fiche = domaine(modele.domaine);
  const actif = await estJuristeConfigure();

  return (
    <>
      <Barre retour={{ href: '/documents', label: 'Tous les documents' }} />

      <main className="jur-page jur-narrow">
        <h1 className="jur-h1 jur-h1-moyen">{modele.titre}</h1>
        <p className="jur-lede">{modele.resume}</p>

        {modele.delai && (
          <section className="jur-bloc jur-delais">
            <h3>Le délai</h3>
            <ul>
              <li>{modele.delai}</li>
            </ul>
          </section>
        )}

        <section className="jur-bloc">
          <h3>Ce qui doit y figurer</h3>
          <p className="hint">
            Un courrier auquel il manque une de ces mentions peut être nul, quelle que soit sa
            qualité de rédaction.
          </p>
          <ul>
            {modele.mentions.map((mention) => (
              <li key={mention}>{mention}</li>
            ))}
          </ul>
        </section>

        <section className="jur-bloc jur-pieges">
          <h3>Ce qui l’annule</h3>
          <ul>
            {modele.pieges.map((piege) => (
              <li key={piege}>{piege}</li>
            ))}
          </ul>
        </section>

        <section className="jur-bloc">
          <h3>Comment l’envoyer</h3>
          <ul>
            <li>{modele.envoi}</li>
          </ul>
          <p className="hint">
            Question de fond sur ce sujet ? Le spécialiste « {fiche.label} » y répond :{' '}
            <a href={`/${modele.domaine}`}>voir sa fiche</a>.
          </p>
        </section>

        <Redaction modele={modele.id} titre={modele.titre} actif={actif} />
      </main>

      <Pied />
    </>
  );
}
