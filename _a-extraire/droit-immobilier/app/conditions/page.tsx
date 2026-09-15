import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { PageLegale } from '@/components/PageLegale';
import { Pied } from '@/components/Pied';
import { CONDITIONS } from '@/lib/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Conditions',
  description:
    'Ce que le service fait, ce qu’il ne fait pas, ce qu’il coûte, comment on l’arrête et comment on se rétracte.',
};

/**
 * Les conditions générales.
 *
 * Elles sont écrites pour être lues, ce qui n'est pas la coutume du genre :
 * phrases courtes, titres qui disent de quoi il s'agit, et les deux articles
 * qu'on cherche vraiment — la résiliation et la rétractation — au milieu
 * plutôt qu'enterrés en fin de page.
 */
export default function Conditions() {
  return (
    <>
      <Barre retour={{ href: '/', label: 'L’assistant' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Le cadre</p>
        <h1 className="jur-h1 jur-h1-moyen">Conditions générales</h1>
        <p className="jur-lede">
          Ce que le service fait, ce qu’il ne fait pas, ce qu’il coûte, comment on l’arrête.
        </p>

        <PageLegale articles={CONDITIONS} />

        <p className="jur-legal-pied">
          Les coordonnées du médiateur et de l’éditeur figurent dans les{' '}
          <a href="/mentions-legales">mentions légales</a>. Le détail du traitement de vos données
          est sur la page <a href="/confidentialite">Vos données</a>.
        </p>
      </main>

      <Pied />
    </>
  );
}
