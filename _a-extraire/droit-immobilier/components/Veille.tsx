import type { SourceWeb } from '@/lib/veille';

/**
 * Les pages consultées en ligne pour cette réponse.
 *
 * Elles ne viennent pas du texte de la réponse : ce sont les pages que l'API
 * a rattachées aux passages cités, filtrées sur la liste fermée de
 * lib/veille.ts. Une adresse affichée ici a donc été réellement lue, et elle
 * appartient à un site qu'on a choisi d'avance — ce qui est la seule raison
 * pour laquelle on peut se permettre de la montrer.
 *
 * Deux natures, et l'écran les sépare. Une page de l'INSEE donne l'indice ;
 * une page de la FNAIM donne l'avis d'une fédération. Les afficher pareil
 * reviendrait à laisser croire que la seconde fait loi, ce qui est
 * exactement l'erreur que ce service doit éviter de fabriquer.
 *
 * Replié comme les textes cités, et au même endroit : dans le détail
 * juridique. Celui qui l'ouvre est venu vérifier.
 */
export function Veille({ sources }: { sources: SourceWeb[] }) {
  if (sources.length === 0) return null;

  return (
    <details className="jur-sources jur-veille">
      <summary>
        {sources.length === 1
          ? 'La page consultée en ligne'
          : `Les ${sources.length} pages consultées en ligne`}
      </summary>
      <ul>
        {sources.map((source) => (
          <li key={source.url}>
            <p className="jur-source-titre">
              {/* `noreferrer` autant que `noopener` : le site consulté n'a pas
                  à savoir depuis quelle page quelqu'un est arrivé chez lui. */}
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.titre}
              </a>
              <span className="jur-source-texte"> — {source.nom}</span>
              {source.nature === 'professionnelle' && (
                <span className="jur-veille-avis" title="Avis de professionnel, pas une règle de droit">
                  avis professionnel
                </span>
              )}
            </p>
            {source.extrait && <blockquote>{source.extrait}</blockquote>}
          </li>
        ))}
      </ul>
      <p className="jur-veille-note">
        Ces pages servent à vérifier ce qui bouge — un indice, un plafond, un calendrier. La règle,
        elle, vient des textes officiels cités plus haut. Une fédération professionnelle donne un
        avis, jamais une règle.
      </p>
    </details>
  );
}
