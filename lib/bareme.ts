/**
 * Le barème : ce qu'on vérifie sur une réponse, sans demander l'avis de
 * personne.
 *
 * Jusqu'ici, chaque fois qu'on touchait à la consigne, on jugeait à l'œil sur
 * deux ou trois questions. C'est exactement comme ça qu'on casse un délai
 * sans s'en apercevoir : la réponse reste bonne sur les cas qu'on regarde, et
 * se met à omettre le préavis sur ceux qu'on ne regarde plus.
 *
 * Ce fichier porte les règles MÉCANIQUES, celles qui n'ont pas besoin d'un
 * modèle pour trancher. Elles ne mesurent pas la justesse juridique — aucun
 * programme ne sait le faire — mais elles attrapent les trois manquements qui
 * coûtent le plus cher ici :
 *
 *   — un numéro d'article qui ne figure dans aucun texte joint ;
 *   — du jargon dans les trois premières sections, qui sont censées se lire
 *     sans rien connaître au droit ;
 *   — un délai absent quand la situation en comporte un.
 *
 * Pur : ni réseau, ni fichier, ni clé.
 */

/* L'extension est obligatoire : ce fichier est chargé tel quel par le lanceur
   de tests de Node, qui ne résout pas les imports sans elle. Même contrainte
   dans lib/voix.ts et lib/veille.ts. */
import { MARQUEUR_DETAIL, aplatir } from './mise-en-forme.ts';

/* ============================================================= la structure === */

/** Les quatre intertitres, dans l'ordre imposé par le socle. */
export const INTERTITRES = [
  'en clair',
  'ce que je ferais',
  'le délai',
  'le détail juridique',
] as const;

function sansAccent(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Le texte découpé par intertitre.
 *
 * La clé est le titre sans accent ni casse : le modèle écrit « Le délai : »
 * et on cherche « le delai ». Ce qui précède le premier intertitre va dans
 * une entrée vide — c'est là qu'atterrit une urgence, qui a le droit de
 * passer devant.
 */
export function sections(texte: string): Map<string, string> {
  const trouvees = new Map<string, string>();
  let courante = '';
  let tampon: string[] = [];

  const poser = () => {
    const contenu = tampon.join('\n').trim();
    if (contenu || courante) trouvees.set(courante, contenu);
    tampon = [];
  };

  for (const ligne of texte.split('\n')) {
    const nu = sansAccent(ligne.trim()).replace(/\s*:\s*$/, '');
    const titre = INTERTITRES.find((intertitre) => nu === sansAccent(intertitre));
    if (titre) {
      poser();
      courante = sansAccent(titre);
      continue;
    }
    tampon.push(ligne);
  }
  poser();

  return trouvees;
}

/** Les intertitres présents, dans l'ordre où ils apparaissent. */
export function ordreDesIntertitres(texte: string): string[] {
  return [...sections(texte).keys()].filter((cle) => cle.length > 0);
}

/**
 * Vrai quand les intertitres présents respectent l'ordre du socle.
 *
 * L'ordre compte plus que la présence : une réponse factuelle a le droit de
 * sauter « Ce que je ferais » (le socle le prévoit), mais aucune n'a le droit
 * de mettre le détail juridique avant le délai — ce qui reviendrait à faire
 * lire l'article à quelqu'un qui cherche une date.
 */
export function ordreRespecte(texte: string): boolean {
  const vus = ordreDesIntertitres(texte);
  const attendus = INTERTITRES.map(sansAccent);
  let rang = -1;
  for (const vu of vus) {
    const place = attendus.indexOf(vu);
    if (place <= rang) return false;
    rang = place;
  }
  return true;
}

/** Le texte des trois sections qui doivent se lire sans connaître le droit. */
export function partieSimple(texte: string): string {
  const trouvees = sections(texte);
  const detail = sansAccent(MARQUEUR_DETAIL);
  return [...trouvees.entries()]
    .filter(([cle]) => cle !== detail)
    .map(([, contenu]) => contenu)
    .join('\n');
}

/* =============================================================== le jargon === */

/**
 * Les mots que le socle interdit dans les trois premières sections.
 *
 * Ils ne sont pas interdits partout : « clause résolutoire » est le terme
 * juste, et le détail juridique existe pour l'employer. Ils sont interdits là
 * où quelqu'un cherche à savoir ce qu'il peut faire ce soir.
 */
export const JARGON = [
  'clause résolutoire',
  'commandement de payer',
  'mise en demeure',
  'forclusion',
  'titre exécutoire',
  'préavis',
  'il convient de',
  'en l’espèce',
  'en l’espece',
  'nonobstant',
  'susvisé',
  'précité',
] as const;

/** Le jargon trouvé dans la partie qui doit s'en passer. */
export function jargonDansLeClair(texte: string): string[] {
  const nu = sansAccent(partieSimple(texte));
  return JARGON.filter((mot) => nu.includes(sansAccent(mot)));
}

/* ============================================================= les articles === */

/**
 * Les numéros d'article cités dans un texte, avec l'endroit où ils sont.
 *
 * L'expression attrape les formes que le fonds LEGI produit : « article 15 »,
 * « article L. 221-18 », « articles 225-1 et 225-2 », « article R*111-2 ».
 */
const ARTICLE = /articles?\s+((?:[LRD]\.?\s?\*?\s?)?\d+(?:[-\s]\d+)*(?:\s?-\s?\d+)*)/gi;

export interface ArticleCite {
  /** Le numéro, normalisé : « L221-18 », « 15 ». */
  numero: string;
  /** Vrai quand il est cité dans le détail juridique, là où il a sa place. */
  dansLeDetail: boolean;
}

export function articlesCites(texte: string): ArticleCite[] {
  const detail = sansAccent(MARQUEUR_DETAIL);
  const trouvees = sections(texte);
  const vus = new Map<string, ArticleCite>();

  for (const [cle, contenu] of trouvees) {
    for (const trouve of contenu.matchAll(ARTICLE)) {
      const numero = normaliserLeNumero(trouve[1]);
      if (!numero) continue;
      const deja = vus.get(numero);
      const ici = cle === detail;
      /* Un article cité aux deux endroits compte comme cité dans le clair :
         c'est là qu'il pose problème. */
      if (!deja) vus.set(numero, { numero, dansLeDetail: ici });
      else if (!ici) deja.dansLeDetail = false;
    }
  }

  return [...vus.values()];
}

/** « L. 221-18 » et « L221-18 » sont le même article. */
export function normaliserLeNumero(brut: string): string {
  return brut.replace(/[\s.*]/g, '').replace(/‑/g, '-').toUpperCase();
}

/**
 * Les articles cités qui ne figurent dans aucun texte joint.
 *
 * C'est la vérification la plus importante du barème. Un numéro faux a la
 * forme exacte d'un vrai, il sera recopié dans un courrier, et il se
 * découvrira faux devant un juge. Le socle l'interdit ; ceci le mesure.
 *
 * Les numéros cités dans le socle lui-même sont admis : ce sont les seuls que
 * le modèle a le droit de reprendre de mémoire, parce qu'ils ont été
 * vérifiés à la main.
 */
export const ARTICLES_DU_SOCLE = ['226-4-2', '225-1', '225-2'].map(normaliserLeNumero);

export function articlesInventes(texte: string, duCorpus: Iterable<string>): string[] {
  const connus = new Set([...duCorpus].map(normaliserLeNumero));
  for (const admis of ARTICLES_DU_SOCLE) connus.add(admis);
  return articlesCites(texte)
    .map((article) => article.numero)
    .filter((numero) => !connus.has(numero));
}

/** Les articles cités hors du détail juridique. Le socle les y interdit. */
export function articlesHorsDuDetail(texte: string): string[] {
  return articlesCites(texte)
    .filter((article) => !article.dansLeDetail)
    .map((article) => article.numero);
}

/* ================================================================ le délai === */

/** Vrai quand la section « Le délai » dit quelque chose de daté ou de duré. */
export function delaiAnnonce(texte: string): boolean {
  const contenu = sections(texte).get(sansAccent('le délai')) ?? '';
  if (!contenu.trim()) return false;
  return /\b\d|jour|semaine|mois|an(s|née)?|trop tard|rien ne presse|immédiat|aujourd/i.test(
    contenu,
  );
}

/* =============================================================== le verdict === */

export interface Attente {
  /** Mots ou expressions qui doivent figurer quelque part dans la réponse. */
  doitContenir?: string[];
  /** Mots qui ne doivent figurer nulle part. */
  neDoitPasContenir?: string[];
  /** Vrai si la situation comporte un délai qui doit être annoncé. */
  delai?: boolean;
  /** Vrai si la demande doit être refusée ou requalifiée. */
  refus?: boolean;
}

export interface Manquement {
  regle: string;
  detail: string;
}

/**
 * Tout ce qui cloche dans une réponse, au regard du socle et de l'attente.
 *
 * Rend une liste vide quand tout va bien. La liste, et non un score : un
 * pourcentage ne se corrige pas, une phrase si.
 */
export function juger(
  texte: string,
  attente: Attente,
  articlesDuCorpus: Iterable<string>,
): Manquement[] {
  const manques: Manquement[] = [];

  if (!ordreRespecte(texte)) {
    manques.push({
      regle: 'ordre',
      detail: `intertitres dans le désordre : ${ordreDesIntertitres(texte).join(' → ') || 'aucun'}`,
    });
  }

  if (!texte.toLowerCase().includes('détail juridique')) {
    manques.push({ regle: 'structure', detail: 'pas de section « Le détail juridique »' });
  }

  const jargon = jargonDansLeClair(texte);
  if (jargon.length > 0) {
    manques.push({ regle: 'jargon', detail: `dans la partie simple : ${jargon.join(', ')}` });
  }

  const inventes = articlesInventes(texte, articlesDuCorpus);
  if (inventes.length > 0) {
    manques.push({
      regle: 'article inventé',
      detail: `absents des textes joints : ${inventes.join(', ')}`,
    });
  }

  const dehors = articlesHorsDuDetail(texte);
  if (dehors.length > 0) {
    manques.push({
      regle: 'article hors du détail',
      detail: `cités avant « Le détail juridique » : ${dehors.join(', ')}`,
    });
  }

  if (attente.delai && !delaiAnnonce(texte)) {
    manques.push({ regle: 'délai', detail: 'la situation en comporte un, il n’est pas annoncé' });
  }

  return [...manques, ...jugerLesMots(texte, attente)];
}

/**
 * Les mots attendus et interdits, sans rien exiger de la forme.
 *
 * Séparé de `juger` pour un cas précis : la réponse que le site écrit
 * lui-même quand l'aiguillage ne reconnaît aucune spécialité. Elle n'a ni
 * intertitres ni articles, et c'est voulu — lui réclamer un « détail
 * juridique » reviendrait à exiger la forme d'une consultation d'un texte
 * qui explique justement qu'il n'y en aura pas.
 */
export function jugerLesMots(texte: string, attente: Attente): Manquement[] {
  const manques: Manquement[] = [];
  const nu = sansAccent(aplatir(texte));

  for (const attendu of attente.doitContenir ?? []) {
    if (!nu.includes(sansAccent(attendu))) {
      manques.push({ regle: 'attendu', detail: `« ${attendu} » n’apparaît pas` });
    }
  }

  for (const interdit of attente.neDoitPasContenir ?? []) {
    if (nu.includes(sansAccent(interdit))) {
      manques.push({ regle: 'interdit', detail: `« ${interdit} » apparaît` });
    }
  }

  return manques;
}
