/**
 * Ce que chaque spécialiste a le droit de citer.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 * Jusqu'ici, la règle donnée au modèle était : « nomme le texte, ne le
 * numérote jamais ». Elle protégeait contre la seule faute qu'on ne rattrape
 * pas — une référence inventée a la forme exacte d'une vraie, elle sera
 * recopiée dans un courrier, puis opposée à un juge. Mais elle privait aussi
 * la réponse de ce qui la rend vérifiable.
 *
 * On change de méthode, pas de principe : au lieu d'interdire la référence, on
 * fournit le texte. Le spécialiste reçoit, à chaque question, les articles en
 * vigueur de sa matière, et il ne cite QUE ce qu'il a sous les yeux. L'API
 * rattache alors chaque citation au bloc exact d'où elle sort — donc à un
 * article précis, dont le numéro n'est plus dicté par la mémoire du modèle
 * mais lu dans le fonds officiel.
 *
 * ── D'où vient le texte ─────────────────────────────────────────────────────
 * Du fonds LEGI publié par la DILA sur echanges.dila.gouv.fr : le même que
 * celui qui alimente Légifrance, en licence ouverte. `npm run corpus` le
 * télécharge, applique les mises à jour quotidiennes, et écrit `corpus/`.
 * Aucun appel réseau n'a lieu ensuite : le site lit des fichiers.
 *
 * ── Comment on choisit ──────────────────────────────────────────────────────
 * Par le NOM du texte et par le CHEMIN de ses subdivisions, jamais par des
 * numéros d'article écrits à la main. C'est délibéré : un numéro se renumérote
 * (le code de la construction l'a fait en 2021, en entier), et une liste de
 * numéros tapée de mémoire est exactement le risque que ce fichier existe pour
 * supprimer. « Le chapitre du louage dans le code civil » reste juste quand
 * les articles bougent ; « l'article 1719 » ne le reste pas.
 *
 * Un texte court est pris en entier — la loi de 1989 fait cent articles, elle
 * tient. Un code est pris par parties : le code général des impôts entier
 * dépasserait la fenêtre de contexte à lui seul, et noierait les vingt
 * articles qui servent.
 *
 * ── Ce que ce fichier n'est pas ─────────────────────────────────────────────
 * Il ne remplace pas `lib/domaines.ts`. Celui-ci dit le périmètre du
 * spécialiste et ce qu'il doit signaler ; celui-là dit quels textes il a en
 * main. Les deux peuvent diverger sans dommage : un spécialiste peut connaître
 * une règle sans avoir le texte, il la nomme alors sans la numéroter.
 */

import type { DomaineId } from './domaines.ts';

export interface Selection {
  /**
   * L'intitulé officiel du texte, tel qu'il figure au fonds. La recherche est
   * faite sur le titre complet, accents compris.
   */
  texte: RegExp;
  /** Le nom court, celui qui s'affichera sous une citation. */
  nom: string;
  /**
   * Les subdivisions retenues, reconnues au chemin des titres (livre, titre,
   * chapitre, section) tel que le fonds le porte sur chaque article.
   * Omis : le texte est pris en entier.
   */
  parties?: RegExp[];
}

/**
 * Le tour de vis : un domaine dont le corpus dépasse cette taille est refusé
 * par le script de construction.
 *
 * Ce n'est pas une limite technique — la fenêtre de contexte tiendrait dix
 * fois plus. C'est une limite économique et une limite d'attention. Chaque
 * consultation paie l'écriture de son corpus en cache ; et un spécialiste à
 * qui l'on donne trois cents articles pour en utiliser deux répond moins bien
 * qu'un spécialiste à qui l'on en donne quarante. Quand le plafond est
 * atteint, la réponse n'est pas de l'augmenter : c'est de resserrer les
 * `parties`.
 */
export const PLAFOND_CARACTERES = 320_000;

const CODE_CIVIL = /^Code civil$/;
const CCH = /^Code de la construction et de l’habitation$/;
const URBANISME = /^Code de l’urbanisme$/;
const TOURISME = /^Code du tourisme$/;
const ASSURANCES = /^Code des assurances$/;
const CGI = /^Code général des impôts, CGI\.$/;
const PROCEDURES = /^Code des procédures civiles d’exécution$/;

const LOI_1989 = /^Loi n°\s*89-462 du 6 juillet 1989/;
const LOI_1965 = /^Loi n°\s*65-557 du 10 juillet 1965/;
const DECRET_1967 = /^Décret n°\s*67-223 du 17 mars 1967/;
const LOI_HOGUET = /^Loi n°\s*70-9 du 2 janvier 1970/;
const DECRET_HOGUET = /^Décret n°\s*72-678 du 20 juillet 1972/;
const REPARATIONS = /^Décret n°\s*87-712 du 26 août 1987/;
const CHARGES = /^Décret n°\s*87-713 du 26 août 1987/;
const DEONTOLOGIE = /^Décret n°\s*2015-1090 du 28 août 2015/;

export const CHOIX: Record<DomaineId, Selection[]> = {
  'bail-habitation': [
    { texte: LOI_1989, nom: 'loi du 6 juillet 1989' },
    { texte: REPARATIONS, nom: 'décret du 26 août 1987 sur les réparations locatives' },
    { texte: CHARGES, nom: 'décret du 26 août 1987 sur les charges récupérables' },
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/louage/i] },
    { texte: PROCEDURES, nom: 'code des procédures civiles d’exécution', parties: [/expulsion/i] },
  ],

  'courte-duree': [
    { texte: TOURISME, nom: 'code du tourisme', parties: [/meublés de tourisme/i, /chambres d’hôtes/i, /^.*classement.*hébergement/i] },
    { texte: CCH, nom: 'code de la construction et de l’habitation', parties: [/changement(s)? d’usage/i, /usage des locaux d’habitation/i] },
    { texte: LOI_1965, nom: 'loi du 10 juillet 1965', parties: [/destination de l’immeuble/i] },
  ],

  copropriete: [
    { texte: LOI_1965, nom: 'loi du 10 juillet 1965' },
    { texte: DECRET_1967, nom: 'décret du 17 mars 1967' },
  ],

  'achat-vente': [
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/de la vente/i, /promesse/i, /^.*obligation.*information.*$/i] },
    { texte: CCH, nom: 'code de la construction et de l’habitation', parties: [/protection de l’acquéreur/i, /diagnostic/i] },
    { texte: URBANISME, nom: 'code de l’urbanisme', parties: [/droit(s)? de préemption/i] },
  ],

  travaux: [
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/contrat d’entreprise/i, /devis et marchés/i, /architectes.*entrepreneurs/i] },
    { texte: ASSURANCES, nom: 'code des assurances', parties: [/assurance(s)? (des )?travaux/i, /assurance construction/i, /obligation(s)? d’assurance/i] },
    { texte: CCH, nom: 'code de la construction et de l’habitation', parties: [/construction d’une maison individuelle/i] },
  ],

  urbanisme: [
    {
      texte: URBANISME,
      nom: 'code de l’urbanisme',
      parties: [/permis de construire/i, /déclaration préalable/i, /certificat d’urbanisme/i, /contentieux/i, /infractions/i],
    },
  ],

  voisinage: [
    {
      texte: CODE_CIVIL,
      nom: 'code civil',
      parties: [/servitude/i, /mitoyenneté/i, /distance/i, /trouble(s)? anormal/i, /de la propriété/i],
    },
  ],

  fiscalite: [
    {
      texte: CGI,
      nom: 'code général des impôts',
      parties: [/revenus fonciers/i, /plus-values? immobilières/i, /location(s)? meublée/i, /logements vacants/i],
    },
  ],

  sinistres: [
    {
      texte: ASSURANCES,
      nom: 'code des assurances',
      parties: [/déclaration.*sinistre/i, /règles relatives aux assurances de dommages/i, /catastrophes naturelles/i, /obligation(s)? d’assurance/i],
    },
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/responsabilité extracontractuelle/i, /délits et.*quasi-délits/i] },
  ],

  profession: [
    { texte: LOI_HOGUET, nom: 'loi Hoguet' },
    { texte: DECRET_HOGUET, nom: 'décret du 20 juillet 1972' },
    { texte: DEONTOLOGIE, nom: 'code de déontologie' },
  ],
};
