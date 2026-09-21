/**
 * Les textes du cadre : confidentialité et conditions de vente.
 *
 * Ils sont ici plutôt que dans le JSX pour une raison précise : ces
 * paragraphes seront relus par quelqu'un dont le métier est le droit, pas le
 * code. Un relecteur doit pouvoir les lire d'un bout à l'autre sans traverser
 * des balises, et proposer une correction sans risquer de casser une page.
 *
 * Ils sont aussi séparés de `copie.ts`, qui porte la voix du produit : ici, on
 * ne cherche ni à convaincre ni à rassurer. On dit ce qu'il en est.
 *
 * DEUX AVERTISSEMENTS, adressés à celui qui exploite ce site.
 *
 * 1. Ces textes sont écrits d'après le RGPD et le code de la consommation, et
 *    ils décrivent honnêtement ce que ce logiciel FAIT. Ils ne remplacent pas
 *    la relecture d'un professionnel : la façon dont vous facturez, votre
 *    statut, votre assurance et votre médiateur ne sont pas dans le code.
 * 2. Ils décrivent le traitement réel. Si le code change — un sous-traitant de
 *    plus, une durée de conservation différente, une donnée nouvelle —, ces
 *    textes doivent changer avec lui, sans quoi ils deviennent faux. Les
 *    sous-traitants sont donc énumérés à partir de ce que le code appelle
 *    vraiment, et pas de mémoire.
 */

export interface Article {
  titre: string;
  /** Un ou plusieurs paragraphes. */
  corps: string[];
  /** Une liste à puces, s'il en faut une. */
  points?: string[];
  /**
   * Un nom d'ancre stable, pour les articles vers lesquels on pointe depuis
   * ailleurs.
   *
   * Les autres sont numérotés par leur rang, ce qui suffit tant que personne
   * ne pointe dessus — mais un lien « Remboursement » qui vise `#article-4`
   * se met à désigner la garantie le jour où l'on insère un article avant
   * lui, et rien ne le signale : la page s'ouvre, elle défile, et elle montre
   * autre chose.
   */
  ancre?: string;
}

/* ====================================================== confidentialité === */

/**
 * Les sous-traitants, nommés un par un.
 *
 * L'article 13 du RGPD demande les « destinataires ou catégories de
 * destinataires ». La catégorie est permise ; le nom vaut mieux, parce qu'il
 * est vérifiable. Chacun correspond à une dépendance réelle du code : le
 * modèle (lib/juriste.ts), la base (lib/store.ts), le courriel
 * (lib/courriel.ts).
 */
export const SOUS_TRAITANTS = [
  {
    nom: 'Anthropic',
    role: 'Le modèle',
    lieu: 'États-Unis, avec clauses contractuelles types',
    quoi: 'Votre question, l’historique de la consultation en cours, et le document que vous joignez le temps de la réponse.',
    note: 'Les échanges transmis par l’API ne servent pas à entraîner le modèle.',
  },
  {
    nom: 'Supabase',
    role: 'La base',
    lieu: 'Union européenne',
    quoi: 'Votre compte, vos consultations et leurs messages.',
    note: 'Les documents que vous déposez n’y sont jamais écrits : seul leur nom de fichier subsiste.',
  },
  {
    nom: 'Resend',
    role: 'Les courriels',
    lieu: 'États-Unis, avec clauses contractuelles types',
    quoi: 'Votre adresse électronique et le contenu des messages de service — confirmation d’adresse, réinitialisation de mot de passe.',
    note: 'Aucun courriel de démarchage n’est envoyé depuis ce service.',
  },
] as const;

export const CONFIDENTIALITE: Article[] = [
  {
    titre: 'Ce que ce site enregistre',
    corps: [
      'Trois choses, et rien d’autre : ce qu’il faut pour tenir un compte, ce qu’il faut pour vous rendre vos consultations, et ce qu’il faut pour compter les questions d’une formule.',
    ],
    points: [
      'Votre compte : nom, adresse électronique, empreinte du mot de passe, formule en cours, date de création, date de confirmation de l’adresse.',
      'Vos consultations : la spécialité saisie, vos questions, les réponses reçues, et leurs dates.',
      'Les courriers rédigés : leur modèle et leur date, pour compter ce qu’une formule autorise. Jamais leur contenu.',
      'Les jetons de service : l’empreinte des liens de confirmation et de réinitialisation, et leur date d’expiration.',
    ],
  },
  {
    titre: 'Ce qu’il n’enregistre pas',
    corps: [
      'Les documents que vous joignez à une question — bail, compromis, procès-verbal d’assemblée, avis d’imposition — ne sont écrits nulle part. Ils traversent la mémoire du serveur le temps de fabriquer la réponse, puis disparaissent. Seul le nom du fichier reste dans le fil, pour que vous sachiez de quoi parlait l’échange.',
      'Il n’y a ni mouchard publicitaire, ni mesure d’audience, ni revente de quoi que ce soit, ni bouton de réseau social. Aucune page n’appelle un serveur tiers : les polices de caractères sont servies depuis ce site, et non depuis celui de leur éditeur. Le détail de ce qui est déposé dans votre navigateur est à l’article suivant.',
    ],
  },
  {
    titre: 'Cookies et stockage local',
    ancre: 'cookies',
    corps: [
      'Ce site dépose deux cookies, et l’un des deux ne concerne que son propriétaire. Aucun ne sert à vous suivre, aucun n’appartient à un tiers, aucun ne survit à votre déconnexion.',
    ],
    points: [
      '« jur_session » — votre session. Il contient un jeton signé qui dit « ce navigateur est connecté à ce compte », et rien d’autre : ni votre nom, ni votre adresse. Il est inaccessible au JavaScript de la page, limité à ce site, et dure trente jours ou jusqu’à votre déconnexion.',
      '« jur_reglages » — la session du propriétaire du site, dans l’espace de réglages. Vous ne l’aurez jamais si vous n’êtes pas lui.',
      'Stockage local : la voix de lecture que vous avez choisie et l’état du mode mains libres. Ils restent dans votre navigateur, ne partent jamais vers le serveur, et disparaissent si vous videz vos données de site.',
      'Stockage de session : si vous posez une question avant d’avoir un compte, votre échange y attend le temps de l’inscription, pour ne pas vous faire retaper votre situation. Il est effacé dès qu’il a été repris, et au plus tard à la fermeture de l’onglet.',
    ],
  },
  {
    titre: 'Pourquoi il n’y a pas de bandeau de cookies',
    corps: [
      'Parce qu’il n’y a rien à vous demander. Le consentement n’est exigé que pour les traceurs qui ne sont pas strictement nécessaires au service que vous demandez — mesure d’audience publicitaire, régie, réseaux sociaux, recommandation. Les cookies ci-dessus sont exemptés par l’article 82 de la loi Informatique et Libertés, tel que la CNIL l’applique : sans eux, il n’y a pas de connexion possible.',
      'Vous afficher un bandeau pour des cookies exemptés reviendrait à vous demander une autorisation dont nous n’avons pas besoin, et à laisser croire que refuser change quelque chose. Nous préférons vous dire ce qui est déposé, et pourquoi.',
      'Si un outil de mesure d’audience devait être ajouté un jour, un bandeau apparaîtrait avec lui, et refuser y serait aussi simple qu’accepter. Cette page le dirait avant.',
    ],
  },
  {
    titre: 'Pourquoi, et à quel titre',
    corps: [
      'Tenir votre compte, vous rendre vos consultations et compter les questions d’une formule relèvent de l’exécution du contrat qui nous lie (article 6.1.b du RGPD).',
      'Confirmer votre adresse et vous permettre de reprendre la main sur un compte perdu relèvent de notre intérêt légitime à sécuriser l’accès (article 6.1.f).',
      'Les obligations comptables, pour ceux qui paient, relèvent d’une obligation légale (article 6.1.c).',
    ],
  },
  {
    titre: 'Combien de temps',
    corps: [
      'Votre compte et vos consultations sont conservés tant que le compte existe. Vous pouvez le supprimer vous-même, à tout moment, depuis « Mes données » : la suppression efface le compte, les consultations, leurs messages et la trace des courriers rédigés. Elle est immédiate et sans retour.',
      'Un compte resté sans connexion pendant trois ans est supprimé, après un avertissement envoyé à son adresse.',
      'Les jetons de confirmation et de réinitialisation expirent en une heure et sont effacés ensuite.',
      'Les pièces comptables des abonnements payés sont conservées dix ans, comme la loi l’impose.',
    ],
  },
  {
    titre: 'Vos droits',
    corps: [
      'Vous pouvez accéder à vos données, les rectifier, les effacer, en obtenir une copie lisible par une machine, en demander la limitation, ou vous opposer à un traitement fondé sur l’intérêt légitime.',
      'Deux de ces droits s’exercent sans nous écrire, depuis la page « Mes données » de votre espace : récupérer une copie complète de ce que ce site détient sur vous, et supprimer votre compte. C’est plus rapide qu’une demande, et cela ne vous oblige pas à vous expliquer.',
      'Pour les autres, écrivez à l’adresse de contact indiquée dans les mentions légales. La réponse est due dans un délai d’un mois.',
      'Si cette réponse ne vous satisfait pas, vous pouvez saisir la CNIL — 3 place de Fontenoy, 75007 Paris, cnil.fr.',
    ],
  },
  {
    titre: 'Une décision automatisée ?',
    corps: [
      'Les réponses de l’assistant sont produites par un modèle de langage. Elles ne produisent aucun effet juridique par elles-mêmes et ne décident rien à votre place : elles vous informent, et c’est vous qui agissez. Aucun profilage n’est fait à partir de vos questions.',
    ],
  },
];

/* =============================================================== les CGV === */

export const CONDITIONS: Article[] = [
  {
    titre: 'Objet',
    corps: [
      'Ce service donne une information juridique en droit immobilier et met à disposition des modèles de courriers. Il ne fournit pas de consultation juridique au sens de la loi du 31 décembre 1971 : il n’examine pas votre dossier, ne vous représente pas, ne rédige aucun acte à votre place et ne s’engage sur aucune issue.',
      'Les présentes conditions s’appliquent dès la création d’un compte, et régissent les formules payantes.',
    ],
  },
  {
    titre: 'Les formules et leur prix',
    corps: [
      'La formule Découverte est gratuite et donne dix questions par mois. Les formules payantes lèvent ou étendent cette limite ; leur prix est affiché toutes taxes comprises sur la page des formules, et c’est celui qui est dû.',
      'Le compteur de questions repart au premier jour de chaque mois. Les questions non posées ne se reportent pas.',
      'Le prix peut changer. Un changement est annoncé au moins trente jours à l’avance à l’adresse de votre compte, et ne s’applique qu’au terme en cours après ce délai. Vous pouvez résilier d’ici là.',
    ],
  },
  {
    titre: 'Durée, reconduction et résiliation',
    corps: [
      'Un abonnement est mensuel et sans engagement. Il se reconduit de mois en mois tant que vous ne l’arrêtez pas.',
      'Vous pouvez résilier à tout moment depuis votre espace, en un geste, sans motif et sans frais. La résiliation prend effet au terme du mois déjà payé : vous gardez la formule jusque-là.',
    ],
  },
  {
    titre: 'Droit de rétractation et remboursement',
    ancre: 'remboursement',
    corps: [
      'Vous disposez de quatorze jours pour vous rétracter d’un abonnement, sans avoir à vous justifier (article L221-18 du code de la consommation).',
      'Ce service étant fourni immédiatement, vous êtes invité, au moment de souscrire, à demander expressément son exécution avant la fin de ce délai. En le faisant, vous reconnaissez perdre votre droit de rétractation une fois le service pleinement exécuté (article L221-25). Si vous préférez le conserver, attendez quatorze jours avant de vous en servir : personne ne vous en empêchera.',
      'Pour vous rétracter, il suffit de l’écrire à l’adresse de contact des mentions légales. Le remboursement intervient dans les quatorze jours, par le moyen de paiement employé.',
    ],
  },
  {
    titre: 'Ce que nous garantissons, et ce que nous ne garantissons pas',
    corps: [
      'Nous nous engageons à tenir le service disponible et à jour, et à corriger ce qui ne marche pas. Les textes officiels joints aux réponses sont ceux du fonds LEGI de la DILA, à la date d’arrêté affichée sur l’accueil.',
      'Nous ne garantissons pas que l’information donnée s’applique à votre situation, qu’elle soit à jour du dernier revirement de jurisprudence, ni qu’une démarche entreprise sur sa foi aboutisse. Un modèle de courrier est un modèle : il vous revient de le lire, de l’adapter et de vérifier les délais avant de l’envoyer.',
      'Notre responsabilité ne peut être engagée au-delà des sommes que vous nous avez versées au cours des douze derniers mois. Rien dans ces conditions ne limite notre responsabilité en cas de faute lourde ou de dommage corporel.',
    ],
  },
  {
    titre: 'Vos obligations',
    corps: [
      'Un compte est personnel. Vous répondez de ce qui est fait avec le vôtre, et de l’exactitude de ce que vous déclarez.',
      'Il est interdit de revendre ou de rediffuser les réponses comme si elles constituaient une consultation juridique, et d’employer le service pour ce qui est illicite.',
      'Un usage manifestement automatisé ou destiné à saturer le service peut entraîner la suspension du compte, après un avertissement lorsque c’est possible.',
    ],
  },
  {
    titre: 'Réclamation et médiation',
    corps: [
      'Adressez d’abord votre réclamation à l’adresse de contact des mentions légales : la plupart se règlent là.',
      'À défaut d’accord sous deux mois, vous pouvez saisir gratuitement le médiateur de la consommation dont les coordonnées figurent dans les mentions légales, ou la plateforme européenne de règlement en ligne des litiges.',
      'Le droit français s’applique. À défaut d’accord amiable, les tribunaux compétents sont ceux désignés par la loi ; en tant que consommateur, vous pouvez saisir celui de votre domicile.',
    ],
  },
];
