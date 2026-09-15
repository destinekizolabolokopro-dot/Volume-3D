import { DOMAINES, type DomaineId } from './domaines.ts';

/**
 * L'aiguillage : d'une question en français vers le spécialiste compétent.
 *
 * Le calcul est fait ici, en local, sans appel de modèle. C'est un choix de
 * conception et non une économie : une question sur trois se range d'elle-même
 * dès qu'un mot décisif apparaît — « prud'hommes », « OQTF », « dépôt de
 * garantie » ne veulent dire qu'une seule chose. Faire trancher un modèle sur
 * ces cas-là coûterait une seconde d'attente et une requête, pour retomber sur
 * la même réponse, sans pouvoir expliquer pourquoi.
 *
 * Ce qui est renvoyé n'est donc pas seulement un identifiant : c'est aussi le
 * degré de certitude et les mots qui l'ont produit. Les deux servent :
 *  — `certitude` décide si `lib/juriste.ts` doit faire arbitrer un modèle ;
 *  — `indices` est affiché au visiteur, pour qu'il voie sur quoi on s'est
 *    fondé et puisse corriger d'un clic. Un aiguillage qui se trompe sans rien
 *    montrer est bien pire qu'un menu.
 *
 * Le module est pur : ni réseau, ni date, ni aléa. Il se teste entièrement.
 */

/** Un mot décisif vaut quatre mots de champ lexical. Voir `poids` plus bas. */
const POIDS_SIGNAL = 4;
const POIDS_MOT = 1;

/** En dessous, on ne tranche pas seul : un seul mot faible ne fait pas un domaine. */
const SEUIL_CERTITUDE = 4;

/**
 * Découpe en mots comparables : minuscules, sans accents, sans apostrophes ni
 * ponctuation. « L'OQTF, reçue hier » devient ['l', 'oqtf', 'recue', 'hier'].
 */
export function mots(texte: string): string[] {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * Égalité tolérante au pluriel, dans les deux sens : « impôts » trouve
 * « impot », « donnee » trouve « données ». C'est la seule flexion traitée —
 * un radicaliseur complet ferait plus de dégâts que de bien sur des mots comme
 * « temps » ou « vices ».
 */
function memeMot(a: string, b: string): boolean {
  return a === b || a === `${b}s` || `${a}s` === b;
}

/** L'expression apparaît-elle telle quelle, mots consécutifs, dans le texte ? */
function contient(motsTexte: string[], expression: string): boolean {
  const cible = expression.split(' ');
  for (let debut = 0; debut + cible.length <= motsTexte.length; debut += 1) {
    let ok = true;
    for (let i = 0; i < cible.length; i += 1) {
      if (!memeMot(motsTexte[debut + i], cible[i])) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Une expression de plusieurs mots est plus discriminante qu'un mot seul :
 * « garde à vue » ne peut désigner que le pénal, quand « garde » seul se dit
 * aussi d'un enfant. D'où le bonus par mot supplémentaire.
 */
function poids(expression: string, signal: boolean): number {
  const supplement = expression.split(' ').length - 1;
  return (signal ? POIDS_SIGNAL : POIDS_MOT) + supplement;
}

export interface Piste {
  id: DomaineId;
  score: number;
  /** Les expressions trouvées, dans l'ordre du catalogue. Affichables telles quelles. */
  indices: string[];
}

export type Certitude =
  /** Un domaine se détache nettement : on y va sans demander. */
  | 'sure'
  /** Plusieurs domaines plausibles : on propose, on ne tranche pas seul. */
  | 'hesitante'
  /** Rien ne ressort : la question est trop vague, ou hors de tout périmètre. */
  | 'nulle';

export interface Aiguillage {
  domaine: DomaineId | null;
  certitude: Certitude;
  /** Les meilleures pistes, décroissantes. Vide si `certitude` vaut 'nulle'. */
  pistes: Piste[];
}

/**
 * Range une question. Ne renvoie jamais d'erreur : une question vide est une
 * question sans piste, pas un échec.
 */
export function aiguiller(question: string, maxPistes = 3): Aiguillage {
  const motsTexte = mots(question);
  if (motsTexte.length === 0) return { domaine: null, certitude: 'nulle', pistes: [] };

  const pistes: Piste[] = [];

  for (const domaine of DOMAINES) {
    let score = 0;
    const indices: string[] = [];

    for (const signal of domaine.signaux) {
      if (contient(motsTexte, signal)) {
        score += poids(signal, true);
        indices.push(signal);
      }
    }
    for (const mot of domaine.motsCles) {
      if (contient(motsTexte, mot)) {
        score += poids(mot, false);
        indices.push(mot);
      }
    }

    if (score > 0) pistes.push({ id: domaine.id, score, indices });
  }

  if (pistes.length === 0) return { domaine: null, certitude: 'nulle', pistes: [] };

  /* Tri décroissant, départagé par l'ordre du catalogue pour rester stable :
     deux exécutions sur la même question doivent donner le même résultat. */
  const ordre = new Map(DOMAINES.map((domaine, index) => [domaine.id, index] as const));
  pistes.sort((a, b) => b.score - a.score || (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0));

  const meilleur = pistes[0];
  const suivant = pistes[1]?.score ?? 0;

  /* Deux conditions, et les deux comptent. Un score élevé ne suffit pas si un
     autre domaine le talonne : une question qui parle de licenciement ET de
     titre de séjour appelle un arbitrage, pas un choix par un point d'écart. */
  const certitude: Certitude =
    meilleur.score >= SEUIL_CERTITUDE && meilleur.score >= suivant * 2 ? 'sure' : 'hesitante';

  return { domaine: meilleur.id, certitude, pistes: pistes.slice(0, maxPistes) };
}
