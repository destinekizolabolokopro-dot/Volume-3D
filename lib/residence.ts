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

/* ============================================================== atrium === */

/**
 * L'atrium.
 *
 * Un puits de huit mètres sur neuf, ouvert du plafond du hall jusqu'à la
 * verrière, avec une coursive de desserte à chaque niveau. Il n'est pas là
 * pour faire joli : c'est **le seul moyen de monter**. Le vol devait conduire
 * jusqu'à un appartement, et une caméra qui traverse onze planchers en ligne
 * droite traverse onze planchers — on le voit, et on ne voit que cela.
 *
 * C'est aussi une typologie qui existe : les résidences de ce standing
 * desservent souvent leurs logements par une galerie sur vide, précisément
 * parce que cela remplace un couloir aveugle par de la lumière du jour.
 *
 * Il coûte sa surface, et ce fichier la déduit : voir `surfacePlancher`.
 */
export const ATRIUM = {
  x0: -13,
  x1: -5,
  z0: -3.6,
  z1: 5.4,
  /** Profondeur des coursives, prises dans le vide sur ses deux longs côtés. */
  coursive: 1.6,
} as const;

/* ========================================================= appartement === */

/**
 * Le séjour où le vol se termine, au cinquième niveau.
 *
 * Cinquième, et pas un autre : c'est là que se produit le premier redan, donc
 * le seul niveau qui dispose d'une terrasse de cinq mètres quarante sur toute
 * sa longueur. Un appartement d'angle sans terrasse aurait été un séjour avec
 * une fenêtre ; celui-ci a un dehors, et le dernier plan de la page le
 * traverse du regard.
 */
export const APPARTEMENT = {
  niveau: 5,
  /** Emprise du séjour modélisé, dans le repère du bâtiment. */
  x0: -1.2,
  x1: 10.6,
  z0: -5.6,
  z1: 5.6,
  /** Hauteur sous plafond. */
  haut: 3.0,
  /** Demi-largeur de l'entrée depuis la coursive. */
  entree: 1.8,
} as const;

/** Altitude du plancher brut du niveau `n`, en mètres. */
export function altitudeNiveau(n: number): number {
  return SOCLE + 0.25 + n * ETAGE;
}

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
  /**
   * La section de la page sur laquelle cette étape se cale.
   *
   * Les `t` écrits ci-dessous sont un **repli**, pas une vérité : la vraie
   * position d'une section dépend de la longueur de son texte, de la largeur
   * de l'écran et de la taille de la fonte, c'est-à-dire de trois choses
   * qu'aucun nombre écrit ici ne peut connaître. Elle est donc relevée dans le
   * document au montage, et à chaque changement de forme de la page.
   *
   * Ce n'est pas une précaution théorique : la première version calait ses
   * fractions à la main, et ajouter deux sections a suffi pour que l'arrêt de
   * l'atrium tombe quinze pour cent trop loin — on arrivait dans la verrière
   * au lieu du puits.
   */
  ancre?: string;
  /** Décalage depuis le haut de l'ancre, en hauteurs d'écran. */
  ecran?: number;
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
  { t: 0.0, ancre: '#top', oeil: [126, 76, 104], vise: [0, 30, 0], foyer: 32, pan: 11 },
  /* Le projet. On descend et on se rapproche, sans changer d'angle. */
  { t: 0.11, ancre: '#projet', oeil: [104, 56, 88], vise: [0, 28, 0], foyer: 31, pan: 8 },
  /* L'architecture. Mi-hauteur : c'est de là que les redans se lisent le
     mieux, et la section parle d'eux. */
  { t: 0.22, ancre: '#architecture', oeil: [82, 38, 70], vise: [0, 25, 0], foyer: 30, pan: 6 },
  /* Galerie I — l'approche. On arrive à hauteur d'arbre au-dessus du parvis. */
  { t: 0.33, ancre: '#galerie', oeil: [58, 14, 48], vise: [0, 23, 0], foyer: 34, pan: 5 },
  /* Galerie II — le pied. Contre-plongée au ras du socle, foyer court : les
     verticales fuient, et c'est le seul endroit de la page où on le veut. */
  { t: 0.44, ancre: '#galerie', ecran: 1, oeil: [42, 6.5, 23], vise: [4, 19, 0], foyer: 44, pan: 3 },
  /* Galerie III — le seuil. La marquise passe au-dessus de l'objectif. */
  { t: 0.55, ancre: '#galerie', ecran: 2, oeil: [26, 2.7, 8], vise: [12, 4.4, 1.5], foyer: 46 },
  /* Transit : on franchit les portes. Les colonnes défilent de part et
     d'autre, et c'est ce défilement latéral qui donne sa vitesse au plan. */
  { t: 0.61, oeil: [11, 2.5, 1.2], vise: [-6, 3.4, 1.0], foyer: 45 },
  /* Le hall. On s'arrête au milieu de la pièce, sous le vide de l'atrium. */
  { t: 0.66, ancre: '#hall', oeil: [-1.5, 2.45, 1.0], vise: [-11.5, 3.3, 1.6], foyer: 44 },
  /* Transit : on gagne le pied du puits et on lève les yeux. */
  { t: 0.72, oeil: [-10.6, 2.6, -1.8], vise: [-8.4, 12, 1.4], foyer: 52 },
  /*
   * La montée.
   *
   * C'est le seul plan de la page qui monte, et il demande une précaution que
   * rien n'annonce : **on ne vise jamais la verticale exacte.** Un regard
   * parfaitement vertical rend le calcul d'orientation dégénéré — la caméra
   * n'a plus de haut, et l'image se met à tourner sur elle-même au moindre
   * centième de degré. On monte donc en regardant devant soi et vers le haut,
   * ce qui est de toute façon le geste juste : une caméra qui fixe le plafond
   * ne raconte pas une ascension, elle raconte une chute.
   *
   * On monte aussi **en diagonale**, d'un angle du puits vers l'angle opposé,
   * et pas dans son axe. Dans l'axe, la caméra a un mur plat devant elle et
   * les deux volées de coursives hors du cadre, de part et d'autre : c'est
   * exactement l'image qu'a donnée la première version, et elle ne montrait
   * rien. En diagonale, les deux volées convergent dans la profondeur.
   */
  { t: 0.77, ancre: '#atrium', oeil: [-11.6, 8.5, -1.4], vise: [-6.4, 22, 3.4], foyer: 50 },
  /* Transit : on sort du puits au cinquième et on passe au-dessus de la
     coursive. */
  { t: 0.85, oeil: [-6.4, 24.8, 0.8], vise: [1, 25.1, 0.4], foyer: 44 },
  /* Le séjour : debout dans la pièce, à hauteur d'œil et **à l'horizontale**.
     Viser plus bas que soi remplit le cadre de parquet ; dans une pièce de
     trois mètres sous plafond, une caméra qui pique du nez de deux degrés perd
     le plafond, et une pièce sans plafond n'est plus une pièce. */
  { t: 0.9, ancre: '#sejour', oeil: [1.0, 25.4, 2.4], vise: [12.8, 25.2, -1.0], foyer: 42 },
  /* L'appel final. On a avancé de quatre mètres vers la baie : la terrasse
     entre dans le cadre et la page se termine sur l'horizon. */
  { t: 1.0, ancre: '#contact', oeil: [5.4, 25.35, 1.4], vise: [16.4, 25.1, -1.8], foyer: 46 },
];

/* =============================================================== mesures === */

/**
 * Surface de plancher, tous niveaux courants confondus, **atrium déduit**.
 *
 * La déduction n'est pas une coquetterie comptable : le puits traverse les
 * douze niveaux, et une page qui annonce six mille six cent quarante-huit
 * mètres carrés au-dessus d'une image où l'on voit le vide de part en part
 * annonce une surface qu'elle montre en train de ne pas exister.
 */
export function surfacePlancher(): number {
  const vide = (ATRIUM.x1 - ATRIUM.x0) * (ATRIUM.z1 - ATRIUM.z0);
  let total = 0;
  for (let n = 0; n < NIVEAUX; n += 1) {
    const e = empreinte(n);
    total += e.hx * 2 * (e.hz * 2) - vide;
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

/**
 * Tout le texte du projet, en français.
 *
 * Il l'était en anglais, et c'était une erreur d'appréciation : Volume3D vend
 * à des propriétaires et à des conciergeries francophones, et une page de
 * démonstration qui parle une autre langue que ses clients démontre surtout
 * qu'on ne leur parle pas.
 *
 * Sur la forme, le texte a changé de nature autant que de langue. Il tenait en
 * paragraphes ; il tient maintenant en **fiches** — une clé, une valeur — et
 * en phrases courtes. La raison n'est pas typographique : derrière ce texte il
 * y a un bâtiment, et un pavé de six lignes posé au milieu de l'écran le
 * cache. Une fiche de trois lignes en bord de cadre informe autant et ne cache
 * rien.
 */

export interface Fait {
  cle: string;
  valeur: string;
}

/** Un des trois grands chiffres du projet. */
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

/** Une section de texte : un surtitre, un titre coupé à la main, des fiches. */
export interface Section {
  surtitre: string;
  titre: readonly string[];
  chapeau?: string;
  faits: readonly Fait[];
}

export const PROJET = {
  nom: 'ORIEL',
  lieu: 'Rive gauche — îlot 14',
  /* La coupure est portée par le texte et non par la largeur du bloc : une
     ligne qui se casse toute seule se casse ailleurs sur chaque écran. */
  titre: ['Une résidence', 'qui se mesure.'],
  chapo:
    'Douze niveaux de béton et de verre, trois fois en retrait, posés sur un jardin d’eau.',
  action: 'Découvrir',
} as const;

export const NAVIGATION: { href: string; label: string }[] = [
  { href: '#projet', label: 'Le projet' },
  { href: '#architecture', label: 'Architecture' },
  { href: '#hall', label: 'Le hall' },
  { href: '#contact', label: 'Contact' },
];

export const PRESENTATION: Section = {
  surtitre: 'Le projet',
  titre: ['Un immeuble', 'qui compte ses étages.'],
  chapeau:
    'Chaque nez de dalle déborde de vingt centimètres sur le vitrage qu’il couronne. Au soleil rasant, chacun porte son ombre sur l’étage du dessous.',
  faits: [
    { cle: 'Emprise', valeur: '32,4 × 21,6 m' },
    { cle: 'Trame de façade', valeur: '1,80 m' },
    { cle: 'Hauteur d’étage', valeur: '3,55 m' },
  ],
};

export const ARCHITECTURE: { surtitre: string; titre: readonly string[]; traits: Trait[] } = {
  surtitre: 'Architecture',
  titre: ['Quatre décisions,', 'le reste en découle.'],
  traits: [
    {
      numero: '01',
      titre: 'Une trame de 1,80 m',
      texte: 'Meneaux, travées et redans tombent tous sur le même module.',
    },
    {
      numero: '02',
      titre: 'Trois redans',
      texte: 'La masse se retire trois fois du même côté. Chaque retrait laisse une terrasse.',
    },
    {
      numero: '03',
      titre: 'Vitrage en retrait de 20 cm',
      texte: 'À fleur, la façade est un aplat. En retrait, chaque étage porte son ombre.',
    },
    {
      numero: '04',
      titre: 'Un socle, pas un soubassement',
      texte: 'Deux niveaux plus larges que la tour, et une retombée profonde au-dessus.',
    },
  ],
};

export const GALERIE: { surtitre: string; vues: Vue[] } = {
  surtitre: 'Galerie',
  vues: [
    {
      titre: 'L’approche',
      texte: 'On descend sur le parvis, là où la masse se lit encore entière.',
    },
    {
      titre: 'Le pied',
      texte: 'Au ras du socle, la hauteur se lit le long des nez de dalle.',
    },
    {
      titre: 'Le seuil',
      texte: 'Sous la marquise, aux portes. D’ici la caméra ne s’arrête pas : elle entre.',
    },
  ],
};

export const HALL_TEXTE: Section = {
  surtitre: 'Le hall',
  titre: ['Cinq mètres quarante', 'sous plafond.'],
  chapeau:
    'Un hall d’immeuble se mesure à sa hauteur libre bien avant sa surface. Celui-ci est traversant, en pierre claire, et ouvert sur le vide de l’atrium.',
  faits: [
    { cle: 'Surface', valeur: '303 m²' },
    { cle: 'Hauteur libre', valeur: '5,43 m' },
    { cle: 'Portes', valeur: '8,00 m de large' },
  ],
};

export const ATRIUM_TEXTE: Section = {
  surtitre: 'L’atrium',
  titre: ['Un puits de lumière', 'sur toute la hauteur.'],
  chapeau:
    'Huit mètres sur neuf, ouverts du hall à la verrière. Les logements se desservent par coursive : un couloir aveugle en moins, douze niveaux de jour en plus.',
  faits: [
    { cle: 'Section du vide', valeur: '8 × 9 m' },
    { cle: 'Coursives', valeur: '1,60 m de large' },
    { cle: 'Verrière', valeur: 'au 12ᵉ' },
  ],
};

export const SEJOUR: Section = {
  surtitre: 'Le séjour',
  titre: ['Cinquième niveau,', 'terrasse plein sud.'],
  chapeau:
    'Le premier redan dégage cinq mètres quarante de terrasse sur toute la longueur. C’est là que le vol s’arrête.',
  faits: [
    { cle: 'Séjour', valeur: '132 m²' },
    { cle: 'Terrasse', valeur: '5,40 m de profondeur' },
    { cle: 'Baie', valeur: 'toute hauteur' },
  ],
};

export const APPEL = {
  surtitre: 'Contact',
  titre: ['Votre bien,', 'reconstruit en volume.'],
  texte:
    'Envoyez un plan, une surface, ou rien du tout. On modélise le volume, on l’éclaire, et on rend un lien que vos visiteurs traversent.',
  action: 'Nous écrire',
} as const;

/** Les trois chiffres du projet, mesurés sur la géométrie. */
export function chiffres(): Chiffre[] {
  return [
    {
      valeur: String(logements()),
      libelle: 'Logements',
      precision: `${Math.round(surfacePlancher()).toLocaleString('fr-FR')} m² de plancher`,
    },
    {
      valeur: String(NIVEAUX),
      libelle: 'Niveaux',
      precision: `${hauteurHorsTout().toFixed(1).replace('.', ',')} m à l’acrotère`,
    },
    {
      valeur: '2028',
      libelle: 'Livraison',
      precision: `${terrasses()} terrasses, une par redan`,
    },
  ];
}
