/**
 * Contenu de la page publique, centralisé pour être modifiable sans toucher au JSX.
 *
 * Le lecteur visé est le propriétaire qui loue son logement, pas le voyageur
 * qui le réserve : chaque phrase doit lui dire ce que l'outil change pour lui.
 *
 * Note sur la promesse commerciale : le prototype disait « vous envoyez vos
 * photos, zéro contrainte ». Techniquement, une visite exploitable exige une
 * capture continue avec recouvrement — les photos d'une annonce existante ne
 * suffisent pas. La promesse est donc alignée sur ce qui est livrable : un
 * déplacement court, sans contrainte pour le propriétaire.
 */

/*
 * Le prix, en un seul endroit.
 *
 * L'espace insécable avant l'euro n'est pas une coquetterie : en français,
 * l'unité se sépare du nombre, et « 89€ » collé se lit comme une faute — sur
 * une page de tarifs, c'est-à-dire à l'endroit exact où le lecteur décide s'il
 * a affaire à quelqu'un de sérieux. Insécable pour que le montant ne se coupe
 * jamais en fin de ligne.
 *
 * L'espace est posé ici et non dans la variable d'environnement, et c'est le
 * point important : le montant vient de `NEXT_PUBLIC_PRICE`, donc d'un fichier
 * `.env` recopié à chaque déploiement. Une règle typographique qui dépend de
 * la façon dont quelqu'un a tapé une ligne de configuration n'est pas une
 * règle. Le premier essai corrigeait la valeur par défaut du code : elle
 * n'était jamais lue, `.env.local` définissant déjà le prix, et l'espace
 * n'apparaissait nulle part.
 */
const PRIX_BRUT = process.env.NEXT_PUBLIC_PRICE ?? '89€';
export const PRICE_PER_LISTING = PRIX_BRUT.replace(/\s*€/u, '\u00a0€');

/**
 * Ce que dit chaque formule, à l'inscription comme dans le compte.
 *
 * Deux problèmes réglés ici, et le premier était grave.
 *
 * **Les formules se vendaient à l'abonnement.** « 29 € /mois », « 79 € /mois »
 * — alors que la page d'accueil promet en trois endroits le contraire : « Payé
 * une fois. Le lien reste en ligne », « Pas d'abonnement, pas de frais
 * d'hébergement, pas d'engagement », et dans les questions fréquentes « le prix
 * est payé une fois, le lien reste actif ». Un propriétaire qui lit la page
 * d'accueil puis crée son compte tombait sur un loyer mensuel. Ce n'est pas une
 * incohérence de rédaction : c'est la promesse commerciale du produit qui était
 * démentie à l'endroit exact où le client s'engage.
 *
 * Les formules restent — elles plafonnent le nombre de biens d'un compte, ce
 * qui est une vraie distinction — mais elles se disent au tarif du site : payé
 * une fois, par logement.
 *
 * `price` ne porte que le montant, et l'unité descend dans `note` : la carte
 * d'une formule est étroite, et « 89 € par logement » rendu dans le corps du
 * montant s'y coupait sur trois lignes.
 *
 * **La liste vivait en double**, recopiée dans le formulaire d'inscription et
 * dans la page de compte. Deux copies d'un tarif finissent toujours par
 * diverger, et c'est d'ailleurs par là que la contradiction était entrée.
 */
export const PLAN_OFFERS: Array<{ id: string; name: string; price: string; note: string }> = [
  {
    id: 'essentiel',
    name: 'Essentiel',
    price: PRICE_PER_LISTING,
    note: 'Par logement, payé une fois. Un logement. Visite 360°, vidéo et plan 3D, assistant inclus.',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: PRICE_PER_LISTING,
    note: 'Par logement, dégressif dès le troisième. Jusqu’à cinq logements, statistiques détaillées.',
  },
  {
    id: 'conciergerie',
    name: 'Conciergerie',
    price: 'Sur devis',
    note: 'Logements illimités, scans groupés sur une même tournée, interlocuteur dédié.',
  },
];
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'scan@volume3d.fr';

export const HERO = {
  eyebrow: 'Propriétaires et conciergeries · France entière',
  headline: 'Vos voyageurs visitent le logement avant de réserver.',
  lede: "On vient scanner votre logement en vingt minutes. Vous recevez un lien de visite à envoyer à vos voyageurs : ils parcourent chaque pièce, se projettent, et réservent sans vous poser dix questions.",
  facts: ['20 minutes sur place', 'Lien livré sous 48 h', 'Payé une fois, sans abonnement'],
};

/** Ce que la visite change concrètement pour le propriétaire. */
export const RESULTS = [
  {
    icon: 'calendar',
    title: 'Des réservations plus rapides',
    desc: 'Un voyageur qui a vu le volume, la lumière et l’agencement décide tout de suite. Il ne repousse pas au lendemain.',
  },
  {
    icon: 'chat',
    title: 'Moins de messages à traiter',
    desc: 'La visite répond d’avance aux questions sur la taille des pièces, le lit, la cuisine, l’étage. Vous récupérez vos soirées.',
  },
  {
    icon: 'shield',
    title: 'Moins de mauvaises surprises',
    desc: 'Le logement est vu tel qu’il est. Moins d’attentes déçues à l’arrivée, donc moins de litiges et de commentaires tièdes.',
  },
  {
    icon: 'star',
    title: 'Une annonce qui se distingue',
    desc: 'Presque aucune annonce ne propose de visite. La vôtre inspire confiance avant même le premier message.',
  },
];

/** Comparatif factuel, sans emphase : ce que voit le voyageur dans les deux cas. */
export const COMPARE = {
  before: {
    title: 'Avec des photos seules',
    items: [
      'Vingt photos cadrées au grand-angle, dans un ordre subi',
      'Le voyageur reconstruit le logement dans sa tête',
      'Des questions par message avant de réserver',
      'Des attentes parfois décalées à l’arrivée',
    ],
  },
  after: {
    title: 'Avec la visite Volume3D',
    items: [
      'Il regarde autour de lui, pièce par pièce, à son rythme',
      'Il mesure le volume et la lumière en quelques secondes',
      'Il a sa réponse sans vous écrire',
      'Il arrive dans le logement qu’il a vu',
    ],
  },
};

export const STEPS = [
  {
    n: '01',
    title: 'On convient d’un créneau',
    desc: "Vingt minutes suffisent pour un T2. Vous n'avez rien à préparer d'autre qu'un logement rangé, comme pour une arrivée voyageur.",
  },
  {
    n: '02',
    title: 'On scanne sur place',
    desc: 'Capture 360° pièce par pièce, puis assemblage en une visite fluide où l’on passe d’une pièce à l’autre.',
  },
  {
    n: '03',
    title: 'Vous recevez le lien',
    desc: 'Un lien prêt à envoyer à vos voyageurs, à mettre sur votre site ou en QR code dans le logement. Sous 48 h.',
  },
];

export const OWNER_FEATURES = [
  'Scan complet sur place, sans préparation',
  'Lien de visite illimité, hébergement compris',
  'Livraison sous 48 h',
  'Assistant qui répond aux questions de vos voyageurs',
];

export const AGENCY_FEATURES = [
  'Tarif dégressif dès 3 logements',
  'Scans groupés sur une même tournée',
  'Espace unique pour tout votre parc',
  'Interlocuteur dédié',
];

/**
 * Objections réellement entendues en démarchage. Y répondre sur la page évite
 * un aller-retour par mail et lève les freins avant la prise de rendez-vous.
 */
export const FAQ = [
  {
    q: 'Je peux mettre le lien directement dans mon annonce Airbnb ?',
    a: "Airbnb filtre les liens externes dans les titres et descriptions : il y a de bonnes chances qu'il soit retiré. En revanche il fonctionne parfaitement dans la messagerie avec vos voyageurs, sur votre site personnel, sur Booking ou Abritel, en QR code dans le logement, et dans vos emails de confirmation. C'est là qu'il convertit le mieux, au moment où le voyageur hésite.",
  },
  {
    q: 'Combien de temps chez moi, et que dois-je préparer ?',
    a: "Vingt minutes pour un T2, une petite heure pour une grande maison. Rangez comme pour une arrivée voyageur, ouvrez les volets, c'est tout. Vous n'avez ni matériel à acheter ni logiciel à installer, et vous n'avez pas besoin de rester à côté de nous.",
  },
  {
    q: 'Et si mon logement est loué toute l’année ?',
    a: "On intervient entre deux séjours, pendant le créneau de ménage. Si vous passez par une conciergerie, on se cale directement avec elle.",
  },
  {
    q: 'La visite reste en ligne combien de temps ?',
    a: "Sans limite, et sans abonnement. Le prix est payé une fois, le lien reste actif. Si vous refaites la déco ou changez de mobilier, on repasse pour une mise à jour à tarif réduit.",
  },
  {
    q: 'Ça marche sur téléphone ?',
    a: "Oui, c'est même là que la majorité de vos voyageurs la regarderont. La visite se manipule au doigt, s'ouvre en plein écran, et ne demande aucune application.",
  },
  {
    q: 'Vous couvrez ma région ?',
    a: "France entière. Selon l'éloignement, on regroupe plusieurs logements sur une même tournée — dites-nous simplement où se trouve le vôtre.",
  },
];
