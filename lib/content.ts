/**
 * Contenu de la landing, centralisé pour être modifiable sans toucher au JSX.
 *
 * Note sur la promesse commerciale : le prototype disait « vous envoyez vos
 * photos, zéro contrainte ». Techniquement, une visite 3D exploitable exige une
 * capture continue avec recouvrement — les photos d'une annonce existante ne
 * suffisent pas. La promesse a donc été alignée sur ce qui est livrable :
 * un déplacement court, sans contrainte pour le propriétaire.
 */

export const PRICE_PER_LISTING = process.env.NEXT_PUBLIC_PRICE ?? '89€';
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'scan@volume3d.fr';

/**
 * Le titre du héros est découpé en lignes : chacune monte derrière son propre
 * masque, comme un générique. Le découpage est donc éditorial, pas automatique.
 */
export const HERO = {
  eyebrow: 'Propriétaires & conciergeries — France entière',
  lines: ['Franchir la porte', 'avant même', 'd’avoir réservé.'],
  /** Ligne mise en italique accentué (index dans `lines`). */
  accentLine: 1,
  lede: "Nous scannons votre logement en vingt minutes. Vos voyageurs le parcourent ensuite pièce par pièce, depuis leur téléphone — et réservent sans hésiter.",
  stats: [
    { value: 20, suffix: ' min', label: 'Sur place, une fois' },
    { value: 48, suffix: ' h', label: 'Avant livraison' },
    { value: 1, suffix: ' lien', label: 'À partager partout' },
  ],
};

/** Phrase de respiration entre le héros et la démonstration. */
export const MANIFESTO = {
  before: 'Une annonce montre des photos. Une visite donne une ',
  accent: 'impression',
  after: ' — celle d’être déjà arrivé.',
  sign: 'Volume3D — visites 3D pour la location courte durée',
};

export const STEPS = [
  {
    n: '01',
    title: 'On convient d’un créneau',
    desc: "Vingt minutes suffisent pour un T2. Vous n’avez rien à préparer d’autre qu’un logement rangé, comme pour une arrivée voyageur.",
  },
  {
    n: '02',
    title: 'On scanne, puis on modélise',
    desc: "Capture 360° pièce par pièce sur place, puis assemblage en une visite fluide et navigable de votre logement.",
  },
  {
    n: '03',
    title: 'Vous recevez le lien',
    desc: "Un lien de visite prêt à partager avec vos voyageurs, à intégrer sur votre site ou vos annonces, sous 48h.",
  },
];

export const VALUE_PROPS = [
  {
    title: 'Plus de réservations',
    desc: 'Les voyageurs qui se projettent réservent plus vite et annulent moins.',
  },
  {
    title: 'Moins de questions',
    desc: "La visite répond à l'avance aux questions sur l'agencement, la taille, la luminosité.",
  },
  {
    title: 'Une annonce qui se démarque',
    desc: 'Rares sont les annonces avec une visite 3D — la vôtre sort du lot immédiatement.',
  },
  {
    title: 'Zéro contrainte',
    desc: "Un seul rendez-vous court, aucun matériel à acheter, aucune manipulation de votre côté.",
  },
];

export const OWNER_FEATURES = [
  'Scan complet sur place, sans préparation',
  'Lien de visite interactif et illimité',
  'Livraison sous 48h',
  'Partageable en message, site perso, Booking',
];

export const AGENCY_FEATURES = [
  'Tarif dégressif dès 3 logements',
  'Planification des scans groupée',
  'Interlocuteur dédié',
  'Renouvellement périodique possible',
];

/**
 * Objections réellement entendues en démarchage. Y répondre sur la page évite
 * un aller-retour par mail et lève les freins avant la prise de rendez-vous.
 */
export const FAQ = [
  {
    q: 'Je peux mettre le lien directement dans mon annonce Airbnb ?',
    a: "Airbnb filtre les liens externes dans les titres et descriptions : il y a de bonnes chances qu’il soit retiré. En revanche il fonctionne parfaitement dans la messagerie avec vos voyageurs, sur votre site personnel, sur Booking ou Abritel, en QR code dans le logement, et dans vos emails de confirmation. C’est là qu’il convertit le mieux, au moment où le voyageur hésite.",
  },
  {
    q: 'Combien de temps chez moi, et que dois-je préparer ?',
    a: "Vingt minutes pour un T2, une petite heure pour une grande maison. Rangez comme pour une arrivée voyageur, ouvrez les volets, c’est tout. Vous n’avez ni matériel à acheter ni logiciel à installer, et vous n’avez pas besoin de rester à côté de nous.",
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
    a: "Oui, c’est même là que la majorité de vos voyageurs la regarderont. La visite se manipule au doigt, s’ouvre en plein écran, et ne demande aucune application.",
  },
  {
    q: 'Vous couvrez ma région ?',
    a: "France entière. Selon l’éloignement, on regroupe plusieurs logements sur une même tournée — dites-nous simplement où se trouve le vôtre.",
  },
];
