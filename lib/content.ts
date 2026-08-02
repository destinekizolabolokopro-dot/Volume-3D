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

export const PRICE_PER_LISTING = process.env.NEXT_PUBLIC_PRICE ?? '89€';
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
