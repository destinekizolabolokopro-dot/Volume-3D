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
