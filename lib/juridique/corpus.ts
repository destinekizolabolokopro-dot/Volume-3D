/**
 * Le corpus, côté site.
 *
 * `scripts/corpus.mjs` écrit `corpus/<domaine>.json` à partir du fonds LEGI ;
 * ce fichier-ci le relit. Rien de plus. Aucun appel réseau, aucune base : les
 * textes sont des fichiers versionnés avec le code, et une réponse juridique
 * ne dépend donc jamais de la disponibilité d'un serveur tiers au moment où
 * quelqu'un pose sa question.
 *
 * ── Pourquoi des blocs et pas un gros texte ─────────────────────────────────
 * Chaque article devient UN bloc de contenu dans le document envoyé au modèle.
 * C'est ce découpage qui rend la citation exploitable : l'API renvoie l'indice
 * du bloc cité, donc l'article exact, au lieu d'un décalage en caractères qu'il
 * faudrait retraduire. Le numéro n'est plus produit par le modèle — il est lu
 * dans le fonds. C'est toute la différence entre « appuyé sur un texte » et
 * « qui a l'air appuyé sur un texte ».
 *
 * ── Ce que le corpus n'est pas ──────────────────────────────────────────────
 * Il n'est pas la connaissance du spécialiste ; il est ce qu'il a le droit de
 * citer. La jurisprudence, la doctrine, les usages, les délais rappelés dans
 * `lib/domaines.ts` n'y sont pas, et n'ont pas à y être : ils se nomment sans
 * se numéroter. Un corpus absent ne casse rien — le spécialiste répond alors
 * comme avant, sans citer.
 */

import type { DomaineId } from './domaines';

export interface ArticleCorpus {
  /** Le numéro tel que le fonds le porte : « 15 », « L. 324-1-1 », « R. 111-2 ». */
  num: string;
  /** Sa place dans le plan du texte, du livre à la section. */
  chemin: string[];
  texte: string;
}

export interface DocumentCorpus {
  /** Le nom court, celui qui s'affiche sous une citation. */
  nom: string;
  /** L'intitulé officiel complet, tel qu'il figure au fonds. */
  titre: string;
  cid: string;
  articles: ArticleCorpus[];
}

export interface Corpus {
  domaine: DomaineId;
  /** La date à laquelle le fonds a été arrêté. Elle s'affiche : un texte a un âge. */
  arrete: string;
  documents: DocumentCorpus[];
}

/**
 * Le plan : ce qu'il faut pour retrouver un article à partir de ce que l'API
 * renvoie — l'indice du document, puis l'indice du bloc.
 */
export interface PlanCorpus {
  documents: Array<{
    source: string;
    articles: Array<{ article: string; chemin: string[] }>;
  }>;
}

/**
 * « 15 » → « Article 15 ». Le fonds porte le numéro seul, sauf pour les
 * annexes, qui portent déjà leur nom et ne sont pas des articles.
 */
export function nommerArticle(num: string): string {
  return /^(article|annexe)/i.test(num) ? num : `Article ${num}`;
}

export function planDuCorpus(corpus: Corpus): PlanCorpus {
  return {
    documents: corpus.documents.map((document) => ({
      source: document.nom,
      articles: document.articles.map((article) => ({
        article: nommerArticle(article.num),
        chemin: article.chemin,
      })),
    })),
  };
}

/**
 * Le corpus d'un domaine, ou `null` s'il n'a pas encore été construit.
 *
 * L'import est dynamique pour que chaque domaine soit chargé seul : dix corpus
 * en mémoire pour répondre à une question sur un bail serait un gâchis, et le
 * groupeur sait découper quand l'import est écrit ainsi. L'absence de fichier
 * n'est pas une erreur — c'est l'état d'un dépôt fraîchement cloné, avant
 * `npm run corpus`.
 */
const CHARGES = new Map<DomaineId, Corpus | null>();

export async function corpusDuDomaine(id: DomaineId): Promise<Corpus | null> {
  if (CHARGES.has(id)) return CHARGES.get(id) ?? null;

  let corpus: Corpus | null = null;
  try {
    const module = await import(`../../corpus/${id}.json`);
    corpus = (module.default ?? module) as Corpus;
  } catch {
    corpus = null;
  }

  CHARGES.set(id, corpus);
  return corpus;
}
