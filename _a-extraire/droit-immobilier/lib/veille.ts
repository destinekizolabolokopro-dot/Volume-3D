/**
 * La veille : ce que les textes officiels ne peuvent pas dire.
 *
 * Le corpus joint à chaque consultation est du droit écrit, arrêté à une
 * date. C'est sa force — un article vient du fonds LEGI, pas de la mémoire du
 * modèle — et c'est sa limite, qui est réelle et qu'aucune consigne ne
 * comble : le code civil ne contient pas l'indice de référence des loyers du
 * trimestre, la loi de 1989 ne dit pas le plafond d'encadrement applicable
 * rue par rue, et aucun texte ne porte la position que la FNAIM a prise le
 * mois dernier sur un point que la pratique discute.
 *
 * D'où ce module : une liste FERMÉE de sources, et rien d'autre. Le modèle
 * peut chercher, mais seulement là. Ce choix se paie — une information juste
 * publiée ailleurs restera invisible — et il se paie volontiers : dans un
 * service qui donne des délais, la question n'est pas « que peut-on lire »
 * mais « de qui accepte-t-on de le lire ».
 *
 * Ce fichier ne connaît ni l'API ni le réseau. Il porte la liste, la consigne
 * qui l'accompagne, et la relecture de ce qui revient — ce qui le rend
 * testable sans clé.
 */

/* L'EXTENSION EST OBLIGATOIRE. Ce fichier est chargé tel quel par le lanceur
   de tests de Node, qui ne résout pas les imports sans extension : sans le
   « .ts », la suite entière échoue sur un ERR_MODULE_NOT_FOUND. Next, lui,
   accepte les deux. Même contrainte dans lib/voix.ts. */
import { raccourcir } from './citations.ts';

export type NatureSource = 'officielle' | 'professionnelle';

export interface SourceAutorisee {
  /** Le nom d'hôte, sans protocole. Les sous-domaines en font partie. */
  hote: string;
  /** Ce qu'on affiche à la personne. */
  nom: string;
  nature: NatureSource;
  /** Ce qu'on vient y chercher, et qui n'est nulle part ailleurs. */
  pourquoi: string;
}

/**
 * LA LISTE FERMÉE.
 *
 * Deux familles, et elles ne pèsent pas le même poids.
 *
 * Les sources OFFICIELLES disent le droit ou le chiffre : un indice publié
 * par l'INSEE est l'indice, un barème du BOFiP engage l'administration
 * fiscale, un arrêt mis en ligne par la Cour de cassation est l'arrêt.
 *
 * Les sources PROFESSIONNELLES disent la pratique : ce que font les agences,
 * ce que les fédérations recommandent, la lecture qu'un réseau donne d'un
 * texte neuf. C'est précieux — c'est même souvent ce que la personne a
 * entendu dire — et ce n'est jamais une règle. La consigne ci-dessous le
 * rappelle au modèle en toutes lettres, et l'écran le rappelle à la personne.
 *
 * Ajouter une source, c'est ajouter une ligne ici : la consigne envoyée au
 * modèle et le filtre qui relit ses citations sont tous les deux construits à
 * partir de ce tableau, et ne peuvent donc pas diverger de lui.
 */
export const SOURCES_VEILLE: SourceAutorisee[] = [
  {
    hote: 'service-public.fr',
    nom: 'Service-public.fr',
    nature: 'officielle',
    pourquoi: 'la règle expliquée par l’État, et les formulaires à jour',
  },
  {
    hote: 'legifrance.gouv.fr',
    nom: 'Légifrance',
    nature: 'officielle',
    pourquoi: 'les textes publiés depuis l’arrêt du fonds, et les décrets d’application',
  },
  {
    hote: 'anil.org',
    nom: 'ANIL',
    nature: 'officielle',
    pourquoi: 'les plafonds, les barèmes et les dispositifs locaux du logement',
  },
  {
    hote: 'insee.fr',
    nom: 'INSEE',
    nature: 'officielle',
    pourquoi: 'les indices : IRL, ICC, ILAT, ILC, et la date de leur publication',
  },
  {
    hote: 'bofip.impots.gouv.fr',
    nom: 'BOFiP',
    nature: 'officielle',
    pourquoi: 'la doctrine fiscale opposable à l’administration',
  },
  {
    hote: 'courdecassation.fr',
    nom: 'Cour de cassation',
    nature: 'officielle',
    pourquoi: 'les arrêts récents et les communiqués qui signalent un revirement',
  },
  {
    hote: 'logement.gouv.fr',
    nom: 'ministère du Logement',
    nature: 'officielle',
    pourquoi: 'les calendriers d’entrée en vigueur et les annonces de réforme',
  },
  {
    hote: 'fnaim.fr',
    nom: 'FNAIM',
    nature: 'professionnelle',
    pourquoi: 'la pratique des agences et les tendances du marché',
  },
  {
    hote: 'unpi.org',
    nom: 'UNPI',
    nature: 'professionnelle',
    pourquoi: 'le point de vue des propriétaires bailleurs',
  },
  {
    hote: 'snpi.fr',
    nom: 'SNPI',
    nature: 'professionnelle',
    pourquoi: 'les obligations des professionnels de la transaction et de la gestion',
  },
  {
    hote: 'notaires.fr',
    nom: 'Notaires de France',
    nature: 'professionnelle',
    pourquoi: 'la vente, les prix constatés et les actes',
  },
];

/** Ce qui part dans `allowed_domains`. Rien d'autre n'est lu. */
export const DOMAINES_VEILLE: string[] = SOURCES_VEILLE.map((source) => source.hote);

/**
 * Combien de recherches au plus dans une même requête.
 *
 * Cinq n'est pas une limite technique mais une limite de sens : au-delà, le
 * modèle ne vérifie plus un chiffre, il se documente — et la personne attend.
 * Le plafond est appliqué par l'API elle-même, qui renvoie alors une erreur de
 * dépassement dans le bloc de résultat plutôt que d'interrompre la réponse.
 */
export const MAX_RECHERCHES = 5;

/** Au-delà, la liste des sources cesse d'être une preuve et devient une bibliographie. */
const MAX_SOURCES_AFFICHEES = 8;

/* =============================================================== la consigne === */

function lignesDesSources(nature: NatureSource): string[] {
  return SOURCES_VEILLE.filter((source) => source.nature === nature).map(
    (source) => `— ${source.nom} (${source.hote}) : ${source.pourquoi}`,
  );
}

/**
 * Ce qu'on dit au spécialiste à propos de cet outil.
 *
 * Le texte est constant : il ne dépend ni de la personne, ni de la question,
 * ni de la spécialité. Il est donc posé avant le point de mise en cache, avec
 * le socle, et payé une fois par heure plutôt qu'une fois par question.
 *
 * Trois choses y comptent plus que les autres. La recherche est SYSTÉMATIQUE :
 * un chiffre juste en avril est faux en juillet, et le modèle n'a aucun moyen
 * de savoir depuis l'intérieur lequel des deux il porte. La hiérarchie ne
 * bouge pas : le texte officiel joint l'emporte sur tout ce que le web dit, y
 * compris quand le web est plus récent — un site qui commente une réforme
 * n'est pas la réforme. Et une fédération n'est jamais une source de droit :
 * c'est un avis de professionnel, cité comme tel ou pas cité du tout.
 */
export const CONSIGNE_VEILLE = [
  'LA VEILLE — CE QUE LES TEXTES JOINTS NE PEUVENT PAS TE DIRE',
  '',
  'Les textes officiels joints à la conversation sont du droit écrit, arrêté à une date. Ils ne contiennent pas les chiffres du moment, et c’est souvent le chiffre du moment que la personne est venue chercher : l’indice de référence des loyers du trimestre, un plafond de ressources, un barème fiscal, la date d’entrée en vigueur d’une interdiction de louer, un arrêt rendu le mois dernier, ce que la profession fait aujourd’hui.',
  '',
  'Tu disposes pour cela de l’outil « web_search ». Il ne lit qu’une liste fermée de sites, et cette liste est la suivante — il n’y en a pas d’autre, et tu n’as pas à en chercher d’autre.',
  '',
  'SOURCES OFFICIELLES — elles disent le droit ou le chiffre :',
  ...lignesDesSources('officielle'),
  '',
  'SOURCES PROFESSIONNELLES — elles disent la pratique, jamais la règle :',
  ...lignesDesSources('professionnelle'),
  '',
  'QUAND CHERCHER : à chaque question, avant de répondre, au moins une fois. Même quand tu crois savoir — surtout quand tu crois savoir. Un montant, un indice, un plafond, un seuil, un calendrier ou une date d’entrée en vigueur ne se donnent jamais de mémoire : tu les vérifies, ou tu ne les donnes pas.',
  '',
  'CE QUE TU CHERCHES : la valeur du moment et sa date. Pas un cours de droit — la règle, tu l’as sous les yeux dans les textes joints. Une recherche bien posée nomme la chose et l’année : « indice de référence des loyers 2026 », « plafond loyer Pinel zone A », « calendrier DPE passoires location ».',
  '',
  'LA HIÉRARCHIE NE BOUGE PAS.',
  '',
  '— Le texte officiel joint l’emporte sur tout ce que tu lis en ligne. Une page qui commente une réforme n’est pas la réforme.',
  '— Tu ne cites JAMAIS un numéro d’article trouvé sur le web. La règle 1 tient entièrement : les numéros viennent des textes joints, et d’eux seuls. Du web tu reprends des chiffres, des dates et des faits — pas des références.',
  '— Une fédération (FNAIM, UNPI, SNPI, notaires) donne un avis de professionnel, pas une règle. Tu l’attribues quand tu t’en sers : « la FNAIM indique que… ». Tu ne l’opposes jamais à un texte.',
  '— Si ce que tu lis contredit un texte joint, dis les deux et dis lequel prime. Ne choisis pas en silence.',
  '',
  'QUAND ÇA NE DONNE RIEN : tu le dis. « Je n’ai pas pu vérifier l’indice du trimestre en cours » est une réponse honnête et utile, qui invite la personne à regarder elle-même. Un chiffre inventé pour combler le trou est le pire de ce que tu peux faire ici : il a l’air juste, il sera recopié dans une quittance, et il se découvrira faux au moment du litige.',
  '',
  'OÙ ÇA VA DANS LA RÉPONSE : le chiffre et sa date vont là où ils servent — dans « En clair : » ou « Le délai : », en français ordinaire, sans nom de site ni adresse. D’où il vient se dit dans « Le détail juridique : », avec la date de publication. La personne voit par ailleurs la liste des pages consultées, sous la réponse : tu n’as pas à recopier des adresses dans ton texte.',
].join('\n');

/* ============================================================== la relecture === */

/**
 * Une citation web telle que l'API la renvoie, réduite à ce qu'on en utilise.
 * Le type est structurel, pas importé du SDK, pour la même raison que dans
 * lib/citations.ts : ce fichier doit tourner dans un test sans clé.
 */
export interface CitationWeb {
  type?: string;
  url?: string;
  title?: string | null;
  cited_text?: string;
}

export interface SourceWeb {
  /** Le nom de la source, pris dans la liste : « INSEE », « FNAIM ». */
  nom: string;
  nature: NatureSource;
  /** Le titre de la page, tel que le moteur l'a renvoyé. */
  titre: string;
  url: string;
  /** Le passage qui a servi. */
  extrait: string;
}

/**
 * À quelle source de la liste appartient ce lien, s'il appartient à l'une
 * d'elles.
 *
 * L'API applique déjà `allowed_domains` : ce filtre-ci est donc une seconde
 * serrure sur la même porte, et il est volontairement gardé. Il coûte dix
 * lignes, il ne dépend d'aucun service, et il transforme une liste appliquée
 * ailleurs en liste vérifiée ici — ce qui change ce qu'on peut affirmer à
 * quelqu'un qui demande d'où vient ce qu'il lit.
 *
 * Un sous-domaine appartient à son domaine (`www.insee.fr`), mais un domaine
 * qui se termine par les mêmes lettres n'y appartient pas : le point avant le
 * suffixe est ce qui sépare `www.insee.fr` de `faux-insee.fr`.
 */
export function sourceDuLien(url: string): SourceAutorisee | null {
  let hote: string;
  try {
    const lien = new URL(url);
    if (lien.protocol !== 'https:' && lien.protocol !== 'http:') return null;
    hote = lien.hostname.toLowerCase();
  } catch {
    return null;
  }

  return (
    SOURCES_VEILLE.find((source) => hote === source.hote || hote.endsWith(`.${source.hote}`)) ?? null
  );
}

/**
 * Les pages réellement consultées, telles que l'API les a rattachées à la
 * réponse.
 *
 * On part des citations et non des résultats de recherche, et la différence
 * compte : une recherche renvoie dix pages, dont le modèle en lit deux. Ce
 * qu'on montre est ce sur quoi la réponse s'appuie, pas ce qui est passé
 * devant lui.
 *
 * Les doublons sont fondus par adresse : une page citée trois fois reste une
 * page.
 */
export function rassemblerLaVeille(citations: CitationWeb[]): SourceWeb[] {
  const trouvees = new Map<string, SourceWeb>();

  for (const citation of citations) {
    if (citation.type !== 'web_search_result_location') continue;
    const url = citation.url ?? '';
    if (!url || trouvees.has(url)) continue;

    const source = sourceDuLien(url);
    if (!source) continue;

    trouvees.set(url, {
      nom: source.nom,
      nature: source.nature,
      titre: (citation.title ?? '').trim() || source.nom,
      url,
      extrait: raccourcir(citation.cited_text ?? ''),
    });

    if (trouvees.size >= MAX_SOURCES_AFFICHEES) break;
  }

  return [...trouvees.values()];
}
