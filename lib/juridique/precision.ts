/**
 * La question que le spécialiste pose avant de répondre.
 *
 * C'est la différence entre un moteur de réponses et quelqu'un qui écoute.
 * « Puis-je donner congé ? » n'a pas de réponse : elle en a quatre, selon que
 * le bail est vide ou meublé, que le congé soit pour vente, pour reprise ou
 * pour motif légitime. Un assistant qui choisit tout seul l'une des quatre a
 * une chance sur quatre d'avoir raison, et zéro chance de le savoir.
 *
 * Le modèle ne rédige donc pas sa question dans le texte de sa réponse : il
 * la renvoie par un outil, sous forme structurée. La page peut alors afficher
 * de vrais boutons — un clic plutôt qu'une phrase à retaper —, et le fil
 * garde une trace lisible de ce qui a été demandé.
 *
 * Ce module est pur : la mise en forme de la question s'y teste sans réseau.
 */

export interface Precision {
  /** La question, une seule, formulée pour être comprise sans jargon. */
  question: string;
  /** Pourquoi elle change la réponse. Affiché en petit sous la question. */
  pourquoi: string;
  /** Réponses proposées. Vide quand la réponse est une date ou un montant. */
  options: string[];
}

/** Au-delà, ce n'est plus un choix mais un formulaire. */
export const MAX_OPTIONS = 5;
const MAX_QUESTION = 240;
const MAX_OPTION = 60;

/**
 * Nettoie ce que le modèle a renvoyé. Une question vide n'est pas une
 * question : on préfère alors ne rien afficher plutôt qu'une bulle muette.
 */
export function lirePrecision(brut: unknown): Precision | null {
  if (!brut || typeof brut !== 'object') return null;
  const entree = brut as { question?: unknown; pourquoi?: unknown; options?: unknown };

  const question = String(entree.question ?? '').trim().slice(0, MAX_QUESTION);
  if (question.length < 3) return null;

  const options = Array.isArray(entree.options)
    ? entree.options
        .map((option) => String(option ?? '').trim().slice(0, MAX_OPTION))
        .filter(Boolean)
        .slice(0, MAX_OPTIONS)
    : [];

  return {
    question,
    pourquoi: String(entree.pourquoi ?? '').trim().slice(0, MAX_QUESTION),
    options,
    /* Une seule option n'offre aucun choix : autant laisser la personne
       écrire, elle en dira plus. */
    ...(options.length === 1 ? { options: [] } : {}),
  };
}

/**
 * La question telle qu'elle est conservée dans le fil.
 *
 * Le tour enregistré reste du texte ordinaire — c'est ce qui permet de
 * rouvrir une consultation des mois plus tard sans dépendre de la forme que
 * l'outil avait ce jour-là, et de renvoyer l'historique au modèle sans avoir
 * à reconstituer un appel d'outil sans réponse.
 */
export function texteDeLaQuestion(precision: Precision): string {
  const lignes = [precision.question];
  if (precision.pourquoi) lignes.push('', precision.pourquoi);
  if (precision.options.length > 0) {
    lignes.push('', ...precision.options.map((option) => `— ${option}`));
  }
  return lignes.join('\n');
}
