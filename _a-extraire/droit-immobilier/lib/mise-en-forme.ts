/**
 * La mise en forme des réponses.
 *
 * Le spécialiste écrit en texte simple : pas de Markdown, pas de balises. On
 * pourrait afficher ce texte tel quel dans un `<p>`, mais une réponse
 * juridique se lit mal en bloc — l'information qui compte (le délai) se noie
 * au milieu de l'explication.
 *
 * Ce module reconnaît donc trois formes, et trois seulement :
 *   — une ligne courte terminée par deux points est un intertitre ;
 *   — une ligne commençant par un tiret est un élément d'énumération ;
 *   — tout le reste est un paragraphe.
 *
 * Volontairement pas d'analyseur Markdown : il faudrait alors se protéger de
 * ce qu'il permet d'injecter, alors que le texte vient d'un modèle et que le
 * besoin réel tient en trois règles. Rien n'est interprété comme du HTML.
 */

export type Bloc =
  | { type: 'titre'; texte: string }
  | { type: 'paragraphe'; texte: string }
  | { type: 'liste'; points: string[] };

/** Au-delà, ce n'est plus un intertitre mais une phrase qui finit par « : ». */
const TITRE_MAX = 64;

const PUCES = ['—', '–', '-', '•', '*'];

/** Un tiret seul sur sa ligne compte aussi : c'est une puce sans texte, pas un paragraphe. */
function estPuce(ligne: string): boolean {
  return PUCES.some((puce) => ligne === puce || ligne.startsWith(`${puce} `));
}

function sansPuce(ligne: string): string {
  return ligne.slice(1).trim();
}

function estTitre(ligne: string): boolean {
  return ligne.endsWith(':') && ligne.length <= TITRE_MAX && !estPuce(ligne);
}

/**
 * Le titre qui sépare la réponse en clair du détail juridique.
 *
 * Il est demandé au spécialiste par la consigne (lib/consigne.ts), et il est
 * reconnu ici sans accent ni casse : un modèle qui écrit « LE DÉTAIL
 * JURIDIQUE » ou « Le detail juridique » dit la même chose, et une réponse
 * dont la coupure a raté vaut mieux qu'une réponse tronquée.
 */
const MARQUEUR_DETAIL = 'le detail juridique';

/** Sans accents, sans casse, sans ponctuation de fin. */
function aplatir(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.:;!?\s]+$/, '')
    .trim();
}

/**
 * Sépare ce que tout le monde doit lire de ce qui n'intéresse que ceux qui
 * veulent le fond.
 *
 * La partie « claire » se lit sans rien connaître au droit : la réponse, ce
 * qu'il y a à faire, le délai. La partie « détail » porte la règle exacte, les
 * articles cités et le vocabulaire du métier — elle est repliée à l'écran.
 *
 * Le titre qui marque la coupure part AVEC le détail : il annonce ce qu'on va
 * lire, il n'a rien à faire au-dessus du bouton qui l'ouvre.
 *
 * Quand le marqueur est absent — une réponse courte, une consultation d'avant
 * ce découpage —, tout reste en clair et rien n'est replié. C'est le bon
 * défaut : ne rien cacher.
 */
export function separer(texte: string): { clair: Bloc[]; detail: Bloc[] } {
  const blocs = decouper(texte);
  const coupure = blocs.findIndex(
    (bloc) => bloc.type === 'titre' && aplatir(bloc.texte) === MARQUEUR_DETAIL,
  );

  if (coupure < 0) return { clair: blocs, detail: [] };
  return { clair: blocs.slice(0, coupure), detail: blocs.slice(coupure) };
}

/** Découpe un texte en blocs affichables. Ne renvoie jamais de bloc vide. */
export function decouper(texte: string): Bloc[] {
  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];
  let points: string[] = [];

  const viderParagraphe = () => {
    if (paragraphe.length > 0) {
      blocs.push({ type: 'paragraphe', texte: paragraphe.join(' ') });
      paragraphe = [];
    }
  };
  const viderListe = () => {
    if (points.length > 0) {
      blocs.push({ type: 'liste', points });
      points = [];
    }
  };

  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();

    if (ligne === '') {
      viderParagraphe();
      viderListe();
      continue;
    }
    if (estTitre(ligne)) {
      viderParagraphe();
      viderListe();
      blocs.push({ type: 'titre', texte: ligne.slice(0, -1).trim() });
      continue;
    }
    if (estPuce(ligne)) {
      viderParagraphe();
      const point = sansPuce(ligne);
      if (point) points.push(point);
      continue;
    }
    /* Une ligne ordinaire après une énumération recommence un paragraphe :
       les modèles reviennent souvent au texte courant sans ligne vide. */
    viderListe();
    paragraphe.push(ligne);
  }

  viderParagraphe();
  viderListe();
  return blocs;
}
