/**
 * Le format du flux de consultation, et sa lecture.
 *
 * La réponse n'arrive plus d'un bloc : elle se déroule. Le serveur écrit une
 * suite d'objets JSON séparés par des sauts de ligne, le navigateur les lit à
 * mesure qu'ils tombent. Ce fichier porte le contrat des deux côtés — et rien
 * d'autre, pour qu'il n'y ait pas deux idées du format, une par bout du fil.
 *
 * Pourquoi du JSON ligne par ligne et pas des « server-sent events » : parce
 * qu'il n'y a qu'un seul consommateur, qu'il parle déjà JSON, et que le
 * format SSE ajoute un protocole (des champs `event:`, `data:`, des lignes
 * vides significatives) pour un bénéfice — la reconnexion automatique — dont
 * on ne veut surtout pas ici. Une consultation interrompue ne doit pas
 * repartir toute seule : elle coûte de l'argent et elle a déjà été posée.
 *
 * Aucun secret, aucun appel : du texte et une machine à le découper.
 */

export const TYPE_DU_FLUX = 'application/x-ndjson';

/** Une autre spécialité plausible, telle qu'elle voyage. */
export interface PisteEnvoyee {
  id: string;
  label: string;
  resume: string;
}

/** Le flux est ouvert : le serveur cherche à qui la question revient. */
export interface Debut {
  t: 'debut';
}

/** Le spécialiste est choisi. Arrive avant le premier mot de la réponse. */
export interface Cap {
  t: 'cap';
  domaine: string;
  label: string;
  pistes: PisteEnvoyee[];
}

/** Ce qui se passe pendant qu'aucun mot ne s'écrit. */
export interface Etape {
  t: 'etape';
  quoi: 'reflexion' | 'recherche';
  /** Ce qui est cherché, pour une recherche. */
  detail?: string;
}

/** Un morceau de réponse. */
export interface Mot {
  t: 'mot';
  d: string;
}

/**
 * La fin, et la vérité.
 *
 * Le texte y est renvoyé ENTIER, alors qu'il vient d'être diffusé mot à mot,
 * et ce n'est pas une redite. Ce qui a été diffusé est ce que le modèle a
 * écrit ; ce qui est ici est ce que le service répond — les deux diffèrent
 * dès qu'une réponse a été coupée, mise en pause ou remplacée par un refus,
 * c'est-à-dire précisément dans les cas où l'écart compte. Le navigateur
 * remplace ce qu'il a accumulé par ce champ.
 */
export interface Fin {
  t: 'fin';
  reponse: string;
  refus: boolean;
  domaine: string;
  label: string;
  pistes: PisteEnvoyee[];
  consultationId: string;
  piece: string;
  precision: unknown;
  preambule: string;
  references: unknown[];
  veille: unknown[];
  restant: number | null;
}

/**
 * Une panne survenue APRÈS l'ouverture du flux.
 *
 * Les refus qui précèdent — quota, question illisible, assistant non
 * configuré — restent des codes HTTP, parce qu'ils sont connus avant qu'un
 * octet ne parte et que le navigateur sait déjà les traiter. Celui-ci est
 * l'autre cas : la réponse avait commencé, et elle n'ira pas au bout.
 */
export interface Erreur {
  t: 'erreur';
  message: string;
  /** Vrai quand réessayer a des chances de marcher : surcharge, réseau, délai. */
  reessayable: boolean;
}

export type Evenement = Debut | Cap | Etape | Mot | Fin | Erreur;

/* ============================================================== la lecture === */

/**
 * Découpe un flux arrivant par morceaux en lignes complètes.
 *
 * Un morceau reçu du réseau ne s'arrête pas sur un saut de ligne : il coupe
 * où il veut, au milieu d'un mot, au milieu d'une accolade. Tenter de lire du
 * JSON là-dedans produit une erreur une fois sur trois, au hasard de la
 * taille des paquets — le genre de défaut qui passe tous les essais en local
 * et ne se voit qu'en production, sur un réseau lent.
 *
 * D'où cette petite machine : on garde ce qui reste après le dernier saut de
 * ligne, et on le recolle au morceau suivant.
 */
export function decoupeur() {
  let reste = '';

  return {
    /** Les lignes complètes contenues dans ce morceau. */
    avaler(morceau: string): string[] {
      const lignes = (reste + morceau).split('\n');
      /* La dernière n'est complète que si le morceau finissait par un saut de
         ligne — auquel cas `split` laisse une chaîne vide, qu'on remet de
         côté sans dommage. */
      reste = lignes.pop() ?? '';
      return lignes.filter((ligne) => ligne.trim().length > 0);
    },
    /** Ce qui restait quand le flux s'est fermé, s'il manquait le saut final. */
    fin(): string[] {
      const dernier = reste.trim();
      reste = '';
      return dernier ? [dernier] : [];
    },
  };
}

/**
 * Un événement, ou `null` si la ligne n'en est pas un.
 *
 * Une ligne illisible est ignorée plutôt que de faire échouer la
 * consultation : le flux vient de notre propre serveur, mais il traverse des
 * intermédiaires qui peuvent y ajouter de quoi gêner — et perdre une réponse
 * entière pour une ligne parasite serait une punition disproportionnée.
 */
export function lireEvenement(ligne: string): Evenement | null {
  let lu: unknown;
  try {
    lu = JSON.parse(ligne);
  } catch {
    return null;
  }
  if (typeof lu !== 'object' || lu === null) return null;
  const t = (lu as { t?: unknown }).t;
  if (t === 'debut' || t === 'cap' || t === 'etape' || t === 'mot' || t === 'fin' || t === 'erreur') {
    return lu as Evenement;
  }
  return null;
}

/* ================================================================ l'attente === */

/**
 * Ce qui s'affiche tant qu'aucun mot n'est écrit.
 *
 * La phrase dit ce qui se passe vraiment. « Il consulte l'INSEE » quand il
 * consulte l'INSEE, et la requête telle qu'elle est partie : quelqu'un qui
 * attend une réponse juridique a le droit de voir sur quoi elle se construit,
 * et cela vaut mieux qu'une animation qui tourne en promettant du travail.
 */
export function phraseDAttente(label: string, etape: Etape | null): string {
  const qui = label || 'L’assistant';
  if (!etape) return `${qui} prend connaissance de votre situation…`;
  if (etape.quoi === 'reflexion') return `${qui} réfléchit…`;
  return etape.detail
    ? `${qui} vérifie : « ${etape.detail} »…`
    : `${qui} vérifie les chiffres à jour…`;
}
