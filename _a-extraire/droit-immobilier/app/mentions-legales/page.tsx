import type { Metadata } from 'next';
import { Barre } from '@/components/Barre';
import { MentionsAPoser } from '@/components/PageLegale';
import { Pied } from '@/components/Pied';
import { editeur, hebergeur, mediateur, mentionsManquantes, type Mention } from '@/lib/editeur';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Qui édite ce site, qui l’héberge, et à qui s’adresser.',
};

/** Une rubrique de mentions : les vides sont passées, jamais remplacées. */
function Rubrique({ titre, mentions }: { titre: string; mentions: Mention[] }) {
  const posees = mentions.filter((m) => m.valeur);

  return (
    <section className="jur-mentions">
      <h2>{titre}</h2>
      {posees.length === 0 ? (
        <p className="jur-mentions-vide">Aucune de ces mentions n’est encore renseignée.</p>
      ) : (
        <dl>
          {posees.map((m) => (
            <div key={m.variable}>
              <dt>{m.label}</dt>
              <dd>{m.valeur}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/**
 * Les mentions légales.
 *
 * Trois rubriques, telles que la loi les demande : qui édite, qui héberge, et
 * — parce que ce site vend à des particuliers — quel médiateur saisir.
 *
 * Rien n'est écrit en dur ici : tout vient de l'environnement, et ce qui
 * manque est nommé en tête plutôt que comblé. Voir lib/editeur.ts.
 */
export default function MentionsLegales() {
  return (
    <>
      <Barre retour={{ href: '/', label: 'L’assistant' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Le cadre</p>
        <h1 className="jur-h1 jur-h1-moyen">Mentions légales</h1>
        <p className="jur-lede">
          Qui édite ce site, qui l’héberge, et à qui s’adresser en cas de désaccord.
        </p>

        <MentionsAPoser manquantes={mentionsManquantes()} />

        <Rubrique titre="L’éditeur" mentions={editeur()} />
        <Rubrique titre="L’hébergeur" mentions={hebergeur()} />
        <Rubrique titre="Le médiateur de la consommation" mentions={mediateur()} />

        <section className="jur-mentions">
          <h2>Propriété intellectuelle</h2>
          <p>
            Les fiches de spécialité, les modèles de courriers et la présentation de ce site sont
            protégés. Les textes de loi cités, eux, ne le sont pas : ils proviennent du fonds LEGI
            de la Direction de l’information légale et administrative, diffusé sous licence ouverte,
            et chacun peut les reprendre.
          </p>
        </section>
      </main>

      <Pied />
    </>
  );
}
