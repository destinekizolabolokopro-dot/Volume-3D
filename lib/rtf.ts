/**
 * Le document, en RTF.
 *
 * ── Pourquoi RTF et pas DOCX ni PDF ─────────────────────────────────────────
 * Ce qu'on produit ici n'est pas un document fini : c'est un projet de
 * courrier que la personne doit relire, compléter — un nom, une adresse, un
 * montant — puis signer. Le format doit donc s'OUVRIR ET SE CORRIGER, chez
 * quelqu'un dont on ne sait rien.
 *
 * Un PDF se lit partout et ne se corrige nulle part : le mauvais format pour
 * un brouillon. Un DOCX se corrige, mais c'est une archive ZIP d'XML — il
 * faudrait une bibliothèque de plus, et une dépendance qu'on ajoute pour
 * écrire quatre paragraphes est une dépendance qu'on maintiendra dix ans.
 *
 * Le RTF est du texte. Word, Pages, LibreOffice et Google Docs l'ouvrent tous
 * en conservant gras, alignement et sauts de page, et il s'écrit en cent
 * lignes sans rien installer. C'est le format le plus modeste qui fasse le
 * travail.
 *
 * ── L'échappement, qui n'est pas un détail ──────────────────────────────────
 * Trois caractères pilotent le format : `\`, `{` et `}`. Un nom de société
 * contenant une accolade casserait le fichier — Word l'ouvrirait vide, sans
 * dire pourquoi. Et le RTF n'est pas de l'Unicode : chaque « é » doit devenir
 * `\'e9` ou `\uXXXX`, faute de quoi le courrier part avec des « Ã© » dedans.
 */

/**
 * Le texte, encodé pour le RTF.
 *
 * Au-delà de l'ASCII, on passe par `\uN?` : le nombre est le point de code en
 * décimal SIGNÉ sur 16 bits — au-delà de 32767 il devient négatif, ce qu'exige
 * la spécification. Le `?` qui suit est le caractère de repli pour un lecteur
 * qui ne saurait pas lire l'échappement.
 */
export function echapper(texte: string): string {
  let sortie = '';
  for (const caractere of texte) {
    if (caractere === '\\' || caractere === '{' || caractere === '}') {
      sortie += `\\${caractere}`;
      continue;
    }
    if (caractere === '\n') {
      sortie += '\\par\n';
      continue;
    }
    const code = caractere.codePointAt(0) ?? 0;
    if (code < 128) {
      sortie += caractere;
      continue;
    }
    /* Hors du plan de base (émojis…), on écrit les deux demi-codets : le RTF
       ne connaît que des entiers de seize bits. */
    if (code > 0xffff) {
      const haut = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const bas = ((code - 0x10000) % 0x400) + 0xdc00;
      sortie += `\\u${haut}?\\u${bas}?`;
      continue;
    }
    sortie += `\\u${code > 32767 ? code - 65536 : code}?`;
  }
  return sortie;
}

export interface Bloc {
  /** `titre` centré et gras, `objet` en gras, `texte` au fil, `signature` à droite. */
  type: 'titre' | 'objet' | 'texte' | 'signature';
  contenu: string;
}

export interface DocumentRtf {
  titre: string;
  blocs: Bloc[];
}

const POLICE = 'Times New Roman';

/**
 * Assemble le fichier.
 *
 * La mise en page est celle d'un courrier officiel français : Times 12,
 * interligne simple, marges de deux centimètres et demi, un blanc entre les
 * paragraphes. Rien de décoratif — un courrier de mise en demeure qui ressemble
 * à une plaquette commerciale se fait moins bien recevoir.
 */
export function versRtf({ titre, blocs }: DocumentRtf): string {
  const entete = [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0',
    `{\\fonttbl{\\f0\\froman\\fcharset0 ${POLICE};}}`,
    `{\\info{\\title ${echapper(titre)}}}`,
    /* Marges : 1440 twips = 1 pouce. 1418 ≈ 2,5 cm. */
    '\\paperw11906\\paperh16838\\margl1418\\margr1418\\margt1418\\margb1418',
    '\\f0\\fs24',
  ].join('\n');

  const corps = blocs
    .map(({ type, contenu }) => {
      const texte = echapper(contenu);
      if (type === 'titre') return `\\pard\\qc\\sa280\\b ${texte}\\b0\\par`;
      if (type === 'objet') return `\\pard\\ql\\sa280\\b ${texte}\\b0\\par`;
      if (type === 'signature') return `\\pard\\qr\\sa280 ${texte}\\par`;
      return `\\pard\\qj\\sa200 ${texte}\\par`;
    })
    .join('\n');

  return `${entete}\n${corps}\n}`;
}

/** Un nom de fichier sûr, tiré du titre : sans accent, sans espace, sans slash. */
export function nomDeFichier(titre: string, extension = 'rtf'): string {
  const base = titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${base || 'document'}.${extension}`;
}
