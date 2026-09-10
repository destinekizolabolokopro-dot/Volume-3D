import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { Pied } from '@/components/Pied';
import { FAMILLES, modelesDeLaFamille } from '@/lib/documents';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rédiger un document',
  description:
    'Congé, mise en demeure, contestation d’assemblée, mandat, déclaration de sinistre : dix-sept courriers rédigés pour votre situation, avec les mentions qui les rendent valables.',
};

/**
 * Le catalogue des documents.
 *
 * Rangé par famille et non par ordre alphabétique : quelqu'un cherche « ce que
 * je peux envoyer à mon locataire », pas un titre exact qu'il ne connaît pas.
 */
export default function Documents() {
  return (
    <>
      <Barre retour={{ href: '/', label: 'L’assistant' }} />

      <main className="jur-page">
        <h1 className="jur-h1">Rédiger un document</h1>
        <p className="jur-lede">
          Dix-sept courriers et actes, écrits pour votre situation et non remplis dans un modèle type.
          Chacun porte les mentions sans lesquelles il serait nul, et la liste de ce qu’il vous reste à
          compléter avant de l’envoyer.
        </p>

        {FAMILLES.map((famille) => (
          <section className="jur-section" key={famille.id}>
            <h2 className="jur-h2">{famille.label}</h2>
            <p className="jur-sub">{famille.resume}</p>

            <div className="jur-grid">
              {modelesDeLaFamille(famille.id).map((modele) => (
                <a className="jur-card" key={modele.id} href={`/documents/${modele.id}`}>
                  <h3>{modele.titre}</h3>
                  <p>{modele.resume}</p>
                  {modele.delai && <span className="jur-card-delai">{modele.delai}</span>}
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>

      <Pied />
    </>
  );
}
