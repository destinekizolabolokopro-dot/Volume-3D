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

export const HERO = {
  eyebrow: 'Pour propriétaires & conciergeries Airbnb',
  headline: 'Une visite 3D qui transforme les curieux en réservations',
  lede: "Nous venons scanner votre logement en 20 minutes. Vous recevez une visite 3D interactive, prête à intégrer dans votre annonce.",
  stats: [
    { value: '20 min', label: 'Sur place, une seule fois' },
    { value: '48h', label: 'Livraison du lien' },
    { value: '1 lien', label: 'Intégrable partout' },
  ],
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
    letter: 'A',
    title: 'Plus de réservations',
    desc: 'Les voyageurs qui se projettent réservent plus vite et annulent moins.',
  },
  {
    letter: 'B',
    title: 'Moins de questions',
    desc: "La visite répond à l'avance aux questions sur l'agencement, la taille, la luminosité.",
  },
  {
    letter: 'C',
    title: 'Une annonce qui se démarque',
    desc: 'Rares sont les annonces avec une visite 3D — la vôtre sort du lot immédiatement.',
  },
  {
    letter: 'D',
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
