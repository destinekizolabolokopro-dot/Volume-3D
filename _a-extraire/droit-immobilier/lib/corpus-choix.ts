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
 *
 * Le chiffre vient de la copropriété, le plus gros domaine : la loi de 1965 et
 * son décret de 1967 pèsent ensemble trois cent trente-cinq mille caractères,
 * et ne se coupent pas en deux — c'est la matière entière. Tout le reste tient
 * en dessous, la plupart des domaines à moins de la moitié.
 */
export const PLAFOND_CARACTERES = 340_000;

const CODE_CIVIL = /^Code civil$/;
const CCH = /^Code de la construction et de l’habitation$/;
const URBANISME = /^Code de l’urbanisme$/;
const TOURISME = /^Code du tourisme$/;
const ASSURANCES = /^Code des assurances$/;
const CGI = /^Code général des impôts$/;
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
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/Du contrat de louage/i] },
    { texte: PROCEDURES, nom: 'code des procédures civiles d’exécution', parties: [/EXPULSION/i] },
  ],

  'courte-duree': [
    { texte: TOURISME, nom: 'code du tourisme', parties: [/Meublés de tourisme et chambres d’hôtes/i] },
    {
      texte: CCH,
      nom: 'code de la construction et de l’habitation',
      parties: [/Changements? d’usage/i, /Accession à la propriété et autres cessions/i],
    },
  ],

  copropriete: [
    { texte: LOI_1965, nom: 'loi du 10 juillet 1965' },
    { texte: DECRET_1967, nom: 'décret du 17 mars 1967' },
  ],

  'achat-vente': [
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/:\s*De la vente$/i] },
    { texte: CCH, nom: 'code de la construction et de l’habitation', parties: [/Protection de l’acquéreur immobilier/i] },
    { texte: URBANISME, nom: 'code de l’urbanisme', parties: [/Droit de préemption urbain/i] },
  ],

  travaux: [
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/Du louage d’ouvrage et d’industrie/i] },
    { texte: ASSURANCES, nom: 'code des assurances', parties: [/L’assurance des travaux de bâtiment/i] },
    { texte: CCH, nom: 'code de la construction et de l’habitation', parties: [/Construction d’une maison individuelle/i] },
  ],

  urbanisme: [
    {
      texte: URBANISME,
      nom: 'code de l’urbanisme',
      /* Le livre IV entier ferait six cent cinquante articles, dont les
         lotissements, les enseignes et les remontées mécaniques. On garde ce
         qu'un propriétaire ou un agent rencontre : l'autorisation, son
         instruction, son affichage, son contrôle, et le recours. */
      parties: [
        /Certificat d’urbanisme/i,
        /Dispositions communes aux diverses autorisations/i,
        /Dispositions propres aux constructions/i,
        /Dispositions relatives aux contrôles/i,
        /contentieux de l’urbanisme/i,
      ],
    },
  ],

  voisinage: [
    {
      texte: CODE_CIVIL,
      nom: 'code civil',
      parties: [
        /Des servitudes ou services fonciers/i,
        /:\s*De la propriété$/i,
        /De la distinction des biens/i,
        /La responsabilité extracontractuelle/i,
      ],
    },
  ],

  fiscalite: [
    {
      texte: CGI,
      nom: 'code général des impôts',
      /* Le code général des impôts ne range pas la location meublée sous un
         intitulé qui la nomme : elle vit dans les bénéfices industriels et
         commerciaux, dont la section entière ferait cent dix articles pour
         une dizaine d'utiles. On prend donc les trois rubriques exactes où
         elle se décide — la définition, le micro, et le cumul de catégories. */
      parties: [
        /:\s*Revenus fonciers$/i,
        /Plus-values de cession à titre onéreux de biens ou de droits de toute nature/i,
        /Taxe annuelle sur les logements vacants/i,
        /Définition des bénéfices industriels et commerciaux/i,
        /Régime des micro-entreprises/i,
        /Contribuables disposant de revenus professionnels ressortissant à des catégories différentes/i,
      ],
    },
  ],

  sinistres: [
    {
      texte: ASSURANCES,
      nom: 'code des assurances',
      parties: [
        /Règles communes aux assurances de dommages et aux assurances de personnes/i,
        /Règles relatives aux assurances de dommages/i,
        /L’assurance des risques de catastrophes naturelles/i,
      ],
    },
    { texte: CODE_CIVIL, nom: 'code civil', parties: [/La responsabilité extracontractuelle/i] },
  ],

  profession: [
    { texte: LOI_HOGUET, nom: 'loi Hoguet' },
    { texte: DECRET_HOGUET, nom: 'décret du 20 juillet 1972' },
    { texte: DEONTOLOGIE, nom: 'code de déontologie' },
  ],
};
