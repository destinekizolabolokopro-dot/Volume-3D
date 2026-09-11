/**
 * Un frein simple sur les rafales.
 *
 * Compteur en mémoire, volontairement sans base ni dépendance : il empêche
 * qu'une seule adresse vide le budget d'API en tenant la touche Entrée. Sur
 * plusieurs instances, la limite s'applique par instance — suffisant à cette
 * échelle, à remplacer par un compteur partagé si le trafic grandit.
 *
 * Le même besoin existe déjà dans l'assistant des visites et la prise de
 * rendez-vous, écrit sur place à chaque fois ; ce fichier est la version
 * nommée, que les routes juridiques emploient toutes les deux.
 */

export interface Cadence {
  /** Vrai si l'appel dépasse la limite : l'appelant répond alors 429. */
  depasse(cle: string, maintenant?: number): boolean;
}

/** Au-delà de `nombre` appels dans `fenetreMs`, la clé est freinée. */
export function cadence(nombre: number, fenetreMs: number): Cadence {
  const passages = new Map<string, number[]>();

  return {
    depasse(cle, maintenant = Date.now()) {
      const recents = (passages.get(cle) ?? []).filter((instant) => maintenant - instant < fenetreMs);
      recents.push(maintenant);
      passages.set(cle, recents);
      /* Le compteur ne se purge pas tout seul : au-delà de quelques milliers de
         clés, on le vide entièrement. Perdre l'historique rouvre la porte une
         seconde, ce qui coûte moins qu'une fuite de mémoire lente. */
      if (passages.size > 5000) passages.clear();
      return recents.length > nombre;
    },
  };
}

/**
 * Les en-têtes que seul l'hébergeur peut écrire.
 *
 * Ils sont posés par le proxy en écrasant ce que le navigateur a envoyé, et
 * ne portent qu'une adresse. C'est ce qui les rend utilisables comme clé de
 * frein : `x-forwarded-for`, lui, se fabrique à la main.
 */
const ENTETES_DE_CONFIANCE = ['x-vercel-forwarded-for', 'cf-connecting-ip', 'x-real-ip'];

/**
 * L'adresse de l'appelant, telle qu'on peut y croire.
 *
 * Le détail compte, parce que cette valeur EST le quota : c'est elle qui
 * limite un visiteur sans compte à trois questions par jour et huit par
 * minute. Prise dans le premier élément de `x-forwarded-for`, elle est
 * entièrement écrite par l'appelant — il suffit d'en changer à chaque requête
 * pour vider le budget d'API du site.
 *
 * On lit donc d'abord les en-têtes que l'hébergeur pose lui-même. À défaut,
 * on prend le DERNIER élément de `x-forwarded-for` : c'est celui qu'a ajouté
 * le relais le plus proche, le seul de la liste que l'appelant n'a pas pu
 * choisir. Sans en-tête du tout — un serveur nu, sans proxy devant —, tout le
 * monde partage la même clé : le frein devient global, ce qui est trop strict
 * plutôt que trop lâche.
 */
export function origine(request: Request): string {
  for (const nom of ENTETES_DE_CONFIANCE) {
    const valeur = request.headers.get(nom)?.split(',')[0]?.trim();
    if (valeur) return valeur;
  }

  const chaine = request.headers.get('x-forwarded-for')?.split(',') ?? [];
  return chaine[chaine.length - 1]?.trim() || 'inconnu';
}

