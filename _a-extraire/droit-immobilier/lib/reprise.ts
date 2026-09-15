/**
 * La reprise d'une consultation d'essai par le compte qui vient d'ouvrir.
 *
 * Le mur de la vitrine promettait « un compte conserve vos consultations » à
 * quelqu'un dont la consultation, celle qu'il venait d'avoir, était jetée à la
 * seconde d'après. C'était la seule phrase malhonnête du parcours, et c'était
 * aussi celle qui devait convaincre.
 *
 * Le fil d'essai voyage donc dans le `sessionStorage` du navigateur — pas
 * ailleurs : il n'appartient encore à personne, et le déposer côté serveur
 * reviendrait à garder les questions de gens qui n'ont pas de compte. Il est
 * versé en base au premier retour dans l'espace, puis effacé de la session.
 *
 * Ce module ne fait que la partie vérifiable : la forme du fil, sa validation,
 * ses bornes. Rien n'y touche au réseau ni au stockage.
 */

/** La clé du sessionStorage. Nommée en clair : elle se lit dans un inspecteur. */
export const CLE_REPRISE = 'immolex.consultation-essai';

export interface TourRepris {
  role: 'user' | 'assistant';
  content: string;
}

export interface FilRepris {
  domaine: string;
  tours: TourRepris[];
}

/**
 * Les bornes.
 *
 * Elles sont là parce que ce qui arrive vient du navigateur, donc de
 * n'importe qui : la reprise crée des lignes en base au nom d'un compte
 * authentifié, et sans bornes elle en créerait autant qu'on lui en envoie.
 * Un essai, c'est UNE question et UNE réponse ; quatre tours laissent de la
 * marge pour une précision demandée en cours de route.
 */
export const MAX_TOURS_REPRIS = 4;
export const MAX_CARACTERES_REPRIS = 20_000;

/**
 * Relit ce que le navigateur présente, et n'en garde que ce qui tient debout.
 *
 * Elle rend `null` plutôt que de lever : une reprise ratée ne doit jamais
 * empêcher quelqu'un d'entrer dans son espace. Au pire, il retrouve un espace
 * vide — ce qu'il aurait eu de toute façon avant ce module.
 */
export function relireLeFil(brut: unknown): FilRepris | null {
  if (!brut || typeof brut !== 'object') return null;

  const objet = brut as Record<string, unknown>;
  const domaine = typeof objet.domaine === 'string' ? objet.domaine.slice(0, 40) : '';
  if (!domaine) return null;

  if (!Array.isArray(objet.tours)) return null;

  const tours: TourRepris[] = [];
  for (const entree of objet.tours.slice(0, MAX_TOURS_REPRIS)) {
    if (!entree || typeof entree !== 'object') continue;
    const tour = entree as Record<string, unknown>;
    const role = tour.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof tour.content === 'string' ? tour.content.trim() : '';
    if (!content) continue;
    tours.push({ role, content: content.slice(0, MAX_CARACTERES_REPRIS) });
  }

  /* Un fil qui ne commence pas par une question n'est pas une consultation :
     c'est une réponse orpheline, et son titre serait celui du modèle. */
  if (tours.length < 2 || tours[0].role !== 'user') return null;

  return { domaine, tours };
}
