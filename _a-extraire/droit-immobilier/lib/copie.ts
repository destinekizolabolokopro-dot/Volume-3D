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
 * La mention qui dit ce que ce service n'est pas.
 *
 * C'est une exigence de fond avant d'être une précaution : en France, la
 * consultation juridique est une activité réglementée (loi du 31 décembre
 * 1971), et ce service donne un avis pratique sans être un cabinet.
 *
 * Elle n'est plus posée au-dessus de la marque. Quatre lignes de petit texte
 * gris avant même le nom du site coûtaient la première impression sans rien
 * protéger de plus : personne ne lit une décharge qu'on lui tend avant de
 * s'être présenté. Elle est désormais là où on la lit vraiment — en entier
 * dans le pied de chaque page, en entier sous chaque fiche de spécialité, et
 * rappelée en une ligne au-dessus de chaque conversation, c'est-à-dire à
 * l'endroit exact où quelqu'un pourrait prendre une réponse pour un conseil
 * d'avocat.
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

/**
 * Comment ça marche, en trois temps.
 *
 * Trois étapes et pas cinq : au-delà, une page d'accueil décrit un logiciel
 * au lieu de rassurer quelqu'un qui a un problème. Chacune répond à une
 * objection réelle — « je ne sais pas dans quelle case je tombe », « d'où
 * sort cette réponse », « et après, je fais quoi ».
 */
export const ETAPES: Paragraphe[] = [
  {
    amorce: 'Vous racontez.',
    suite:
      'En français ordinaire, comme à quelqu’un au téléphone. Rien à choisir, rien à cocher : votre question part sans spécialité, et c’est le service qui la range. Vous pouvez joindre le bail, le compromis ou le procès-verbal — il est lu, jamais conservé.',
  },
  {
    amorce: 'Le bon spécialiste répond.',
    suite:
      'Dix périmètres distincts, chacun avec ses textes officiels joints à la question. Il réclame le fait qui manque plutôt que de supposer, et quand la question sort de son domaine, il le dit au lieu de répondre quand même.',
  },
  {
    amorce: 'Vous repartez avec le texte.',
    suite:
      'Chaque réponse affiche l’article exact sur lequel elle s’appuie, avec son passage. Et quand il faut écrire — un congé, une mise en demeure, une demande au syndic —, le courrier se rédige ici, aux bonnes mentions, prêt à ouvrir dans un traitement de texte.',
  },
];

/**
 * Le cartouche posé à droite du champ, au moment où l'on hésite à confier
 * une question juridique à une machine.
 *
 * Il ne répète pas les chiffres de la section plus bas : à cet endroit, la
 * question n'est pas « combien d'articles » mais « est-ce que je peux m'y
 * fier, et qu'est-ce que ça m'engage ». Trois réponses, dans cet ordre.
 */
export const RASSURANCE = {
  oeil: 'Ce que vous obtenez',
  points: [
    'La réponse cite l’article exact, avec son passage, tiré du fonds officiel.',
    'Le document que vous joignez est lu pendant la réponse, puis oublié. Rien n’en est conservé.',
    'Une question d’essai sans inscription et sans carte bancaire : vous jugez avant de décider.',
  ],
  pied: 'Fonds arrêté au',
} as const;

/** La section qui montre d'où viennent les réponses. */
export const PREUVE = {
  oeil: 'Ce sur quoi la réponse s’appuie',
  titre: 'Le texte officiel, pas la mémoire d’une machine',
  corps:
    'Les textes de la spécialité sont joints à chaque question, tirés du fonds LEGI de la Direction de l’information légale et administrative. Quand une réponse cite un article, le numéro et le passage viennent de ce fonds — pas d’un souvenir d’entraînement. C’est la différence entre une référence qu’on peut recopier dans un courrier et une référence qui a l’apparence exacte d’une vraie.',
  note:
    'Le fonds est reconstruit depuis l’archive officielle, puis avancé jour par jour jusqu’à sa date d’arrêt. Ce qui n’y est pas — jurisprudence, règlement de copropriété, délibération de votre commune — est nommé sans être numéroté.',
  labels: {
    specialites: 'spécialités',
    textes: 'textes officiels',
    articles: 'articles joints aux questions',
    arrete: 'fonds arrêté au',
  },
} as const;

/** La section qui montre les courriers. */
export const VITRINE_DOCUMENTS = {
  oeil: 'Écrire, pas seulement comprendre',
  titre: 'Dix-sept courriers, aux mentions qui les rendent valables',
  corps:
    'Un congé pour vente auquel il manque le prix et les conditions est nul, et il n’est pas rattrapable : le délai a couru. Chaque modèle affiche ce qui doit y figurer, ce qui l’annule, comment l’envoyer pour que l’envoi se prouve, et le délai qui l’enferme. Vous racontez votre situation, le courrier sort rédigé, et vous l’ouvrez dans Word pour le relire.',
  action: 'Voir les modèles',
} as const;

/** Le dernier bloc de l'accueil : ce qu'on demande de faire. */
export const APPEL = {
  titre: 'Posez votre question',
  corps:
    'Sans inscription, sans carte bancaire. Vous voyez la réponse et ses articles avant de décider si ce service vous sert à quelque chose.',
  action: 'Commencer',
  secondaire: 'Voir les formules',
} as const;

/** Le pied de page, en colonnes. */
export const PIED = {
  colonnes: [
    {
      titre: 'Le service',
      liens: [
        { libelle: 'Poser une question', href: '/' },
        { libelle: 'Modèles de courriers', href: '/documents' },
        { libelle: 'Formules et tarifs', href: '/abonnement' },
      ],
    },
    {
      titre: 'Votre espace',
      liens: [
        { libelle: 'Mes consultations', href: '/espace/dossiers' },
        { libelle: 'Mon compte', href: '/espace/compte' },
        { libelle: 'Se connecter', href: '/entrer' },
      ],
    },
  ],
  /** Là où vont ceux pour qui ce service ne suffit pas. Nommés, pas cachés. */
  recoursTitre: 'Si votre situation dépasse une information',
  recours:
    'L’ADIL de votre département renseigne gratuitement sur le logement. Un point-justice reçoit sans condition de ressources. L’aide juridictionnelle peut prendre en charge les honoraires d’un avocat.',
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

/**
 * Ce que dit l'espace de travail, par opposition à la vitrine.
 *
 * Les mêmes pièces à l'écran — un surtitre, un titre, une amorce, une
 * invite — mais pas le même propos. La vitrine convainc quelqu'un qui hésite ;
 * ici, il a décidé, il a payé ou ouvert un compte, et il vient travailler.
 * Lui resservir « Dix spécialités du droit immobilier, pour ceux qui en
 * vivent… » chaque matin, c'est lui vendre ce qu'il a déjà.
 */
export const ESPACE = {
  oeil: 'Votre espace · droit immobilier',
  titreLignes: ['Que s’est-il passé ?'],
  lede:
    'Racontez la situation comme vous la raconteriez à quelqu’un : les faits, les dates, les montants. Elle ira au spécialiste qui en répond, avec ses textes.',
  invite: 'Votre consultation est enregistrée : vous pourrez la rouvrir depuis « Mes consultations ».',
} as const;

export const SPECIALISTE = {
  /** Affiché quand aucune clé d'API n'est configurée. */
  inactif:
    'L’assistant n’est pas configuré sur ce site : la clé ANTHROPIC_API_KEY est absente. La fiche ci-dessous reste consultable — périmètre, textes et délais n’ont besoin d’aucun modèle —, mais aucune question ne peut être posée.',
  delaisNote: 'Si un document reçu ou votre contrat mentionne un autre délai, c’est lui qui fait foi.',
  avertissement:
    'Ces réponses sont une information juridique, pas une consultation d’avocat. Elles ne tiennent compte que de ce que vous avez écrit, et rien n’y remplace la lecture de vos documents par un professionnel. En cas de délai en cours, prenez conseil sans attendre : l’ADIL de votre département renseigne gratuitement sur le logement, un point-justice reçoit sans condition de ressources, et l’aide juridictionnelle peut prendre en charge un avocat.',
} as const;

/**
 * Ce que dit l'écran des consultations.
 *
 * Il n'en reste qu'une phrase, et c'est normal : trois autres décrivaient
 * l'écran d'avant, celui qu'on voyait sans être connecté. Depuis que les
 * consultations vivent derrière la porte de l'espace, ce cas n'existe plus —
 * le gabarit renvoie vers l'entrée avant que la page ne s'affiche. Des textes
 * qu'aucune page ne lit finissent par être relus, traduits et corrigés pour
 * rien.
 */
export const DOSSIERS = {
  inviteQuestion: 'Posez une première question pour ouvrir un dossier.',
} as const;

export const ORIENTATION = {
  invite: 'Une question d’essai, sans inscription. Vous verrez la réponse et les articles cités avant de décider quoi que ce soit.',
  placeholder:
    'Racontez votre situation. Par exemple : mon locataire est parti en laissant deux mois de loyer, et je ne sais pas par quoi commencer.',
  autres: 'Ce n’est pas la bonne spécialité ?',
} as const;
