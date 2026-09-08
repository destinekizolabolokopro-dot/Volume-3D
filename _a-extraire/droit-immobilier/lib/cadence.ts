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

/** L'adresse de l'appelant, ou une valeur commune si le proxy n'en donne pas. */
export function origine(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnu';
}
