/**
 * Ce sur quoi la réponse s'appuie, ramené à quelque chose de lisible.
 *
 * Quand le corpus est joint, l'API rattache chaque passage cité au bloc dont
 * il sort. Ce fichier traduit ces indices en références : le texte, l'article,
 * et l'extrait exact. Il ne connaît ni l'API ni le corpus — il reçoit un plan
 * et des citations brutes, ce qui le rend testable sans clé et sans fichier.
 *
 * Deux choix méritent d'être dits.
 *
 * Une citation dont l'indice ne tombe sur rien est JETÉE, pas rendue
 * approximativement. Une référence à moitié juste est le seul défaut que ce
 * projet ne peut pas se permettre : elle sera recopiée dans un courrier.
 *
 * Les doublons sont fondus par article, en gardant le premier extrait. Un
 * modèle qui s'appuie trois fois sur l'article 15 a une bonne raison de le
 * faire, mais la personne n'a pas besoin de le lire trois fois.
 */

import type { PlanCorpus } from './corpus';

/**
 * Une citation telle que l'API la renvoie, réduite à ce qu'on en utilise. Le
 * type est structurel, pas importé du SDK : ce fichier doit pouvoir tourner
 * dans un test qui n'a pas de clé.
 */
export interface CitationBrute {
  type?: string;
  document_index?: number;
  start_block_index?: number;
  cited_text?: string;
}

export interface Reference {
  /** Le texte, sous son nom court : « loi du 6 juillet 1989 ». */
  source: string;
  /** « Article 15 ». */
  article: string;
  /** Le passage exact, tel qu'il a servi. */
  extrait: string;
  /** La place dans le plan du texte. Sert à retrouver l'article. */
  chemin: string[];
}

/** Un extrait trop long cesse d'être une preuve et redevient un paragraphe. */
const LONGUEUR_EXTRAIT = 400;

function raccourcir(extrait: string): string {
  const propre = extrait.replace(/\s+/g, ' ').trim();
  if (propre.length <= LONGUEUR_EXTRAIT) return propre;
  const coupe = propre.slice(0, LONGUEUR_EXTRAIT);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > LONGUEUR_EXTRAIT * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

export function rassemblerLesReferences(citations: CitationBrute[], plan: PlanCorpus): Reference[] {
  const trouvees = new Map<string, Reference>();

  for (const citation of citations) {
    const document = plan.documents[citation.document_index ?? -1];
    if (!document) continue;

    const article = document.articles[citation.start_block_index ?? -1];
    if (!article) continue;

    const cle = `${citation.document_index}:${citation.start_block_index}`;
    if (trouvees.has(cle)) continue;

    trouvees.set(cle, {
      source: document.source,
      article: article.article,
      extrait: raccourcir(citation.cited_text ?? ''),
      chemin: article.chemin,
    });
  }

  return [...trouvees.values()];
}
