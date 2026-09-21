import 'server-only';

/**
 * Les chiffres que l'accueil avance, pris là où ils sont vrais.
 *
 * Une page de vente qui annonce « des milliers d'articles » n'annonce rien.
 * Celle-ci dit quinze textes, deux mille cent trente-trois articles, fonds
 * arrêté à telle date — et chacun de ces nombres est lu dans l'index écrit
 * par `npm run corpus`, jamais tapé dans une page. C'est la seule manière
 * qu'ils aient de rester justes : le jour où une spécialité gagne un texte,
 * la page le dit sans qu'on y pense.
 *
 * Quand le corpus n'est pas construit — un dépôt fraîchement cloné —, il n'y
 * a pas de chiffres, et la page se tait au lieu d'en inventer.
 */

export interface Preuve {
  /** Nombre de textes officiels distincts : le code civil ne compte qu'une fois. */
  textes: number;
  articles: number;
  /** Date d'arrêt du fonds, en ISO. */
  arrete: string;
  /** Nombre de mises à jour quotidiennes appliquées au dump de départ. */
  quotidiennes: number;
}

interface IndexCorpus {
  arrete?: string;
  quotidiennes?: number;
  textes?: number;
  domaines?: { articles?: number }[];
}

let lue: Preuve | null | undefined;

export async function preuveDuCorpus(): Promise<Preuve | null> {
  if (lue !== undefined) return lue;

  try {
    const module = await import('../corpus/index.json');
    const index = (module.default ?? module) as IndexCorpus;
    const articles = (index.domaines ?? []).reduce((somme, d) => somme + (d.articles ?? 0), 0);

    lue =
      index.arrete && index.textes && articles
        ? {
            textes: index.textes,
            articles,
            arrete: index.arrete,
            quotidiennes: index.quotidiennes ?? 0,
          }
        : null;
  } catch {
    lue = null;
  }

  return lue;
}

export { dateLisible, nombreLisible } from './nombres';
