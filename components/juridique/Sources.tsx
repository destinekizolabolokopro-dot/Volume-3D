import type { Reference } from '@/lib/juridique/citations';

/**
 * Ce sur quoi la réponse s'appuie.
 *
 * Ces références ne sont pas écrites par le modèle : elles viennent de l'API,
 * qui rattache chaque passage cité au bloc du texte officiel dont il sort. Le
 * numéro affiché est donc lu dans le fonds LEGI, jamais produit de mémoire.
 * C'est la seule raison pour laquelle on peut se permettre de l'afficher.
 *
 * Replié par défaut, et à dessein. Quelqu'un qui demande s'il peut donner
 * congé veut d'abord la réponse ; le texte est là pour la personne qui doute,
 * pour celle qui doit écrire un courrier, et pour le professionnel qui engage
 * sa responsabilité. Les trois savent l'ouvrir.
 */
export function Sources({ references }: { references: Reference[] }) {
  if (references.length === 0) return null;

  return (
    <details className="jur-sources">
      <summary>
        {references.length === 1 ? 'Le texte cité' : `Les ${references.length} textes cités`}
      </summary>
      <ul>
        {references.map((reference, index) => (
          <li key={index}>
            <p className="jur-source-titre">
              {reference.article}
              <span className="jur-source-texte"> — {reference.source}</span>
            </p>
            {reference.chemin.length > 0 && (
              <p className="jur-source-chemin">{reference.chemin.join(' › ')}</p>
            )}
            {reference.extrait && <blockquote>{reference.extrait}</blockquote>}
          </li>
        ))}
      </ul>
    </details>
  );
}
