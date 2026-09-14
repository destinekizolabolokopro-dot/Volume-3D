import type { Article } from '@/lib/legal';

/**
 * Le gabarit des trois pages du cadre : mentions légales, confidentialité,
 * conditions de vente.
 *
 * Elles ont la même forme parce qu'elles ont le même usage : on n'y arrive
 * jamais par curiosité, on y cherche une réponse précise et on veut la
 * trouver sans lire le reste. D'où des articles numérotés, un sommaire cliquable
 * en tête, et des paragraphes courts.
 *
 * Les articles sont numérotés en chiffres arabes, et non en romains comme les
 * rubriques de l'accueil : ici le numéro sert à CITER — « votre article 4 » se
 * dit dans une réclamation, « votre article IV » ne se dit pas.
 */
export function PageLegale({ articles }: { articles: Article[] }) {
  return (
    <>
      <nav className="jur-sommaire" aria-label="Sommaire">
        <ol>
          {articles.map((article, rang) => (
            <li key={article.titre}>
              <a href={`#article-${rang + 1}`}>{article.titre}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="jur-articles">
        {articles.map((article, rang) => (
          <section className="jur-article" id={`article-${rang + 1}`} key={article.titre}>
            <h2>
              <span aria-hidden="true">{rang + 1}</span>
              {article.titre}
            </h2>

            {article.corps.map((paragraphe) => (
              <p key={paragraphe}>{paragraphe}</p>
            ))}

            {article.points && (
              <ul>
                {article.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * Le bandeau des mentions qui manquent.
 *
 * Il s'adresse à celui qui exploite le site, pas à son visiteur — mais il est
 * visible de tous, et c'est voulu : une mention légale incomplète se répare en
 * cinq minutes, et la seule chose qui la fait réparer est qu'elle se voie.
 */
export function MentionsAPoser({
  manquantes,
}: {
  manquantes: { label: string; variable: string; aide?: string }[];
}) {
  if (manquantes.length === 0) return null;

  return (
    <div className="jur-aposer" role="status">
      <p>
        <strong>
          Cette page est incomplète : {manquantes.length}{' '}
          {manquantes.length > 1 ? 'mentions obligatoires manquent' : 'mention obligatoire manque'}.
        </strong>{' '}
        Elles ne sont pas inventées, parce qu’une mention légale fausse a l’apparence exacte d’une
        vraie. Renseignez ces variables chez votre hébergeur, et ce bandeau disparaîtra.
      </p>
      <dl>
        {manquantes.map((m) => (
          <div key={m.variable}>
            <dt>
              <code>{m.variable}</code>
            </dt>
            <dd>
              {m.label}
              {m.aide ? ` — ${m.aide}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
