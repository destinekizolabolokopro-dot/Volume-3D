/**
 * L'appartement du cinquième : cloisons, menuiseries, mobilier, lumière.
 *
 * Il vit dans son propre fichier parce qu'il a changé de statut. Tant que la
 * page faisait le tour de l'immeuble, il n'était qu'un plan du vol parmi neuf,
 * meublé de six volumes ; c'est maintenant **le sujet entier**, et la caméra
 * n'en sort qu'au dernier écran, pour la terrasse.
 *
 * Trois règles, et elles viennent toutes de la même contrainte — on regarde
 * ces pièces à deux mètres, pas à cent :
 *
 *  · **tout ce qui se voit de près est en volume.** Une plinthe, un plan de
 *    travail, une tête de lit, un tapis : ce sont des objets de dix
 *    centimètres qu'on ne remarque que s'ils manquent. À cent mètres on
 *    pouvait s'en passer ; à deux, leur absence est la première chose qui dit
 *    « image de synthèse » ;
 *  · **chaque pièce a sa lumière.** Pas une lampe centrale par pièce, mais une
 *    source basse et chaude posée là où il y en aurait une — près du canapé,
 *    au-dessus de l'îlot, sur une table de chevet. C'est ce décalage qui
 *    donne aux murs un dégradé au lieu d'un aplat ;
 *  · **rien n'est modélisé hors du champ.** Le reste du plateau du cinquième,
 *    les autres logements, les circulations : la caméra ne les voit jamais, ils
 *    n'existent pas. C'est ce qui paie les cloisons et le mobilier.
 */

import * as THREE from 'three';
import {
  BAIE,
  CLOISON,
  CLOISONS,
  PIECES,
  PORTE,
  SOL,
  SOUS_PLAFOND,
  TERRASSE,
  type Piece,
} from '@/lib/residence';

/** Ce que l'appartement emprunte à la scène qui l'accueille. */
export interface Atelier {
  pose(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    paint?: (px: number, py: number, pz: number) => number,
    maille?: number,
  ): void;
  materiaux: Palette;
  /** Vrai sur les machines faibles : on baisse la finesse des révolutions. */
  leger: boolean;
}

export interface Palette {
  parquet: THREE.Material;
  pierre: THREE.Material;
  marbre: THREE.Material;
  enduit: THREE.Material;
  soffite: THREE.Material;
  bois: THREE.Material;
  lin: THREE.Material;
  accent: THREE.Material;
  meneau: THREE.Material;
  vitrine: THREE.Material;
  garde: THREE.Material;
  lueur: THREE.Material;
  fut: THREE.Material;
  vegetal: THREE.Material;
  tronc: THREE.Material;
  metal: THREE.Material;
}

/** Épaisseur des cloisons de distribution. */
/** Hauteur des portes. */
/** Hauteur des plinthes. */
const PLINTHE = 0.11;

const PLAFOND = SOL + SOUS_PLAFOND;

/* Les bornes de l'appartement, déduites du plan plutôt que réécrites : deux
   listes de cotes qui divergent d'un centimètre font un mur qui ne joint pas. */
const X0 = Math.min(...Object.values(PIECES).map((p) => p.x0));
const X1 = Math.max(...Object.values(PIECES).map((p) => p.x1));
const Z0 = Math.min(...Object.values(PIECES).map((p) => p.z0));
const Z1 = Math.max(...Object.values(PIECES).map((p) => p.z1));

/* ========================================================== occlusion === */

/**
 * L'occlusion, cuite dans les sommets.
 *
 * C'est le seul défaut qui restait et le plus difficile à nommer : dans cet
 * appartement, un angle de mur recevait exactement autant de lumière que le
 * milieu de la pièce. La raison est mécanique — la seule lumière indirecte de
 * la scène est une carte d'environnement, et une carte d'environnement ne sait
 * pas qu'il y a un mur à dix centimètres. Aucun réglage d'exposition, aucune
 * matière, aucun cadrage ne rattrape cela : le rendu paraît « propre » et faux,
 * et personne ne sait dire pourquoi.
 *
 * On la calcule donc à la construction, une fois, et on l'écrit dans la
 * couleur des sommets. C'est ce que fait déjà `interior.ts` pour les visites
 * de logements, et c'est la technique la moins chère qui existe : elle ne
 * coûte rien à l'image, puisque tout est fait avant la première.
 *
 * Trois effets seulement, mais ce sont les trois qu'on voit :
 *
 *  · **la ligne d'ombre du sol.** Un mur s'assombrit sur ses trente derniers
 *    centimètres. C'est ce qui pose une pièce ;
 *  · **les angles verticaux.** Un mur s'assombrit à l'approche de celui qu'il
 *    rencontre ;
 *  · **les ombres de contact.** Un meuble noircit le sol autour de son pied.
 *    Sans elles, tout meuble flotte — et c'est le premier reproche qu'on fait
 *    à une image de synthèse sans savoir le formuler.
 */

/** Les lignes de murs, par axe : elles servent à assombrir les angles. */
const LIGNES_X = [-3.6, 0.6, 10.6];
const LIGNES_Z = [-1.4, 3.0, 6.6, 10.6];

/**
 * Les emprises au sol des meubles posés, pour l'ombre de contact.
 *
 * Elles sont écrites à la main et non déduites des volumes, et c'est un choix
 * assumé : tout ce qui est posé ne porte pas d'ombre de contact — un tapis n'en
 * a pas, un plateau de table sur pieds fins n'en a presque pas — et une
 * déduction automatique aurait noirci le sol sous chacun des cent quarante
 * pavés de cet appartement.
 */
const CONTACTS: [number, number, number, number, number][] = [
  [4.0, 4.95, 5.4, 9.3, 0.5],
  [4.95, 8.6, 5.4, 6.35, 0.5],
  [0.72, 1.18, 7.2, 10.2, 0.45],
  [4.6, 8.0, 1.1, 2.2, 0.5],
  [3.0, 9.2, -1.4, -0.74, 0.5],
  [0.72, 1.34, 0.2, 2.6, 0.45],
  // Le lit, tête à l'ouest, et le dressing sur le mur sud à l'ouest de la porte.
  [-3.4, -1.28, 7.55, 9.65, 0.5],
  [-3.4, -1.3, 6.72, 7.32, 0.45],
  [-3.3, -1.5, -1.2, -0.4, 0.4],
  [-3.6, -3.05, 0.9, 2.88, 0.4],
  /* La table basse et la table à manger : elles manquaient, et cela se voyait.
     Un plateau posé sur un tapis sans ombre au pied ne se pose pas dessus, il
     flotte au-dessus — c'est le seul indice de contact dont dispose une image
     dont les ombres portées viennent d'une carte réglée pour un quartier. */
  [5.9, 7.5, 7.2, 8.2, 0.42],
  [6.6, 9.4, 3.5, 4.8, 0.4],
];

/**
 * Le jour, cuit lui aussi.
 *
 * C'était le défaut restant, et le plus gros : la salle de bains, qui n'a pas
 * de fenêtre, recevait exactement autant de lumière que le séjour, qui en a
 * deux. La carte d'environnement éclaire toute la scène de la même façon —
 * elle ne sait pas qu'il y a une cloison entre une pièce et le ciel — et
 * aucune lampe ponctuelle ne rattrape cela, puisqu'elles éclairent aussi les
 * pièces déjà claires.
 *
 * On calcule donc, pour chaque sommet, **son exposition aux baies** : une
 * décroissance exponentielle sur la distance à la façade vitrée que sa pièce
 * touche. Une pièce aveugle ne reçoit que le fond ; l'entrée reçoit ce qui
 * passe par son ouverture ; le séjour, qui touche les deux façades, prend le
 * meilleur des deux.
 *
 * C'est ce dégradé-là qui fait qu'on croit à une pièce. Sans lui, un intérieur
 * a la lumière d'un studio photo — égale partout, donc venue de nulle part.
 */
function jourEn(x: number, _y: number, z: number): number {
  const est = Math.exp(-Math.max(0, PIECES.sejour.x1 - x) / 7.5);
  const nord = Math.exp(-Math.max(0, PIECES.sejour.z1 - z) / 6.5);
  const cloison = PIECES.entree.x1;

  let expose: number;
  if (x > cloison) {
    // Bande de jour : séjour et cuisine, sur une ou deux façades.
    expose = z > PIECES.sejour.z0 ? Math.max(est, nord) : est;
  } else if (z > PIECES.entree.z1) {
    // La chambre : la façade nord, et elle seule.
    expose = nord;
  } else if (z >= PIECES.entree.z0) {
    /* L'entrée : elle ne voit le jour que par son ouverture de 1,80 m. On
       mesure donc la distance à ce passage-là et non à une façade — c'est ce
       qui lui donne son dégradé transversal, du seuil éclairé vers le fond
       sombre. */
    const dx = Math.max(0, cloison - x);
    const dz = Math.max(0, Math.max(4.2 - z, z - 6.0));
    expose = 0.55 * Math.exp(-Math.hypot(dx, dz) / 3.2);
  } else {
    /* La salle de bains, aveugle : rien que le fond — mais un fond qu'on a
       relevé de six à douze pour cent, parce qu'elle a maintenant sa propre
       source. Ce qui suit n'est plus « ce que les murs se renvoient du jour »
       seulement, c'est aussi ce qu'un plafonnier laisse en permanence. */
    expose = 0.12;
  }
  /* Le fond n'est jamais nul : une pièce sans fenêtre n'est pas une cave, elle
     reçoit ce que les murs se renvoient. Quarante-huit pour cent, et l'écart
     avec le séjour reste d'un facteur deux — ce qui est déjà ce que mesure un
     posemètre entre une salle de bains et un salon d'angle. */
  /* Le fond remonte de quarante-huit à cinquante-six pour cent le jour où la
     lumière est passée de l'ambiance au soleil. Ce n'est pas un réglage
     d'humeur : le soleil n'entre que par les baies, donc tout ce qui ne les
     voit pas a perdu d'un coup ce que l'ambiance lui donnait. Le rapport entre
     le séjour et la salle de bains passe de deux à un et demi — ce qui reste
     l'écart que mesure un posemètre entre une pièce d'angle et une pièce
     aveugle allumée. */
  return 0.56 + 0.44 * Math.min(1, expose);
}

/** Assombrissement d'un mur : au ras du sol, sous le plafond, et dans les angles. */
function occlusionMur(selonZ: boolean, fixe: number) {
  const perpendiculaires = selonZ ? LIGNES_Z : LIGNES_X;
  return (x: number, y: number, z: number) => {
    const bas = 0.4 * Math.exp(-(y - SOL) / 0.3);
    const haut = 0.17 * Math.exp(-(PLAFOND - y) / 0.24);
    const le = selonZ ? z : x;
    let angle = 0;
    for (const ligne of perpendiculaires) {
      angle = Math.max(angle, 0.3 * Math.exp(-Math.abs(le - ligne) / 0.26));
    }
    void fixe;
    return Math.max(0.22, 1 - bas - haut - angle) * jourEn(x, y, z);
  };
}

/** Assombrissement d'un sol : contre les murs, et sous les meubles. */
function occlusionSol(x: number, _y: number, z: number): number {
  let mur = 0;
  for (const ligne of LIGNES_X) mur = Math.max(mur, 0.34 * Math.exp(-Math.abs(x - ligne) / 0.32));
  for (const ligne of LIGNES_Z) mur = Math.max(mur, 0.34 * Math.exp(-Math.abs(z - ligne) / 0.32));
  let pied = 0;
  for (const [x0, x1, z0, z1, force] of CONTACTS) {
    const dx = Math.max(x0 - x, 0, x - x1);
    const dz = Math.max(z0 - z, 0, z - z1);
    /* On garde le contact le plus fort et on ne les additionne pas : deux
       meubles voisins creuseraient sinon un trou noir entre eux. */
    pied = Math.max(pied, force * Math.exp(-Math.hypot(dx, dz) / 0.3));
  }
  return Math.max(0.24, 1 - Math.max(mur, pied)) * jourEn(x, _y, z);
}

/** Assombrissement d'un plafond : contre les murs, et un peu partout. */
function occlusionPlafond(x: number, _y: number, z: number): number {
  let mur = 0;
  for (const ligne of LIGNES_X) mur = Math.max(mur, 0.26 * Math.exp(-Math.abs(x - ligne) / 0.34));
  for (const ligne of LIGNES_Z) mur = Math.max(mur, 0.26 * Math.exp(-Math.abs(z - ligne) / 0.34));
  return Math.max(0.5, 1 - mur) * jourEn(x, _y, z);
}

/**
 * L'assombrissement d'un meuble.
 *
 * C'était le trou le plus large de l'éclairage, et le plus facile à ne pas
 * voir : les murs, les sols et le plafond recevaient une occlusion cuite dans
 * leurs sommets, et **le mobilier n'en recevait aucune**. Un caisson de
 * cuisine était donc éclairé exactement pareil sur son dessus, sur son flanc
 * et à dix centimètres du sol ; et une chaise de la salle de bains aveugle
 * était aussi claire que la même chaise dans le séjour d'angle.
 *
 * Deux termes, et le second compte autant que le premier :
 *
 *  - **le contact au sol**, qui donne à chaque meuble le dégradé sombre de son
 *    pied. C'est le signe le plus élémentaire qu'un objet est posé et non
 *    flottant, et aucune ombre portée de carte ne le rend à cette échelle ;
 *  - **le jour de la pièce**, le même `jourEn` que pour les parois. Sans lui,
 *    les meubles étaient les seuls objets de l'appartement à ignorer dans
 *    quelle pièce ils se trouvaient.
 *
 * Elle ne coûte **aucun triangle**. C'est le point qui la rend possible : on
 * ne subdivise pas, on laisse la valeur varier entre les huit sommets du pavé,
 * et cela suffit — un dégradé vertical sur chaque face latérale est exactement
 * ce qu'on cherchait à obtenir. Subdiviser aurait donné la même image pour
 * soixante-quatre fois plus de géométrie.
 */
function occlusionMeuble(x: number, y: number, z: number): number {
  const sol = 0.4 * Math.exp(-(y - SOL) / 0.3);
  let mur = 0;
  for (const ligne of LIGNES_X) mur = Math.max(mur, 0.2 * Math.exp(-Math.abs(x - ligne) / 0.28));
  for (const ligne of LIGNES_Z) mur = Math.max(mur, 0.2 * Math.exp(-Math.abs(z - ligne) / 0.28));
  return Math.max(0.3, 1 - sol - mur) * jourEn(x, y, z);
}

export function poserAppartement(a: Atelier): THREE.Light[] {
  const { pose, materiaux: M, leger } = a;
  const rond = (r: number) => (leger ? Math.max(6, Math.round(r)) : Math.round(r * 1.6));

  /**
   * Un pavé posé par ses deux coins : on raisonne en cotes de plan.
   *
   * Sans peinture explicite, il reçoit `occlusionMeuble` et **aucune
   * subdivision** : la valeur varie entre ses huit sommets, ce qui donne le
   * dégradé de pied recherché sans un triangle de plus.
   */
  const bloc = (
    mat: THREE.Material,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    paint?: (px: number, py: number, pz: number) => number,
    maille?: number,
  ) => {
    if (x1 - x0 < 0.004 || y1 - y0 < 0.004 || z1 - z0 < 0.004) return;
    pose(
      new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
      mat,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      (z0 + z1) / 2,
      paint ?? occlusionMeuble,
      maille ?? (paint ? 0.45 : 99),
    );
  };

  /**
   * Une nappe : un plan horizontal, et rien d'autre.
   *
   * Les sols et le plafond étaient des pavés. Sur une surface qu'on subdivise
   * pour y cuire l'occlusion, cela revient à raffiner six faces pour n'en
   * regarder qu'une : la scène est passée de vingt mille à cent trente-trois
   * mille triangles d'un coup, dont cinq sixièmes pour des sous-faces de
   * dalles que personne ne verra jamais.
   */
  const nappe = (
    mat: THREE.Material,
    x0: number,
    x1: number,
    y: number,
    z0: number,
    z1: number,
    versLeHaut: boolean,
    paint: (px: number, py: number, pz: number) => number,
    maille: number,
  ) => {
    const plan = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    plan.rotateX(versLeHaut ? -Math.PI / 2 : Math.PI / 2);
    pose(plan, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, paint, maille);
  };

  /* ------------------------------------------------------------- sols --- */
  /* Deux revêtements, et la limite tombe sur une cloison : du parquet là où
     l'on marche pieds nus, de la pierre là où l'on renverse de l'eau. */
  const dalle = (mat: THREE.Material, p: Piece) =>
    nappe(mat, p.x0, p.x1, SOL, p.z0, p.z1, true, occlusionSol, 0.42);
  dalle(M.parquet, PIECES.entree);
  dalle(M.parquet, PIECES.sejour);
  dalle(M.parquet, PIECES.chambre);
  dalle(M.pierre, PIECES.cuisine);
  dalle(M.pierre, PIECES.bains);

  /*
   * Les joints du parquet.
   *
   * Le sol est la plus grande surface d'une pièce et la plus regardée : un
   * aplat brun de soixante-seize mètres carrés est ce qui reste de plus
   * « image de synthèse » dans cette page. Un joint tous les seize
   * centimètres, large de huit millimètres, et le parquet redevient du
   * parquet.
   *
   * Ce sont des lattes, pas une texture : le dépôt a retiré ses cartes de
   * relief une à une, et pour une raison qui vaut ici plus qu'ailleurs — à
   * deux mètres, une image de bois plaquée sur un plan se voit comme une image
   * de bois plaquée sur un plan.
   */
  const lattes = (p: Piece) => {
    for (let z = p.z0 + 0.16; z < p.z1 - 0.05; z += 0.16) {
      bloc(M.tronc, p.x0 + 0.02, p.x1 - 0.02, SOL + 0.002, SOL + 0.006, z - 0.004, z + 0.004);
    }
  };
  lattes(PIECES.entree);
  lattes(PIECES.sejour);
  lattes(PIECES.chambre);

  // Le plafond, d'un seul tenant.
  /* Le plafond est peint, pas coulé : c'est `enduit` et non `soffite`. Un
     plafond gris de sous-face de dalle assombrit une pièce entière, puisque
     c'est la plus grande surface qu'elle possède et la seule que toutes les
     autres voient. */
  nappe(M.enduit, X0, X1, PLAFOND, Z0, Z1, false, occlusionPlafond, 0.7);

  /* Le joint creux du plafond : quatre centimètres d'ombre entre le plafond et
     les murs. C'est un détail de chantier — un profil de rive — et c'est ce qui
     détache un plafond au lieu de le coller. Il ne se remarque pas ; son
     absence, si : sans lui, le plafond fait bloc avec les murs et la pièce perd
     sa hauteur. */
  for (const [x0, x1, z0, z1] of [
    [X0, X1, Z0, Z0 + 0.05],
    [X0, X1, Z1 - 0.05, Z1],
    [X0, X0 + 0.05, Z0, Z1],
    [X1 - 0.05, X1, Z0, Z1],
  ]) {
    bloc(M.tronc, x0, x1, PLAFOND - 0.045, PLAFOND, z0, z1);
  }

  /* -------------------------------------------------- murs de refend --- */
  // Les deux murs aveugles, à l'ouest et au sud.
  bloc(M.enduit, X0 - 0.2, X0, SOL, PLAFOND, Z0 - 0.2, Z1, occlusionMur(true, X0), 0.45);
  bloc(M.enduit, X0 - 0.2, X1, SOL, PLAFOND, Z0 - 0.2, Z0, occlusionMur(false, Z0), 0.45);

  /**
   * Une cloison percée d'un passage.
   *
   * Le passage est donné en cotes absolues et non en largeur : sur un plan, on
   * sait où est une porte, on ne sait pas de combien elle est décalée du coin.
   */
  const cloison = (
    selonZ: boolean,
    fixe: number,
    de: number,
    a: number,
    trous: [number, number, number][],
  ) => {
    const bords = [de, ...trous.flatMap(([p0, p1]) => [p0, p1]), a];
    for (let i = 0; i < bords.length; i += 2) {
      const c0 = bords[i];
      const c1 = bords[i + 1];
      const teinte = occlusionMur(selonZ, fixe);
      if (selonZ) bloc(M.enduit, fixe, fixe + CLOISON, SOL, PLAFOND, c0, c1, teinte, 0.45);
      else bloc(M.enduit, c0, c1, SOL, PLAFOND, fixe, fixe + CLOISON, teinte, 0.45);
    }
    // Les linteaux, au-dessus de chaque passage.
    for (const [p0, p1, haut] of trous) {
      if (haut >= PLAFOND - SOL) continue;
      if (selonZ) bloc(M.enduit, fixe, fixe + CLOISON, SOL + haut, PLAFOND, p0, p1);
      else bloc(M.enduit, p0, p1, SOL + haut, PLAFOND, fixe, fixe + CLOISON);
    }
  };

  /* Les cloisons et leurs passages viennent du plan, pas d'ici : voir
     `CLOISONS` dans `lib/residence.ts`. C'est ce qui permet au test de
     vérifier que le vol les franchit par leurs ouvertures. */
  for (const r of CLOISONS) cloison(r.selonZ, r.fixe, r.de, r.a, r.trous);

  /* Les plinthes. Onze centimètres, sur les murs qu'on voit de près. Elles ne
     se remarquent jamais ; leur absence, si — c'est elle qui fait flotter les
     murs au-dessus du sol dans les images de synthèse. */
  const plinthe = (selonZ: boolean, fixe: number, de: number, a: number) => {
    if (selonZ) bloc(M.bois, fixe, fixe + 0.022, SOL, SOL + PLINTHE, de, a);
    else bloc(M.bois, de, a, SOL, SOL + PLINTHE, fixe, fixe + 0.022);
  };
  plinthe(true, X0, Z0, Z1);
  plinthe(false, Z0, X0, X1);
  plinthe(true, PIECES.entree.x1 - 0.022, Z0, 4.2);
  plinthe(true, PIECES.entree.x1 - 0.022, 6.0, Z1);
  plinthe(true, PIECES.entree.x1 + CLOISON, Z0, 4.2);
  plinthe(true, PIECES.entree.x1 + CLOISON, 6.0, Z1);

  /*
   * Les deux portes, entrouvertes.
   *
   * Une baie de quatre-vingt-dix centimètres sans vantail n'est pas une porte,
   * c'est un trou dans un mur — et une chambre à laquelle on accède par un trou
   * dans un mur n'est pas un logement. Entrouvertes à trente degrés : fermées,
   * elles cachent la pièce que la visite s'apprête à montrer ; grandes
   * ouvertes, elles disparaissent contre le mur.
   */
  const porte = (x: number, z: number, angle: number) => {
    const large = 0.9;
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const geo = new THREE.BoxGeometry(large, PORTE - 0.04, 0.042);
    geo.translate(large / 2, 0, 0);
    geo.rotateY(angle);
    pose(geo, M.bois, x, SOL + (PORTE - 0.04) / 2, z);
    // La poignée, à un mètre cinq.
    const bec = new THREE.BoxGeometry(0.13, 0.024, 0.024);
    bec.translate(large - 0.09 + 0.05, 0, 0.05);
    bec.rotateY(angle);
    pose(bec, M.metal, x, SOL + 1.05, z);
    void c;
    void sn;
  };
  porte(-0.5, PIECES.entree.z1 + CLOISON / 2, -0.52);
  porte(-1.9, PIECES.entree.z0 - CLOISON / 2, 0.52);

  /* ------------------------------------------------------- menuiserie --- */
  /*
   * Les deux façades vitrées, montées ici et non dans la boucle des étages.
   *
   * Elles sont les seules du bâtiment qu'on regarde du dedans, et les seules
   * percées : la baie de l'est coulisse sur deux mètres quatre-vingts, et
   * c'est par là que le vol sort sur la terrasse au dernier écran. Le reste de
   * la tour peut se contenter d'un bandeau continu ; ici, il faut une
   * ouverture, des montants, une traverse et un seuil.
   */
  const vitrer = (
    selonZ: boolean,
    fixe: number,
    de: number,
    a: number,
    ouvert?: [number, number],
  ) => {
    const tronçons: [number, number][] = ouvert
      ? [
          [de, ouvert[0]],
          [ouvert[1], a],
        ]
      : [[de, a]];
    for (const [c0, c1] of tronçons) {
      if (selonZ) bloc(M.vitrine, fixe, fixe + 0.05, SOL, PLAFOND - 0.1, c0, c1);
      else bloc(M.vitrine, c0, c1, SOL, PLAFOND - 0.1, fixe, fixe + 0.05);
    }
    // Meneaux toutes les deux trames, montants d'ouvrant, traverse haute.
    const pas = 1.8;
    for (let c = Math.ceil(de / pas) * pas; c < a; c += pas) {
      if (selonZ) bloc(M.meneau, fixe - 0.03, fixe + 0.11, SOL, PLAFOND - 0.1, c - 0.04, c + 0.04);
      else bloc(M.meneau, c - 0.04, c + 0.04, SOL, PLAFOND - 0.1, fixe - 0.03, fixe + 0.11);
    }
    if (ouvert) {
      for (const c of ouvert) {
        if (selonZ) bloc(M.meneau, fixe - 0.05, fixe + 0.13, SOL, PLAFOND - 0.1, c - 0.06, c + 0.06);
        else bloc(M.meneau, c - 0.06, c + 0.06, SOL, PLAFOND - 0.1, fixe - 0.05, fixe + 0.13);
      }
    }
    if (selonZ) {
      bloc(M.meneau, fixe - 0.05, fixe + 0.13, PLAFOND - 0.1, PLAFOND, de, a);
      bloc(M.meneau, fixe - 0.05, fixe + 0.13, SOL - 0.03, SOL + 0.03, de, a);
    } else {
      bloc(M.meneau, de, a, PLAFOND - 0.1, PLAFOND, fixe - 0.05, fixe + 0.13);
      bloc(M.meneau, de, a, SOL - 0.03, SOL + 0.03, fixe - 0.05, fixe + 0.13);
    }
  };
  vitrer(true, X1, Z0, Z1, [BAIE.z0, BAIE.z1]);
  vitrer(false, Z1, X0, X1);

  /* Une corniche lumineuse le long des deux baies : c'est elle qu'on voit le
     soir, et c'est elle qui détache le plafond du vitrage. */
  bloc(M.lueur, X1 - 0.62, X1 - 0.24, PLAFOND - 0.1, PLAFOND - 0.05, Z0 + 0.6, Z1 - 0.6);
  bloc(M.lueur, X0 + 0.6, X1 - 0.8, PLAFOND - 0.1, PLAFOND - 0.05, Z1 - 0.62, Z1 - 0.24);

  /*
   * Les rideaux, repliés sur les côtés.
   *
   * Repliés, et jamais tirés : une voilure en travers de la baie coûterait la
   * vue, qui est ce qu'on vend, et un panneau translucide plein cadre est en
   * plus le genre de surface qui fait ramer une machine faible. Rassemblés aux
   * tableaux, ils font ce qu'ils font dans les photographies d'intérieur —
   * habiller un vitrage nu et donner une matière souple au milieu de six
   * matières dures.
   */
  const tringle = (selonZ: boolean, fixe: number, de: number, a: number) => {
    if (selonZ) bloc(M.metal, fixe - 0.26, fixe - 0.22, PLAFOND - 0.17, PLAFOND - 0.13, de, a);
    else bloc(M.metal, de, a, PLAFOND - 0.17, PLAFOND - 0.13, fixe - 0.26, fixe - 0.22);
  };
  const voilage = (selonZ: boolean, fixe: number, centre: number) => {
    for (let i = 0; i < 4; i += 1) {
      const c = centre + (i - 1.5) * 0.13;
      const profond = 0.1 + (i % 2) * 0.06;
      if (selonZ) bloc(M.lin, fixe - 0.34, fixe - 0.34 + profond, SOL + 0.02, PLAFOND - 0.16, c - 0.06, c + 0.06);
      else bloc(M.lin, c - 0.06, c + 0.06, SOL + 0.02, PLAFOND - 0.16, fixe - 0.34, fixe - 0.34 + profond);
    }
  };
  tringle(true, X1, Z0 + 0.3, Z1 - 0.3);
  tringle(false, Z1, X0 + 0.9, X1 - 0.3);
  voilage(true, X1, 3.5);
  voilage(true, X1, 10.0);
  voilage(false, Z1, 1.5);
  voilage(false, Z1, 10.0);

  /* ------------------------------------------------------------ séjour --- */
  const S = PIECES.sejour;
  /*
   * Le tapis, à deux tons.
   *
   * Un aplat rectangulaire se lit comme un rectangle peint sur le sol ; une
   * bordure d'une trentaine de centimètres, un ton plus soutenu, se lit comme
   * un tapis. Deux pavés au lieu d'un.
   */
  /* Le tapis prend la même cuisson que le parquet qu'il recouvre. Sans elle,
     il annulait tout le travail d'occlusion sur le plus grand quadrilatère du
     premier plan : quatre mètres sur cinq d'aplat clair sous le canapé, qui
     effaçaient d'un coup l'ombre au pied du canapé, celle de la table basse,
     et la décroissance du jour vers le fond de la pièce. Une surface qui
     recouvre le sol doit être éclairée comme le sol. */
  bloc(M.bois, 4.0, 9.6, SOL + 0.001, SOL + 0.014, 5.0, 9.4, occlusionSol, 0.34);
  bloc(M.lin, 4.3, 9.3, SOL + 0.014, SOL + 0.022, 5.3, 9.1, occlusionSol, 0.34);

  /*
   * Le canapé.
   *
   * Il était un banc : une assise, un dossier, deux pavés. C'est le meuble le
   * plus regardé de la page — il occupe le premier plan de trois écrans sur
   * neuf — et le seul dont on attende qu'il ait l'air **mou**.
   *
   * Le moelleux se fabrique en empilant : une carcasse un peu plus étroite que
   * l'emprise, des coussins d'assise posés dessus avec un jeu de deux
   * centimètres, des coussins de dossier légèrement en retrait, et des
   * accoudoirs qui débordent. Chaque décrochement fait une ligne d'ombre, et ce
   * sont ces lignes-là — pas la forme générale — qui disent le rembourrage.
   */
  const RANG = SOL;
  const assise = (x0: number, x1: number, z0: number, z1: number) => {
    // La carcasse, puis le socle en retrait : le canapé ne touche pas le sol.
    bloc(M.bois, x0 + 0.08, x1 - 0.08, RANG + 0.06, RANG + 0.1, z0 + 0.08, z1 - 0.08);
    bloc(M.bois, x0, x1, RANG + 0.1, RANG + 0.3, z0, z1);
  };
  const coussin = (x0: number, x1: number, z0: number, z1: number, epais: number) => {
    bloc(M.lin, x0, x1, RANG + 0.3, RANG + 0.3 + epais * 0.72, z0, z1);
    bloc(M.lin, x0 + 0.03, x1 - 0.03, RANG + 0.3 + epais * 0.72, RANG + 0.3 + epais, z0 + 0.03, z1 - 0.03);
  };

  // Le retour, le long de la façade est.
  assise(4.0, 4.98, 5.4, 9.3);
  for (const [z0, z1] of [
    [5.5, 6.72],
    [6.78, 8.0],
    [8.06, 9.24],
  ]) {
    coussin(4.24, 4.96, z0, z1, 0.19);
  }
  // Le grand pan, face à la baie.
  assise(4.98, 8.6, 5.4, 6.38);
  for (const [x0, x1] of [
    [5.06, 6.24],
    [6.3, 7.48],
    [7.54, 8.54],
  ]) {
    coussin(x0, x1, 5.62, 6.34, 0.19);
  }
  // Les dossiers, en retrait de trois centimètres sur l'assise.
  for (const [z0, z1] of [
    [5.5, 7.4],
    [7.44, 9.3],
  ]) {
    bloc(M.lin, 4.02, 4.24, RANG + 0.3, RANG + 0.86, z0, z1);
    bloc(M.lin, 4.05, 4.22, RANG + 0.86, RANG + 0.9, z0 + 0.03, z1 - 0.03);
  }
  for (const [x0, x1] of [
    [5.06, 6.8],
    [6.84, 8.6],
  ]) {
    bloc(M.lin, x0, x1, RANG + 0.3, RANG + 0.86, 5.4, 5.62);
    bloc(M.lin, x0 + 0.03, x1 - 0.03, RANG + 0.86, RANG + 0.9, 5.43, 5.6);
  }
  // Les accoudoirs, qui débordent de l'assise.
  bloc(M.lin, 4.0, 5.0, RANG + 0.3, RANG + 0.62, 9.24, 9.4);
  bloc(M.lin, 8.54, 8.7, RANG + 0.3, RANG + 0.62, 5.4, 6.38);
  /* Trois coussins d'appoint, et le seul accent de couleur de l'appartement.
     Un seul : posé sur trois oreillers d'un séjour beige, un vert olive profond
     réchauffe la pièce ; répété sur les chaises, les serviettes et le lit, il
     ferait un catalogue. */
  for (const [x, z] of [
    [4.5, 6.4],
    [4.5, 8.4],
    [7.6, 5.9],
  ] as const) {
    bloc(M.accent, x - 0.2, x + 0.2, RANG + 0.49, RANG + 0.78, z - 0.2, z + 0.2);
  }

  // La table basse, plateau de marbre sur piètement métallique.
  bloc(M.marbre, 5.9, 7.5, SOL + 0.36, SOL + 0.42, 7.2, 8.2);
  bloc(M.metal, 6.2, 7.2, SOL, SOL + 0.36, 7.45, 7.95);
  // Le buffet contre la cloison, et deux panneaux au mur au-dessus.
  bloc(M.bois, S.x0 + CLOISON, S.x0 + CLOISON + 0.46, SOL + 0.16, SOL + 0.86, 7.2, 10.2);
  bloc(M.metal, S.x0 + CLOISON, S.x0 + CLOISON + 0.5, SOL + 0.86, SOL + 0.9, 7.15, 10.25);
  for (const [z0, z1] of [
    [7.4, 8.5],
    [8.8, 9.9],
  ]) {
    bloc(M.marbre, S.x0 + CLOISON, S.x0 + CLOISON + 0.05, SOL + 1.25, SOL + 2.05, z0, z1);
  }
  // La table à manger et ses six chaises, côté cuisine.
  bloc(M.bois, 6.6, 9.4, SOL + 0.72, SOL + 0.78, 3.5, 4.8);
  for (const x of [6.9, 9.1]) bloc(M.metal, x - 0.05, x + 0.05, SOL, SOL + 0.72, 4.1, 4.2);
  bloc(M.metal, 6.9, 9.1, SOL + 0.62, SOL + 0.7, 4.1, 4.2);
  for (const x of [7.1, 8.0, 8.9]) {
    for (const [z, sens] of [
      [3.16, -1],
      [5.14, 1],
    ] as const) {
      bloc(M.lin, x - 0.23, x + 0.23, SOL + 0.4, SOL + 0.47, z - 0.23, z + 0.23);
      bloc(M.bois, x - 0.23, x + 0.23, SOL + 0.47, SOL + 0.95, z + sens * 0.19, z + sens * 0.23);
      for (const dx of [-0.19, 0.19]) {
        for (const dz of [-0.19, 0.19]) {
          bloc(M.metal, x + dx - 0.02, x + dx + 0.02, SOL, SOL + 0.4, z + dz - 0.02, z + dz + 0.02);
        }
      }
    }
  }
  // Un lampadaire dans l'angle, et une plante devant la baie.
  /* Le lampadaire a changé de coin. Posé près de l'angle nord-ouest, il tombait
     à un mètre cinquante du premier arrêt du séjour et son abat-jour occupait
     un sixième du cadre : un objet de quarante centimètres vu de trop près est
     un objet énorme, et c'est le genre de faute qu'on ne voit que sur la
     capture. Au sud du canapé, il est à six mètres des deux points de vue. */
  pose(new THREE.CylinderGeometry(0.16, 0.16, 0.02, rond(9)), M.metal, 4.0, SOL + 0.01, 4.3);
  pose(new THREE.CylinderGeometry(0.02, 0.02, 1.5, rond(6)), M.metal, 4.0, SOL + 0.76, 4.3);
  pose(new THREE.CylinderGeometry(0.2, 0.15, 0.26, rond(10)), M.lin, 4.0, SOL + 1.62, 4.3);
  plante(a, 9.9, 9.9, 0.72, rond);

  /*
   * Les objets posés.
   *
   * Une coupe sur la table, une pile de livres sur le buffet, un plateau sur
   * l'îlot, des serviettes pliées : quatre poignées de pavés qui ne changent
   * rien au plan et tout à la lecture. Une pièce parfaitement rangée et
   * parfaitement vide se lit comme un showroom ; c'est le dernier écart entre
   * « bien modélisé » et « habité », et il ne coûte que des centimètres cubes.
   *
   * On s'arrête là, volontairement. Au-delà — une tasse, un magazine ouvert,
   * une paire de chaussures — on entre dans la mise en scène, et une mise en
   * scène trop appuyée se retourne : le visiteur se met à regarder les objets
   * au lieu de la pièce, qui est ce qu'on lui vend.
   */
  // La coupe sur la table à manger.
  pose(new THREE.CylinderGeometry(0.19, 0.13, 0.11, rond(14)), M.marbre, 8.0, SOL + 0.83, 4.15);
  // Trois livres empilés sur le buffet, légèrement décalés.
  for (const [i, dz] of [0, 0.03, -0.02].entries()) {
    bloc(
      M.bois,
      PIECES.sejour.x0 + CLOISON + 0.06,
      PIECES.sejour.x0 + CLOISON + 0.34,
      SOL + 0.9 + i * 0.035,
      SOL + 0.933 + i * 0.035,
      8.6 + dz,
      8.98 + dz,
    );
  }
  // Un vase élancé à l'autre bout du buffet.
  pose(new THREE.CylinderGeometry(0.07, 0.1, 0.34, rond(12)), M.marbre, 1.0, SOL + 1.07, 9.7);

  /* ----------------------------------------------------------- cuisine --- */
  const C = PIECES.cuisine;
  // Le linéaire contre le mur aveugle : caissons, plan, crédence, hotte.
  bloc(M.bois, 3.0, 9.2, SOL, SOL + 0.86, C.z0, C.z0 + 0.66);
  bloc(M.marbre, 2.94, 9.26, SOL + 0.86, SOL + 0.94, C.z0 - 0.02, C.z0 + 0.7);
  bloc(M.marbre, 3.0, 9.2, SOL + 0.94, SOL + 1.44, C.z0, C.z0 + 0.03);
  bloc(M.bois, 3.0, 5.4, SOL + 1.44, SOL + 2.24, C.z0, C.z0 + 0.36);
  bloc(M.bois, 7.4, 9.2, SOL + 1.44, SOL + 2.24, C.z0, C.z0 + 0.36);
  bloc(M.metal, 5.7, 7.1, SOL + 1.5, SOL + 1.62, C.z0, C.z0 + 0.5);
  bloc(M.metal, 6.15, 6.65, SOL + 1.62, SOL + 2.34, C.z0 + 0.1, C.z0 + 0.4);
  // Les colonnes, à l'extrémité ouest.
  bloc(M.bois, C.x0 + CLOISON, C.x0 + CLOISON + 0.62, SOL, SOL + 2.34, 0.2, 2.6);
  // L'îlot, tourné vers la baie, et trois tabourets.
  bloc(M.bois, 4.6, 8.0, SOL, SOL + 0.86, 1.1, 2.2);
  bloc(M.marbre, 4.5, 8.1, SOL + 0.86, SOL + 0.94, 1.0, 2.32);
  /* Un tabouret de bar, c'est quatre pièces et pas deux : l'assise, la
     colonne, **le repose-pied** et **la base**. Sans les deux dernières, le
     rendu donne trois champignons posés sur le parquet — et c'est exactement
     ce qu'on voyait sur la capture du séjour, au deuxième plan de l'écran le
     plus regardé de la page. Deux cylindres de plus par tabouret. */
  for (const x of [5.3, 6.3, 7.3]) {
    pose(new THREE.CylinderGeometry(0.17, 0.17, 0.06, rond(10)), M.bois, x, SOL + 0.66, 2.86);
    pose(new THREE.CylinderGeometry(0.035, 0.045, 0.63, rond(8)), M.metal, x, SOL + 0.32, 2.86);
    const anneau = new THREE.TorusGeometry(0.15, 0.014, rond(5), rond(12));
    // Un tore est dessiné dans le plan XY : couché, il devient un repose-pied.
    anneau.rotateX(Math.PI / 2);
    pose(anneau, M.metal, x, SOL + 0.22, 2.86, undefined, 99);
    pose(new THREE.CylinderGeometry(0.19, 0.21, 0.025, rond(12)), M.metal, x, SOL + 0.012, 2.86);
  }

  // Le plateau et deux bols, sur l'îlot.
  bloc(M.bois, 6.9, 7.7, SOL + 0.94, SOL + 0.965, 1.35, 1.95);
  for (const x of [7.06, 7.44]) {
    pose(new THREE.CylinderGeometry(0.09, 0.06, 0.07, rond(12)), M.marbre, x, SOL + 1.0, 1.65);
  }
  // Une planche et deux pots contre la crédence.
  bloc(M.bois, 3.4, 3.46, SOL + 0.94, SOL + 1.32, PIECES.cuisine.z0 + 0.1, PIECES.cuisine.z0 + 0.44);
  for (const x of [8.5, 8.76]) {
    pose(new THREE.CylinderGeometry(0.06, 0.07, 0.19, rond(10)), M.metal, x, SOL + 1.03, PIECES.cuisine.z0 + 0.3);
  }

  /* ----------------------------------------------------------- chambre --- */
  /*
   * Le plan de la chambre, et ce qu'il a fallu six essais pour comprendre.
   *
   * La caméra entre par le sud-est. Trois choses se disputent quatre mètres
   * sur quatre : le lit, le dressing, et la baie nord qui fait tout le mur du
   * fond. Les cinq premières dispositions essayées ont chacune échoué de la
   * même manière — un meuble haut à un mètre de l'objectif, en travers d'un
   * tiers de l'image, sans un détail.
   *
   * Ce qui marche : le lit **tête à l'ouest**, donc vu de flanc depuis la
   * porte, pieds vers l'objectif et oreillers au fond ; le dressing sur le
   * mur sud, **à l'ouest de la porte**, donc juste hors du bord droit du
   * cadre ; et l'axe de visée porté sur la baie, qui est la raison d'être de
   * la pièce. Le lit occupe alors la droite du cadre, la ville le centre, le
   * dressing rien du tout — il se voit en passant, quand la caméra tourne.
   *
   * La règle générale, écrite pour la prochaine pièce : on ne place pas les
   * meubles sur un plan, on les place **depuis la porte**, parce que c'est de
   * là qu'on regarde une chambre — au rendu comme à la visite.
   */
  const H = PIECES.chambre;

  // Le tapis, débordant du lit sur ses trois côtés libres.
  bloc(M.bois, -3.45, -0.8, SOL + 0.001, SOL + 0.014, 7.45, 9.9, occlusionSol, 0.34);
  bloc(M.lin, -3.3, -0.96, SOL + 0.014, SOL + 0.022, 7.6, 9.74, occlusionSol, 0.34);

  // Le lit, tête contre le mur aveugle de l'ouest.
  bloc(M.bois, H.x0 + 0.2, H.x0 + 0.32, SOL + 0.28, SOL + 1.3, 7.55, 9.65);
  bloc(M.bois, H.x0 + 0.32, H.x0 + 2.32, SOL + 0.22, SOL + 0.5, 7.7, 9.5);
  bloc(M.lin, H.x0 + 0.32, H.x0 + 2.32, SOL + 0.5, SOL + 0.66, 7.7, 9.5);
  bloc(M.lin, H.x0 + 0.92, H.x0 + 2.32, SOL + 0.66, SOL + 0.72, 7.7, 9.5);
  for (const z of [8.05, 9.15]) {
    bloc(M.lin, H.x0 + 0.38, H.x0 + 0.86, SOL + 0.66, SOL + 0.83, z - 0.25, z + 0.25);
  }
  // Un plaid replié au pied du lit.
  bloc(M.lin, H.x0 + 0.32, H.x0 + 2.32, SOL + 0.66, SOL + 0.74, 7.7, 8.22);

  // Deux chevets et leurs lampes, de part et d'autre de la tête de lit.
  for (const z of [7.6, 9.6]) {
    bloc(M.bois, H.x0 + 0.24, H.x0 + 0.66, SOL + 0.2, SOL + 0.52, z - 0.21, z + 0.21);
    pose(new THREE.CylinderGeometry(0.11, 0.08, 0.2, rond(9)), M.lin, H.x0 + 0.45, SOL + 0.66, z);
  }

  /*
   * Le dressing, toute hauteur, sur le mur sud et **à l'ouest de la porte**.
   *
   * Il allait d'un bout à l'autre du mur, porte comprise — sur un plan, deux
   * rectangles qui se recouvrent restent deux rectangles, et personne ne voit
   * qu'on ne peut plus entrer. Il s'arrête donc au droit de l'huisserie.
   *
   * Ses vantaux sont **clairs**, en saillie de deux centimètres sur la caisse.
   * Un placard laqué n'est pas une anomalie dans un appartement dont tous les
   * murs sont beiges, c'est l'usage ; deux mètres trente de bois foncé sont
   * une masse. Et deux centimètres de relief donnent une ombre portée là où un
   * joint creux de huit millimètres ne donnait pas un pixel.
   */
  const DRESSING = { x0: H.x0 + 0.2, x1: -1.3, z0: H.z0 + CLOISON, z1: H.z0 + CLOISON + 0.6 };
  bloc(M.bois, DRESSING.x0, DRESSING.x1, SOL, SOL + 2.34, DRESSING.z0, DRESSING.z1);
  // Le socle en retrait, et le bandeau qui coiffe : deux lignes d'ombre.
  bloc(M.bois, DRESSING.x0, DRESSING.x1, SOL, SOL + 0.09, DRESSING.z0, DRESSING.z1 - 0.03);
  bloc(M.bois, DRESSING.x0, DRESSING.x1 + 0.02, SOL + 2.34, SOL + 2.38, DRESSING.z0, DRESSING.z1 + 0.02);
  const vantaux = Math.max(2, Math.round((DRESSING.x1 - DRESSING.x0) / 0.72));
  for (let i = 0; i < vantaux; i += 1) {
    const large = (DRESSING.x1 - DRESSING.x0) / vantaux;
    const x0 = DRESSING.x0 + i * large;
    bloc(
      M.lin,
      x0 + 0.012,
      x0 + large - 0.012,
      SOL + 0.105,
      SOL + 2.325,
      DRESSING.z1,
      DRESSING.z1 + 0.02,
    );
    // La poignée : un bandeau encastré à un mètre cinq, sur toute la largeur.
    bloc(
      M.metal,
      x0 + 0.06,
      x0 + large - 0.06,
      SOL + 1.02,
      SOL + 1.06,
      DRESSING.z1 + 0.02,
      DRESSING.z1 + 0.034,
    );
  }

  /* ------------------------------------------------------------- bains --- */
  const B = PIECES.bains;
  // La baignoire contre le mur sud, et son tablier de marbre.
  bloc(M.marbre, B.x0 + 0.3, B.x0 + 2.1, SOL, SOL + 0.56, B.z0 + 0.2, B.z0 + 1.0);
  bloc(M.pierre, B.x0 + 0.38, B.x0 + 2.02, SOL + 0.5, SOL + 0.56, B.z0 + 0.28, B.z0 + 0.92);
  // La double vasque contre le mur ouest, et son miroir.
  bloc(M.bois, B.x0, B.x0 + 0.55, SOL + 0.4, SOL + 0.82, 0.9, 3.0 - CLOISON);
  bloc(M.marbre, B.x0, B.x0 + 0.6, SOL + 0.82, SOL + 0.9, 0.85, 3.05 - CLOISON);
  /*
   * Le miroir, et la crédence : les murs d'une salle de bains ne sont pas nus.
   *
   * La capture de cette pièce sortait avec soixante pour cent de l'image en
   * plâtre uni : tout ce qu'on avait modélisé — baignoire, vasque, douche —
   * tient sous un mètre, et une caméra à hauteur d'œil regarde au-dessus.
   * Dix-huit mètres carrés « en pierre claire » qui ne montrent pas un
   * centimètre de pierre : c'est le texte qui devient faux, pas seulement
   * l'image qui est pauvre.
   *
   * On remonte donc la matière sur les murs — une crédence de pierre à
   * hauteur d'appui derrière la vasque, un miroir pleine hauteur au-dessus,
   * et le même bandeau de pierre derrière la baignoire. Rien qui ne soit dans
   * une vraie salle de bains, et c'est exactement ce qui manquait au cadre.
   */
  // La crédence de pierre derrière la vasque, puis le miroir jusqu'au plafond.
  bloc(M.pierre, B.x0, B.x0 + 0.04, SOL + 0.9, SOL + 1.28, 0.85, 3.05 - CLOISON);
  bloc(M.metal, B.x0 + 0.02, B.x0 + 0.05, SOL + 1.28, SOL + 2.42, 0.95, 2.95 - CLOISON);
  // Le bandeau de pierre derrière la baignoire, sur le mur sud.
  bloc(M.pierre, B.x0 + 0.2, B.x0 + 2.4, SOL, SOL + 1.35, B.z0, B.z0 + 0.05);
  // Deux robinets muraux et une patère à serviettes.
  for (const z of [1.45, 2.35]) {
    pose(new THREE.CylinderGeometry(0.02, 0.02, 0.24, rond(6)), M.metal, B.x0 + 0.16, SOL + 1.16, z);
  }
  bloc(M.metal, B.x0 + 0.06, B.x0 + 0.1, SOL + 1.5, SOL + 1.53, -0.1, 0.5);
  bloc(M.lin, B.x0 + 0.05, B.x0 + 0.13, SOL + 0.86, SOL + 1.5, 0.02, 0.4);
  // La douche à l'italienne, dans l'angle est.
  bloc(M.pierre, B.x1 - 1.5 - CLOISON, B.x1 - CLOISON, SOL - 0.02, SOL + 0.02, B.z0 + 0.1, B.z0 + 1.6);
  bloc(M.garde, B.x1 - 1.52 - CLOISON, B.x1 - 1.46 - CLOISON, SOL, SOL + 2.1, B.z0 + 0.1, B.z0 + 1.6);
  bloc(M.metal, B.x1 - 0.9 - CLOISON, B.x1 - 0.86 - CLOISON, SOL + 2.05, SOL + 2.12, B.z0 + 0.4, B.z0 + 0.9);

  // Deux serviettes pliées sur le bord de la baignoire, et une pile sur la vasque.
  for (const z of [-0.72, -0.36]) {
    bloc(M.lin, PIECES.bains.x0 + 0.42, PIECES.bains.x0 + 0.78, SOL + 0.56, SOL + 0.63, z, z + 0.28);
  }
  for (let i = 0; i < 2; i += 1) {
    bloc(
      M.lin,
      PIECES.bains.x0 + 0.06,
      PIECES.bains.x0 + 0.36,
      SOL + 0.9 + i * 0.05,
      SOL + 0.947 + i * 0.05,
      2.5,
      2.86,
    );
  }

  /* ---------------------------------------------------------- terrasse --- */
  /* Un salon d'extérieur, et rien de plus : la terrasse porte déjà sa
     jardinière filante et son garde-corps, posés avec le redan. */
  /* Le platelage. La terrasse est au premier plan du dernier écran de la page :
     une dalle de béton lisse y occupait tout le bas du cadre. Une lame tous les
     quatorze centimètres, et le sol de la terrasse a une direction, une échelle
     et une matière — pour trois cents pavés plats fusionnés en un seul. */
  for (let z = TERRASSE.z0; z < TERRASSE.z1 - 0.05; z += 0.14) {
    bloc(M.bois, TERRASSE.x0, TERRASSE.x1 - 1.2, SOL - 0.09, SOL - 0.055, z + 0.012, z + 0.128);
  }

  bloc(M.bois, TERRASSE.x0 + 0.5, TERRASSE.x0 + 1.4, SOL - 0.06, SOL + 0.34, 6.6, 9.4);
  bloc(M.lin, TERRASSE.x0 + 0.56, TERRASSE.x0 + 1.34, SOL + 0.34, SOL + 0.46, 6.66, 9.34);
  bloc(M.lin, TERRASSE.x0 + 0.5, TERRASSE.x0 + 0.66, SOL + 0.34, SOL + 0.8, 6.6, 9.4);
  bloc(M.marbre, TERRASSE.x0 + 1.9, TERRASSE.x0 + 2.7, SOL + 0.3, SOL + 0.36, 7.4, 8.6);
  for (const z of [3.0, 4.4]) {
    bloc(M.bois, TERRASSE.x0 + 0.6, TERRASSE.x0 + 2.5, SOL - 0.06, SOL + 0.3, z, z + 0.7);
    bloc(M.lin, TERRASSE.x0 + 0.66, TERRASSE.x0 + 1.3, SOL + 0.3, SOL + 0.74, z + 0.05, z + 0.65);
  }
  plante(a, TERRASSE.x0 + 0.8, 10.0, 0.6, rond);

  /* ----------------------------------------------------------- lumière --- */
  /*
   * Une source par pièce, basse et chaude, posée là où il y en aurait une.
   *
   * L'intensité d'une lampe ponctuelle est une luminance à un mètre, et
   * l'éclairement reçu vaut `I / d²`. Pour une pièce de trois mètres sous
   * plafond, viser un éclairement de l'ordre de l'unité à deux mètres donne
   * une intensité de quatre à six — deux ordres de grandeur en dessous de ce
   * qu'on écrit spontanément. La leçon a coûté cher une fois : à cent cinq,
   * tout saturait et le nuancier ne servait plus à rien.
   */
  const lampes: THREE.Light[] = [];
  const lampe = (x: number, y: number, z: number, intensite: number, teinte = 0xffdcb0) => {
    const l = new THREE.PointLight(teinte, intensite, 13, 2);
    l.position.set(x, y, z);
    lampes.push(l);
  };
  /*
   * Trois sources, et pas six.
   *
   * Le nombre de lumières d'une scène ne coûte pas à la construction, il coûte
   * **à chaque pixel** : le nuanceur standard déroule une boucle par source
   * pour chaque fragment. Six lampes ponctuelles dans un appartement où la
   * caméra n'a plus de ciel devant elle — donc où tout l'écran est couvert de
   * matière — ont fait doubler le temps par image, mesuré. Trois suffisent :
   * une par bande de jour, une pour la bande de service, et le reste vient de
   * la carte d'environnement et du soleil.
   */
  /*
   * Elles descendent à hauteur de luminaire, et elles perdent les deux tiers
   * de leur intensité.
   *
   * C'est la troisième fois que ces lampes sont trop fortes, et la première
   * fois qu'on comprend pourquoi. L'erreur n'est pas dans le nombre, elle est
   * dans le **modèle** : une source ponctuelle donne un éclairement en `I/d²`,
   * donc son voisinage immédiat reçoit tout. À vingt-quatre candelas et à
   * quatre-vingt-quinze centimètres d'une dalle, le plafond recevait
   * vingt-six — dix fois le soleil. Aucune valeur d'exposition ne rattrape
   * cela : le plafond était blanc pur avant que la pièce ne soit exposée.
   *
   * Un luminaire réel n'a pas ce défaut pour deux raisons qu'on imite ici,
   * faute de pouvoir les modéliser : il a une **surface** — donc son
   * éclairement ne diverge pas de près — et il a un **abat-jour**, qui coupe
   * la moitié haute. On le remplace par la seule chose qu'un moteur temps réel
   * sait faire à ce prix : baisser l'intensité et **descendre la source à la
   * hauteur où pend vraiment un luminaire**. Un mètre soixante pour un
   * lampadaire, un mètre soixante-quinze pour une suspension d'îlot.
   *
   * Le reste de la lumière ne vient pas de là et n'en est jamais venu : il
   * vient du jour cuit dans les sommets et de la carte d'environnement. Les
   * lampes ne sont pas l'éclairage de la pièce, elles en sont l'**accent** —
   * la flaque chaude sur un mur, le contre-jour sur un dossier. C'est le rôle
   * qu'elles auraient dû avoir depuis le début.
   */
  lampe(4.2, SOL + 1.62, 4.5, 9);
  lampe(6.3, SOL + 1.78, 1.7, 8);
  lampe(-1.8, SOL + 1.92, 5.4, 7);
  /*
   * La quatrième, et pourquoi elle vaut son prix.
   *
   * Le principe posé plus haut tient toujours — une lampe coûte à chaque
   * pixel, et six avaient fait doubler le temps par image. Mais trois lampes
   * toutes posées sur la bande de jour laissaient la salle de bains à un tiers
   * de l'éclairement du séjour, sur une page qui la décrit « en pierre
   * claire ». Une pièce aveugle n'est pas une pièce sombre : c'est une pièce
   * **dont la lumière est artificielle**, et il faut donc la poser.
   *
   * Le coût a été mesuré avant de la garder, pas supposé : `npm run budget`
   * avant et après donne dix pour cent de temps par image en plus. C'est le
   * prix d'une pièce qui existe, et on l'accepte — mais **pas sur les petites
   * machines**, où l'on rend déjà à échelle réduite et où dix pour cent se
   * prennent sur une marge qui n'existe pas. Le rattrapage y est fait par le
   * fond cuit, qui ne coûte rien : la salle de bains y sera un peu plate,
   * elle ne sera pas noire.
   */
  /* La salle de bains garde une intensité plus forte que les autres, et c'est
     le seul écart assumé du lot : elle est aveugle. Partout ailleurs la lampe
     n'est qu'un accent posé sur un jour qui existe déjà ; ici, elle **est** le
     jour. Descendue à un mètre soixante-quinze, elle n'écrase plus le plafond
     et éclaire ce qu'on regarde, qui est à hauteur de vasque. */
  if (!leger) lampe(-1.6, SOL + 1.75, 0.9, 12);
  return lampes;
}

/** Une plante en pot : tronc et masses irrégulières, jamais une sphère seule. */
function plante(a: Atelier, x: number, z: number, taille: number, rond: (r: number) => number): void {
  const { pose, materiaux: M } = a;
  pose(new THREE.CylinderGeometry(taille * 0.46, taille * 0.38, taille * 0.8, rond(10)), M.marbre, x, SOL + taille * 0.4, z);
  pose(new THREE.CylinderGeometry(0.045, 0.06, taille * 1.5, rond(6)), M.tronc, x, SOL + taille * 1.5, z);
  /*
   * Le feuillage : six masses, aplaties, et chacune d'un vert différent.
   *
   * La version précédente empilait quatre sphères pleines de la même couleur.
   * Deux sphères de même teinte qui se recoupent ne font pas une masse : elles
   * font **deux cercles concentriques**, parce que la seule chose que l'œil
   * voie de leur intersection est le contour de celle qui est devant, sur un
   * fond d'exactement la même valeur. Le rendu de la terrasse le montrait
   * sans appel — un oignon vert olive, à un mètre de la caméra.
   *
   * Deux corrections, et aucune ne coûte un triangle de plus. D'abord chaque
   * masse est **écrasée** : une couronne d'arbre est plus large que haute, et
   * une ellipsoïde n'a pas la signature de sphère qu'on lit au premier coup
   * d'œil. Ensuite chacune reçoit sa propre valeur, du sombre au clair selon
   * qu'elle est dessous ou sur le dessus — c'est ce que fait la lumière dans
   * un vrai feuillage, et c'est ce qui sépare deux masses qui se recoupent.
   */
  for (const [dx, dy, dz, k, ton] of [
    [0, 0.58, 0, 1, 1.06],
    [0.44, 0.3, 0.26, 0.68, 0.9],
    [-0.38, 0.4, -0.3, 0.62, 0.78],
    [0.16, 0.12, -0.46, 0.54, 0.7],
    [-0.3, 0.16, 0.42, 0.5, 0.74],
    [0.2, 0.72, -0.16, 0.56, 1.14],
  ] as const) {
    const masse = new THREE.SphereGeometry(taille * k * 0.74, rond(9), rond(7));
    masse.scale(1, 0.72, 1);
    pose(
      masse,
      M.vegetal,
      x + dx * taille,
      SOL + taille * (2.0 + dy),
      z + dz * taille,
      () => ton,
      /* Aucune subdivision : la valeur est constante sur la masse, donc les
         sommets de la sphère suffisent à la porter. Un pas de trop ici coûte
         quatre fois plus de triangles pour exactement la même image — et une
         maille nulle en coûterait mille fois plus, la boucle ne s'arrêtant
         qu'au bout de ses cinq passes. */
      99,
    );
  }
}
