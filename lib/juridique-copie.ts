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
 * Dans une chaîne de caractères, rien n'est normalisé. C'est déjà la raison
 * pour laquelle la copie de `/residence` vit dans `lib/residence.ts` plutôt
 * que dans ses composants ; ce fichier suit la même règle, et le même test la
 * vérifie.
 */

/** Paragraphe à amorce grasse : « Il ne remplace pas un avocat. Il ne connaît… » */
export interface Paragraphe {
  amorce: string;
  suite: string;
}

export const ACCUEIL = {
  titre: 'Une question sur votre bien ? Elle ira au bon spécialiste.',
  lede:
    'Neuf spécialités du droit immobilier, écrites du côté du propriétaire : bailleur, loueur en meublé de tourisme, copropriétaire, conciergerie. Chacune avec son périmètre, ses textes de référence et ses délais. Racontez votre situation comme vous la raconteriez à quelqu’un.',
  grilleTitre: 'Ou choisissez directement',
  grilleSous:
    'Chaque fiche indique ce que le spécialiste traite, ce qu’il ne traite pas, et les délais à ne pas manquer.',
  limitesTitre: 'Ce que cet assistant est, et ce qu’il n’est pas',
  limitesSous: 'Trois limites, dites avant plutôt qu’après.',
} as const;

export const LIMITES: Paragraphe[] = [
  {
    amorce: 'Il donne une information juridique',
    suite:
      ' : ce que dit la règle, ce que vous pouvez faire, dans quel délai, et vers qui vous tourner. C’est utile pour comprendre une situation, préparer un rendez-vous, ou savoir s’il y a urgence.',
  },
  {
    amorce: 'Il ne remplace pas un avocat.',
    suite:
      ' Il ne connaît de votre dossier que ce que vous lui en dites, il ne peut ni vous représenter, ni signer, ni agir avant l’expiration d’un délai. L’ADIL de votre département renseigne gratuitement sur le logement, et un point-justice reçoit sans condition de ressources pour un premier conseil.',
  },
  {
    amorce: 'Il ne cite pas de numéros d’article.',
    suite:
      ' C’est délibéré : une référence inexacte a l’apparence exacte d’une vraie et se retrouve recopiée dans un courrier. Il nomme les textes, il ne les numérote pas.',
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
