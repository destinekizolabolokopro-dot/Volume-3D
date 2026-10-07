/**
 * Qui édite ce site, et qui l'héberge.
 *
 * Ces mentions ne sont pas décoratives : l'article 6 III de la loi du 21 juin
 * 2004 pour la confiance dans l'économie numérique oblige tout éditeur d'un
 * service en ligne à les publier, et l'article L221-5 du code de la
 * consommation en ajoute pour qui vend à des particuliers. Les omettre est
 * une infraction ; les inventer serait pire.
 *
 * D'où ce module. Aucune valeur n'est écrite en dur, aucune n'est devinée :
 * tout vient de l'environnement, et ce qui manque est NOMMÉ plutôt que
 * remplacé par un texte plausible. Une mention légale fausse a exactement
 * l'apparence d'une vraie — c'est la même règle que celle qu'on applique aux
 * articles de loi cités dans les réponses.
 *
 * Tant que ces variables sont vides, les pages légales existent, se lisent, et
 * disent en tête ce qui leur manque. C'est moins joli qu'une page complète
 * inventée, et c'est la seule chose honnête à faire.
 */

/** Une mention, avec l'étiquette qui la nomme dans la page et la variable qui la porte. */
export interface Mention {
  /** Ce qui s'affiche à gauche, dans la page. */
  label: string;
  /** La variable d'environnement qui la renseigne. */
  variable: string;
  /** La valeur, ou une chaîne vide. */
  valeur: string;
  /**
   * Obligatoire pour publier. Les facultatives — TVA d'un auto-entrepreneur en
   * franchise, capital d'une entreprise individuelle — ne comptent pas comme
   * manquantes quand elles sont vides : réclamer un numéro de TVA à qui n'en a
   * pas serait un faux problème posé toute l'année.
   */
  requise: boolean;
  /** Une ligne d'aide, pour celui qui remplit. */
  aide?: string;
}

const lire = (variable: string): string => (process.env[variable] ?? '').trim();

const mention = (
  label: string,
  variable: string,
  requise: boolean,
  aide?: string,
): Mention => ({ label, variable, valeur: lire(variable), requise, aide });

/** L'éditeur : qui répond de ce qui est publié ici. */
export function editeur(): Mention[] {
  return [
    mention('Dénomination', 'EDITEUR_NOM', true, 'Le nom de l’entreprise, ou vos nom et prénom.'),
    mention('Forme juridique', 'EDITEUR_STATUT', true, 'Entreprise individuelle, SASU, SARL…'),
    mention('Siège', 'EDITEUR_ADRESSE', true, 'L’adresse complète, telle qu’elle est immatriculée.'),
    mention('SIREN', 'EDITEUR_SIREN', true, 'Les neuf chiffres de l’immatriculation.'),
    mention('RCS', 'EDITEUR_RCS', false, 'Ville d’immatriculation, pour une société.'),
    mention('Capital social', 'EDITEUR_CAPITAL', false, 'Pour une société seulement.'),
    mention('TVA intracommunautaire', 'EDITEUR_TVA', false, 'Vide si vous êtes en franchise.'),
    mention('Directeur de la publication', 'EDITEUR_DIRECTEUR', true, 'La personne physique qui répond du contenu.'),
    mention('Courriel de contact', 'EDITEUR_COURRIEL', true, 'Une adresse réellement relevée.'),
    mention('Téléphone', 'EDITEUR_TELEPHONE', false, 'Facultatif si le courriel est relevé.'),
  ];
}

/** L'hébergeur : la LCEN exige son nom, son adresse et son téléphone. */
export function hebergeur(): Mention[] {
  return [
    mention('Hébergeur', 'HEBERGEUR_NOM', true, 'Vercel, OVH, Scaleway…'),
    mention('Adresse', 'HEBERGEUR_ADRESSE', true, 'Le siège de l’hébergeur, pas le vôtre.'),
    mention('Téléphone', 'HEBERGEUR_TELEPHONE', true, 'Celui que l’hébergeur publie.'),
  ];
}

/**
 * Le médiateur de la consommation.
 *
 * L'article L612-1 du code de la consommation impose à tout professionnel qui
 * vend à des particuliers d'adhérer à un dispositif de médiation et d'en
 * publier les coordonnées. Ce n'est pas facultatif dès la première vente.
 */
export function mediateur(): Mention[] {
  return [
    mention('Médiateur', 'MEDIATEUR_NOM', true, 'Le nom du médiateur auquel vous adhérez.'),
    mention('Adresse', 'MEDIATEUR_ADRESSE', true, 'Son adresse postale.'),
    mention('Site', 'MEDIATEUR_SITE', true, 'L’adresse de son formulaire de saisine.'),
  ];
}

/**
 * Le régime de TVA, tel qu'il doit être écrit à côté des prix.
 *
 * Il n'est pas déduit de la présence d'un numéro de TVA, et c'est voulu. Un
 * numéro vide peut vouloir dire « franchise en base » — le cas le plus
 * fréquent — mais aussi tout autre chose, et se tromper ici, c'est écrire sur
 * une page de vente une mention fiscale fausse. Le projet ne devine aucune
 * mention légale : il les réclame, et dit lesquelles manquent.
 *
 * Les deux formulations usuelles sont dans l'aide, pour que celui qui
 * remplit n'ait pas à les chercher.
 */
export function tva(): Mention[] {
  return [
    mention(
      'Régime de TVA',
      'EDITEUR_TVA_REGIME',
      true,
      'La phrase à afficher près des prix. En franchise : « TVA non applicable, article 293 B du CGI ». Assujetti : « Prix TTC, TVA au taux de 20 % ».',
    ),
  ];
}

/** Les mentions obligatoires qui manquent encore, toutes rubriques confondues. */
export function mentionsManquantes(): Mention[] {
  return [...editeur(), ...hebergeur(), ...mediateur(), ...tva()].filter(
    (m) => m.requise && !m.valeur,
  );
}

/** Vrai quand tout ce que la loi réclame est renseigné. */
export function editeurComplet(): boolean {
  return mentionsManquantes().length === 0;
}

/**
 * Le nom de l'éditeur pour le corps d'un texte — « nous », si l'on veut dire
 * quelque chose avant d'avoir un nom.
 */
export function nomDeLEditeur(): string {
  return lire('EDITEUR_NOM') || 'L’éditeur du site';
}

/** L'adresse à laquelle exercer ses droits, ou une chaîne vide. */
export function courrielDeContact(): string {
  return lire('EDITEUR_COURRIEL');
}
