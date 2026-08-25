/**
 * ORIEL — la résidence, ses cotes et son texte.
 *
 * Ce fichier ne dessine rien. Il tient **la trame du bâtiment** et **le texte
 * de la page**, pour une raison simple : les deux disent les mêmes nombres.
 * « Douze étages », « 6 648 m² », « cinquante-huit logements » ne sont pas des
 * chiffres d'agence tapés à la main dans une section « nos chiffres » — ce
 * sont des mesures de la géométrie que `components/three/edifice.ts` monte à
 * l'écran, calculées ici par la même fonction d'empreinte.
 *
 * C'est la seule façon d'éviter le défaut classique de ces pages : un compteur
 * qui annonce quarante-deux étages au-dessus d'une image qui en montre douze.
 * Personne ne compte les étages, mais tout le monde le sent.
 *
 * Sur la langue : le reste du site est en français, cette page est en anglais.
 * Ce n'est pas une inadvertance. C'est une page de démonstration — la vitrine
 * de ce que Volume3D sait rendre — adressée au marché où ce langage-là se
 * parle, celui des agences d'architecture et de la promotion haut de gamme.
 * Les identifiants restent français, comme partout ailleurs dans le dépôt.
 */

/* ================================================================= trame === */

/** Trame de façade. Tout se cale dessus : meneaux, largeurs, redans. */
export const TRAME = 1.8;
/** Hauteur d'étage, dalle à dalle. */
export const ETAGE = 3.55;
/** Nombre de niveaux courants au-dessus du socle. */
export const NIVEAUX = 12;
/** Épaisseur du nez de dalle vu de l'extérieur. */
export const NEZ = 0.42;
/** Le socle, une fois et demie plus haut qu'un étage courant. */
export const SOCLE = ETAGE * 1.6;
/** Retrait du bandeau vitré derrière le nez de dalle. */
export const RETRAIT = 0.2;

export interface Empreinte {
  /** Demi-largeur, en mètres. */
  hx: number;
  /** Demi-profondeur, en mètres. */
  hz: number;
  /** Décalage du centre sur l'axe des x : c'est lui qui fait le redan. */
  dx: number;
}

/**
 * Empreinte du niveau `n`.
 *
 * Trois redans successifs, tous du même côté, et c'est le sujet du bâtiment :
 * une masse qui s'allège en montant et dégage trois terrasses. Un empilement
 * constant donnerait une tour ; un empilement qui se retire donne une
 * silhouette, et une silhouette se reconnaît de loin.
 */
export function empreinte(niveau: number): Empreinte {
  if (niveau < 5) return { hx: 9 * TRAME, hz: 6 * TRAME, dx: 0 };
  if (niveau < 8) return { hx: 7.5 * TRAME, hz: 6 * TRAME, dx: -1.5 * TRAME };
  if (niveau < 11) return { hx: 6 * TRAME, hz: 5 * TRAME, dx: -3 * TRAME };
  return { hx: 4.5 * TRAME, hz: 4 * TRAME, dx: -4.5 * TRAME };
}

/* ================================================================= hall === */

/**
 * Le hall, en cotes.
 *
 * Le rez n'est pas seulement vu du dehors : le vol s'y termine. Ses cotes
 * servent donc à trois endroits — la géométrie qui le construit, la caméra qui
 * y entre, et le test qui vérifie que la caméra y est bien. D'où leur place
 * ici plutôt que dans le fichier de rendu.
 */
export const HALL = {
  /** Demi-largeur dans œuvre, en mètres. */
  hx: 9 * TRAME - TRAME / 2,
  /** Demi-profondeur dans œuvre. */
  hz: 6 * TRAME - TRAME / 2,
  /** Hauteur libre sous plafond. */
  haut: ETAGE * 1.6 - 0.25,
  /** Demi-largeur de la porte, sur la face +x. */
  porte: 4,
} as const;

/* ================================================================== vol === */

/**
 * Une étape du vol : où est l'œil, ce qu'il regarde, et avec quel foyer.
 *
 * Les cotes sont en mètres, dans le repère du bâtiment. C'est un changement de
 * nature par rapport à la première version de cette page, qui décrivait la
 * caméra en coordonnées sphériques — rayon, azimut, site autour d'un axe. Ce
 * vocabulaire-là ne sait dire qu'une chose : tourner autour. Il ne peut pas
 * exprimer « passer sous la marquise », encore moins « entrer ».
 */
export interface Etape {
  /** Position du curseur de défilement où cette étape est atteinte. */
  t: number;
  /** L'œil. */
  oeil: [number, number, number];
  /** Le point visé. */
  vise: [number, number, number];
  /** Champ vertical, en degrés. Un long foyer écrase, un court exagère. */
  foyer: number;
  /**
   * Panoramique, en degrés. Positif pousse le bâtiment vers la droite du cadre.
   *
   * C'est le seul réglage de la liste qui ne parle pas du bâtiment mais de la
   * **page**. Le titre du premier écran tient la moitié gauche du cadre ; sans
   * panoramique, le vol place la masse en plein dessous. Un cadreur ne recule
   * pas pour régler cela — il panote, et c'est bien un panoramique et non une
   * translation : la perspective ne change pas, seulement la place dans
   * l'image. Il s'annule à l'entrée : dans le hall, ce qu'on regarde est au
   * centre parce que c'est là qu'est le mur.
   */
  pan?: number;
}

/**
 * Le vol.
 *
 * Huit étapes, et une seule idée : **on avance, on ne tourne pas.** La caméra
 * part haut et loin, dans la brume de l'heure dorée où le bâtiment n'est
 * encore qu'une masse ; elle descend en se rapprochant, passe à hauteur
 * d'homme sur le parvis, s'engage sous la marquise, franchit les portes et
 * s'arrête dans le hall, devant le nom gravé sur le marbre.
 *
 * Deux choses qui ne se voient pas dans les nombres mais qui font tout :
 *
 *  · **les étapes se resserrent.** Cinquante mètres entre les deux premières,
 *    treize entre les deux dernières. Comme le paramètre avance linéairement
 *    d'une étape à l'autre, la caméra ralentit toute seule à mesure qu'elle
 *    approche — c'est ce que fait une caméra de publicité, et cela n'a coûté
 *    aucune courbe d'accélération : c'est la géométrie qui le donne ;
 *  · **le foyer s'ouvre en chemin,** de trente-deux à quarante-six degrés,
 *    puis se referme à trente-huit dans le hall. Un champ qui s'élargit pendant
 *    qu'on avance accentue la fuite des lignes : c'est l'effet Vertigo, dosé au
 *    quart de ce qu'il faudrait pour qu'on le remarque. Refermé à l'arrivée, il
 *    rend au hall ses proportions justes.
 *
 * Les valeurs de `t` suivent les sections de la page : 0 le premier écran,
 * 0,14 la présentation, 0,28 l'architecture, puis les trois écrans de la
 * galerie, les chiffres et l'appel final.
 */
export const VOL: Etape[] = [
  /* Premier écran. Vue aérienne : la brume mange une part du contraste et le
     bâtiment devient une masse dans la lumière. C'est l'image d'ouverture. */
  { t: 0.0, oeil: [126, 76, 104], vise: [0, 30, 0], foyer: 32, pan: 11 },
  /* La présentation. On descend et on se rapproche, sans changer d'angle. */
  { t: 0.14, oeil: [104, 56, 88], vise: [0, 28, 0], foyer: 31, pan: 8 },
  /* L'architecture. Mi-hauteur : c'est de là que les redans se lisent le
     mieux, et la section parle d'eux. */
  { t: 0.28, oeil: [82, 38, 70], vise: [0, 25, 0], foyer: 30, pan: 6 },
  /* Galerie I — l'approche. On arrive à hauteur d'arbre au-dessus du parvis. */
  { t: 0.43, oeil: [58, 14, 48], vise: [0, 23, 0], foyer: 34, pan: 5 },
  /* Galerie II — le pied. Contre-plongée au ras du socle, foyer court : les
     verticales fuient, et c'est le seul endroit de la page où on le veut. */
  { t: 0.57, oeil: [42, 6.5, 23], vise: [4, 19, 0], foyer: 44, pan: 3 },
  /* Galerie III — le seuil. La marquise passe au-dessus de l'objectif. */
  { t: 0.71, oeil: [26, 2.7, 8], vise: [12, 4.4, 1.5], foyer: 46 },
  /* Les chiffres. On franchit les portes ; les colonnes défilent de part et
     d'autre, et c'est ce défilement latéral qui donne sa vitesse au plan. */
  { t: 0.85, oeil: [14.2, 2.45, 1.8], vise: [-2, 3.7, 0.4], foyer: 44 },
  /* L'appel final, dans le hall. En biais, et pas de face : un mur pris
     d'équerre est un aplat, et on aurait traversé tout un bâtiment pour finir
     sur un panneau gris. En diagonale, le comptoir, les colonnes et le nom
     gravé se répartissent en profondeur. */
  { t: 1.0, oeil: [2.4, 2.3, 3.4], vise: [-15, 3.35, -2.4], foyer: 38 },
];

/* =============================================================== mesures === */

/** Surface de plancher hors œuvre, tous niveaux courants confondus. */
export function surfacePlancher(): number {
  let total = 0;
  for (let n = 0; n < NIVEAUX; n += 1) {
    const e = empreinte(n);
    total += e.hx * 2 * (e.hz * 2);
  }
  return total;
}

/** Hauteur hors tout, du parvis à l'arase du couronnement. */
export function hauteurHorsTout(): number {
  return SOCLE + 0.25 + NIVEAUX * ETAGE + 2.1;
}

/** Nombre de terrasses dégagées par les redans. */
export function terrasses(): number {
  let compte = 0;
  for (let n = 0; n + 1 < NIVEAUX; n += 1) {
    if (empreinte(n + 1).hx < empreinte(n).hx) compte += 1;
  }
  return compte;
}

/**
 * Nombre de logements.
 *
 * Deux ratios, et ils ne sont pas décoratifs : dix-huit pour cent de la
 * surface part en circulations, gaines et locaux communs — c'est la fourchette
 * basse d'un immeuble d'habitation à un seul noyau — et le logement moyen fait
 * cent dix mètres carrés, ce qui est la définition même du haut de gamme et
 * ce que la trame de 1,80 m permet de découper proprement.
 */
export function logements(): number {
  const utile = surfacePlancher() * 0.82;
  return Math.round(utile / 110);
}

/* ================================================================= texte === */

export interface Chiffre {
  valeur: string;
  libelle: string;
  precision: string;
}

export interface Trait {
  numero: string;
  titre: string;
  texte: string;
}

export interface Vue {
  titre: string;
  texte: string;
}

export const PROJET = {
  nom: 'ORIEL',
  lieu: 'Riverside — Plot 14',
  /* Le titre du brief, coupé là où il doit l'être : « Architecture that » puis
     « defines the future. ». La coupure est portée par le texte, pas par la
     largeur du bloc — une ligne qui se casse toute seule se casse ailleurs sur
     chaque écran. */
  titre: ['Architecture that', 'defines the future.'],
  chapo:
    'A twelve-storey residence of concrete and glass, set back three times as it rises, standing over a water garden.',
  action: 'Discover the project',
} as const;

export const NAVIGATION: { href: string; label: string }[] = [
  { href: '#project', label: 'Projects' },
  { href: '#architecture', label: 'Architecture' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
];

export const PRESENTATION = {
  surtitre: 'The project',
  titre: ['A building that counts', 'its own floors.'],
  paragraphes: [
    'Every slab edge projects two hundred millimetres beyond the glazing it crowns. At a low sun each one casts its shadow on the storey below, and the façade states its scale from a hundred metres away.',
    'Nothing here is photographed. The building is built — measured, framed, lit — and the page renders it live in your browser. It is the same engine that reconstructs an apartment for a listing, pointed outwards for once.',
  ],
} as const;

export const ARCHITECTURE: { surtitre: string; titre: readonly string[]; traits: Trait[] } = {
  surtitre: 'Architecture',
  titre: ['Four decisions,', 'and the rest follows.'],
  traits: [
    {
      numero: '01',
      titre: 'A 1.8 metre grid',
      texte:
        'Mullions, bay widths and setbacks all land on the same module. It is what keeps a glazed band from reading as a blank sheet.',
    },
    {
      numero: '02',
      titre: 'Three setbacks',
      texte:
        'The mass withdraws three times on the same side. Each retreat leaves a full-width terrace behind a glass balustrade.',
    },
    {
      numero: '03',
      titre: 'Glazing set back 200 mm',
      texte:
        'Flush glass makes a flat wall. Recessed, every floor carries its own line of shadow, and the building gains depth without gaining ornament.',
    },
    {
      numero: '04',
      titre: 'A base, not a plinth',
      texte:
        'Two levels wider than the tower, with a deep soffit above. A building that meets the ground without transition always looks dropped there.',
    },
  ],
};

export const GALERIE: { surtitre: string; vues: Vue[] } = {
  surtitre: 'Gallery',
  vues: [
    {
      titre: 'The approach',
      texte: 'Coming down over the forecourt, where the mass still reads whole against the evening.',
    },
    {
      titre: 'The base',
      texte: 'At the foot of the podium, looking up the full height along the line of the slab edges.',
    },
    {
      titre: 'The threshold',
      texte: 'Under the canopy, at the doors. From here the camera does not stop — it goes in.',
    },
  ],
};

export const APPEL = {
  surtitre: 'Contact',
  titre: ['Let’s build something', 'extraordinary.'],
  texte:
    'Send us a plan, a floor area, or nothing at all. We model the volume, light it, and hand back a link your visitors can walk through.',
  action: 'Contact',
} as const;

/** Les chiffres de la section 5, mesurés sur la géométrie. */
export function chiffres(): Chiffre[] {
  return [
    {
      valeur: String(logements()),
      libelle: 'Residences',
      precision: `${Math.round(surfacePlancher()).toLocaleString('en-GB')} m² of floor area`,
    },
    {
      valeur: String(NIVEAUX),
      libelle: 'Floors',
      precision: `${hauteurHorsTout().toFixed(1)} m to the parapet`,
    },
    {
      valeur: '2028',
      libelle: 'Completion',
      precision: `${terrasses()} terraces, one per setback`,
    },
  ];
}
