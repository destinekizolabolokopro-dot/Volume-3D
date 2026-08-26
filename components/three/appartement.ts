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
import { BAIE, PIECES, SOL, SOUS_PLAFOND, TERRASSE, type Piece } from '@/lib/residence';

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
const CLOISON = 0.12;
/** Hauteur des portes. */
const PORTE = 2.25;
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
  [-3.4, -1.28, 7.7, 9.5, 0.5],
  [-3.4, -0.2, 6.72, 7.32, 0.45],
  [-3.3, -1.5, -1.2, -0.4, 0.4],
  [-3.6, -3.05, 0.9, 2.88, 0.4],
];

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
    return Math.max(0.3, 1 - bas - haut - angle);
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
  return Math.max(0.24, 1 - Math.max(mur, pied));
}

/** Assombrissement d'un plafond : contre les murs, et un peu partout. */
function occlusionPlafond(x: number, _y: number, z: number): number {
  let mur = 0;
  for (const ligne of LIGNES_X) mur = Math.max(mur, 0.26 * Math.exp(-Math.abs(x - ligne) / 0.34));
  for (const ligne of LIGNES_Z) mur = Math.max(mur, 0.26 * Math.exp(-Math.abs(z - ligne) / 0.34));
  return Math.max(0.5, 1 - mur);
}

export function poserAppartement(a: Atelier): THREE.Light[] {
  const { pose, materiaux: M, leger } = a;
  const rond = (r: number) => (leger ? Math.max(6, Math.round(r)) : Math.round(r * 1.6));

  /** Un pavé posé par ses deux coins : on raisonne en cotes de plan. */
  const bloc = (
    mat: THREE.Material,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    paint?: (px: number, py: number, pz: number) => number,
    maille = 0.45,
  ) => {
    if (x1 - x0 < 0.004 || y1 - y0 < 0.004 || z1 - z0 < 0.004) return;
    pose(
      new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
      mat,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      (z0 + z1) / 2,
      paint,
      maille,
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

  /* La cloison maîtresse, entre la bande de service et la bande de jour. Son
     unique passage fait 1,80 m et n'a pas de porte : c'est la respiration du
     plan, et une porte y ferait un couloir de ce qui est un dégagement. */
  cloison(true, PIECES.entree.x1, Z0, Z1, [[4.2, 6.0, SOUS_PLAFOND]]);
  // Entrée / chambre, et entrée / bains : deux portes de quatre-vingt-dix.
  cloison(false, PIECES.entree.z1, X0, PIECES.entree.x1, [[-1.9, -1.0, PORTE]]);
  cloison(false, PIECES.entree.z0 - CLOISON, X0, PIECES.entree.x1, [[-2.8, -1.9, PORTE]]);

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
  porte(-1.9, PIECES.entree.z1 + CLOISON / 2, -0.52);
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
  // Le tapis, puis le canapé en L autour de l'angle vitré.
  bloc(M.lin, 4.0, 9.6, SOL, SOL + 0.02, 5.0, 9.4);
  const canape = (x0: number, x1: number, z0: number, z1: number, dossierEnX: boolean) => {
    bloc(M.bois, x0, x1, SOL + 0.1, SOL + 0.34, z0, z1);
    bloc(M.lin, x0 + 0.06, x1 - 0.06, SOL + 0.34, SOL + 0.48, z0 + 0.06, z1 - 0.06);
    if (dossierEnX) bloc(M.lin, x0, x0 + 0.16, SOL + 0.34, SOL + 0.82, z0, z1);
    else bloc(M.lin, x0, x1, SOL + 0.34, SOL + 0.82, z0, z0 + 0.16);
  };
  canape(4.0, 4.95, 5.4, 9.3, true);
  canape(4.95, 8.6, 5.4, 6.35, false);
  // Deux coussins, parce qu'un canapé nu se lit comme un banc.
  for (const z of [6.2, 7.4, 8.6]) bloc(M.lin, 4.18, 4.36, SOL + 0.48, SOL + 0.76, z - 0.24, z + 0.24);
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
  for (const x of [5.3, 6.3, 7.3]) {
    pose(new THREE.CylinderGeometry(0.17, 0.17, 0.06, rond(10)), M.bois, x, SOL + 0.66, 2.86);
    pose(new THREE.CylinderGeometry(0.04, 0.06, 0.63, rond(7)), M.metal, x, SOL + 0.32, 2.86);
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
  const H = PIECES.chambre;
  bloc(M.lin, H.x0 + 0.4, H.x1 - 0.4, SOL, SOL + 0.02, 7.2, 10.2);
  // Le lit, tête contre le mur ouest.
  bloc(M.bois, H.x0 + 0.2, H.x0 + 0.32, SOL + 0.28, SOL + 1.25, 7.6, 9.6);
  bloc(M.bois, H.x0 + 0.32, H.x0 + 2.32, SOL + 0.22, SOL + 0.5, 7.7, 9.5);
  bloc(M.lin, H.x0 + 0.32, H.x0 + 2.32, SOL + 0.5, SOL + 0.66, 7.7, 9.5);
  bloc(M.lin, H.x0 + 0.9, H.x0 + 2.32, SOL + 0.66, SOL + 0.72, 7.7, 9.5);
  for (const z of [8.05, 9.15]) bloc(M.lin, H.x0 + 0.38, H.x0 + 0.78, SOL + 0.66, SOL + 0.82, z - 0.24, z + 0.24);
  // Deux chevets et leurs lampes.
  for (const z of [7.24, 9.96]) {
    bloc(M.bois, H.x0 + 0.24, H.x0 + 0.74, SOL + 0.2, SOL + 0.52, z - 0.22, z + 0.22);
    pose(new THREE.CylinderGeometry(0.11, 0.08, 0.2, rond(9)), M.lin, H.x0 + 0.49, SOL + 0.66, z);
  }
  // Le dressing, toute hauteur, contre la cloison de l'entrée.
  bloc(M.bois, H.x0 + 0.2, H.x0 + 3.4, SOL, SOL + 2.34, H.z0 + CLOISON, H.z0 + CLOISON + 0.6);
  for (const x of [-2.4, -1.6, -0.8]) {
    bloc(M.metal, x - 0.01, x + 0.01, SOL + 1.0, SOL + 1.3, H.z0 + CLOISON + 0.6, H.z0 + CLOISON + 0.63);
  }

  // Un plaid replié au pied du lit.
  bloc(M.lin, PIECES.chambre.x0 + 0.32, PIECES.chambre.x0 + 2.32, SOL + 0.66, SOL + 0.73, 7.7, 8.24);

  /* ------------------------------------------------------------- bains --- */
  const B = PIECES.bains;
  // La baignoire contre le mur sud, et son tablier de marbre.
  bloc(M.marbre, B.x0 + 0.3, B.x0 + 2.1, SOL, SOL + 0.56, B.z0 + 0.2, B.z0 + 1.0);
  bloc(M.pierre, B.x0 + 0.38, B.x0 + 2.02, SOL + 0.5, SOL + 0.56, B.z0 + 0.28, B.z0 + 0.92);
  // La double vasque contre le mur ouest, et son miroir.
  bloc(M.bois, B.x0, B.x0 + 0.55, SOL + 0.4, SOL + 0.82, 0.9, 3.0 - CLOISON);
  bloc(M.marbre, B.x0, B.x0 + 0.6, SOL + 0.82, SOL + 0.9, 0.85, 3.05 - CLOISON);
  bloc(M.metal, B.x0 + 0.01, B.x0 + 0.03, SOL + 1.1, SOL + 2.1, 1.0, 2.8);
  for (const z of [1.45, 2.35]) {
    pose(new THREE.CylinderGeometry(0.02, 0.02, 0.24, rond(6)), M.metal, B.x0 + 0.16, SOL + 1.0, z);
  }
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
  lampe(5.4, SOL + 2.4, 7.2, 26);
  lampe(6.3, SOL + 2.3, 1.7, 22);
  lampe(-1.8, SOL + 2.4, 5.4, 18);
  return lampes;
}

/** Une plante en pot : tronc et masses irrégulières, jamais une sphère seule. */
function plante(a: Atelier, x: number, z: number, taille: number, rond: (r: number) => number): void {
  const { pose, materiaux: M } = a;
  pose(new THREE.CylinderGeometry(taille * 0.46, taille * 0.38, taille * 0.8, rond(10)), M.marbre, x, SOL + taille * 0.4, z);
  pose(new THREE.CylinderGeometry(0.045, 0.06, taille * 1.5, rond(6)), M.tronc, x, SOL + taille * 1.5, z);
  for (const [dx, dy, dz, k] of [
    [0, 0.55, 0, 1],
    [0.42, 0.3, 0.24, 0.66],
    [-0.36, 0.38, -0.28, 0.6],
    [0.14, 0.14, -0.44, 0.52],
  ] as const) {
    pose(
      new THREE.SphereGeometry(taille * k * 0.72, rond(8), rond(6)),
      M.vegetal,
      x + dx * taille,
      SOL + taille * (2.05 + dy),
      z + dz * taille,
    );
  }
}
