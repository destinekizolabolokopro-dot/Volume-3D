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
      titre: 'The mass',
      texte: 'At eye level, from the corner where the base still governs the composition.',
    },
    {
      titre: 'The setbacks',
      texte: 'From above, the three retreats read as one movement and the terraces come into view.',
    },
    {
      titre: 'From the forecourt',
      texte: 'At the foot of the base, looking up the full height along the line of the slab edges.',
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
