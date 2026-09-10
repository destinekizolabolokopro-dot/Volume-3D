/**
 * La copie affichée de la zone juridique, et sa typographie.
 *
 * Pourquoi ces textes ne sont pas écrits directement dans le JSX : la
 * ponctuation double française prend une espace fine insécable (U+202F) — et
 * U+202F porte la propriété Unicode White_Space. Le texte libre d'un élément
 * JSX est normalisé à la compilation : l'espace fine y est ramenée à une
 * espace ordinaire, et le navigateur redevient libre de couper devant le
 * point d'interrogation. Le titre de l'accueil commençait ainsi une ligne par
 * « ? Elle ira au bon spécialiste ».
 *
 * Dans une chaîne de caractères, rien n'est normalisé. C'est la raison pour
 * laquelle la copie affichée vit ici plutôt que dans ses composants, et
 * `tests/domaines.test.ts` le vérifie.
 */

/** Paragraphe à amorce grasse : « Il ne remplace pas un avocat. Il ne connaît… » */
export interface Paragraphe {
  amorce: string;
  suite: string;
}

/**
 * Le nom du service, à un seul endroit.
 *
 * Le nom vit dans cette constante parce qu'il apparaît dans la barre, le pied
 * de page, le titre d'onglet et le gabarit des titres de page : le changer
 * ailleurs qu'ici laisserait une occurrence en arrière, et c'est toujours
 * celle-là qu'un client remarque.
 */
export const MARQUE = {
  nom: 'Droit immobilier',
  /* Sous le nom, en petit : ce que c'est, pas qui l'édite. */
  accroche: 'dix spécialités, une réponse sourcée',
} as const;

/**
 * La mention qui ne quitte jamais l'écran.
 *
 * Elle est affichée en haut de CHAQUE page, sous la barre, et pas seulement
 * en pied. C'est une exigence de fond avant d'être une précaution : en France,
 * la consultation juridique est une activité réglementée (loi du 31 décembre
 * 1971), et ce service donne un avis pratique sans être un cabinet. Quelqu'un
 * qui arrive par un moteur de recherche sur une fiche, lit une réponse et
 * repart n'aura peut-être jamais vu le pied de page.
 *
 * Elle est écrite pour être lue, pas pour couvrir : trois choses concrètes
 * qu'il ne fait pas, plutôt qu'une formule juridique que personne ne finit.
 */
export const MENTION = {
  court: 'Ce service ne fait pas le travail d’un avocat.',
  long:
    'Il donne une information et un avis pratique. Il n’analyse pas votre dossier, ne vous représente pas et ne signe rien à votre place. Sur un enjeu important ou un délai qui court, voyez un avocat : l’ADIL renseigne gratuitement sur le logement, un point-justice reçoit sans condition de ressources, et l’aide juridictionnelle peut prendre en charge les honoraires.',
} as const;

export const ACCUEIL = {
  oeil: 'Assistant juridique · droit immobilier',
  titre: 'Une question sur votre bien ? Elle ira au bon spécialiste.',
  /* Le titre coupé là où il doit l'être. Laissé au navigateur, il place le
     point d'interrogation en début de ligne une fois sur deux selon la
     largeur — et `text-wrap: balance` n'y peut rien. */
  titreLignes: ['Une question sur votre bien ?', 'Elle ira au bon spécialiste.'],
  lede:
    'Dix spécialités du droit immobilier, pour ceux qui en vivent : propriétaires bailleurs, loueurs en meublé de tourisme, copropriétaires — et les professionnels qui les accompagnent, agents, mandataires, gestionnaires. Chacune avec son périmètre, ses délais couperets et son aide-mémoire. Racontez votre situation comme vous la raconteriez à quelqu’un.',
  grilleTitre: 'Ou choisissez directement',
  grilleSous:
    'Chaque fiche indique ce que le spécialiste traite, ce qu’il ne traite pas, les délais à ne pas manquer et les pièces à réunir avant d’agir.',
  limitesTitre: 'Ce que cet assistant est, et ce qu’il n’est pas',
  limitesSous: 'Trois limites, dites avant plutôt qu’après.',
  piedMention:
    'Information juridique, et non consultation d’avocat. Les réponses ne tiennent compte que de ce qui est écrit dans la conversation. En cas de délai en cours, prenez conseil sans attendre : l’ADIL renseigne gratuitement sur le logement, un point-justice reçoit sans condition de ressources.',
} as const;

export const LIMITES: Paragraphe[] = [
  {
    amorce: 'Il donne une information juridique.',
    suite:
      'Ce que dit la règle, ce que vous pouvez faire, dans quel délai, et vers qui vous tourner. C’est utile pour comprendre une situation, préparer un rendez-vous, ou savoir s’il y a urgence.',
  },
  {
    amorce: 'Il ne remplace pas un avocat.',
    suite:
      'Il ne connaît de votre dossier que ce que vous lui en dites, il ne peut ni vous représenter, ni signer, ni agir avant l’expiration d’un délai. L’ADIL de votre département renseigne gratuitement sur le logement, et un point-justice reçoit sans condition de ressources pour un premier conseil.',
  },
  {
    amorce: 'Il ne cite que ce qu’il a sous les yeux.',
    suite:
      'Les textes officiels de sa spécialité lui sont joints à chaque question, tirés du fonds LEGI. Il en cite le passage exact et l’article, et le numéro affiché vient du fonds, pas de sa mémoire. Sur tout le reste — jurisprudence, règlement de copropriété, délibération de votre commune —, il nomme la source sans la numéroter : une référence inexacte a l’apparence exacte d’une vraie, et se retrouve recopiée dans un courrier.',
  },
];

export const SPECIALISTE = {
  /** Affiché quand aucune clé d'API n'est configurée. */
  inactif:
    'L’assistant n’est pas configuré sur ce site : la clé ANTHROPIC_API_KEY est absente. La fiche ci-dessous reste consultable — périmètre, textes et délais n’ont besoin d’aucun modèle —, mais aucune question ne peut être posée.',
  delaisNote: 'Si un document reçu ou votre contrat mentionne un autre délai, c’est lui qui fait foi.',
  avertissement:
    'Ces réponses sont une information juridique, pas une consultation d’avocat. Elles ne tiennent compte que de ce que vous avez écrit, et rien n’y remplace la lecture de vos documents par un professionnel. En cas de délai en cours, prenez conseil sans attendre : l’ADIL de votre département renseigne gratuitement sur le logement, un point-justice reçoit sans condition de ressources, et l’aide juridictionnelle peut prendre en charge un avocat.',
} as const;

export const DOSSIERS = {
  titre: 'Mes consultations',
  anonyme:
    'Vos échanges ne sont conservés que si vous avez un compte. Sans connexion, un fil vit le temps de l’onglet : rien n’est écrit, ni côté serveur, ni dans un cookie.',
  inviteConnexion: 'Connectez-vous pour retrouver vos consultations passées.',
  vide: 'Aucune consultation enregistrée pour l’instant.',
  inviteQuestion: 'Posez une première question pour ouvrir un dossier.',
} as const;

export const ORIENTATION = {
  invite: 'Aucune inscription n’est demandée pour poser une question.',
  placeholder:
    'Racontez votre situation. Par exemple : mon locataire est parti en laissant deux mois de loyer, et je ne sais pas par quoi commencer.',
  autres: 'Ce n’est pas la bonne spécialité ?',
} as const;
