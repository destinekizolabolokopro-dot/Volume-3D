/**
 * L'édifice : une résidence contemporaine, construite au lieu d'être
 * photographiée.
 *
 * Tout le reste du dépôt rend des **intérieurs** à partir d'un plan relevé.
 * Cette page-là demande le contraire : un extérieur, vu du dehors, tournant
 * lentement. La géométrie est donc nouvelle, mais la discipline est la même —
 * et c'est elle qui compte :
 *
 *  · **fusion par matériau.** Trois cents volumes, sept matériaux, sept appels
 *    de dessin. C'est ce qui permet à un bâtiment de douze étages de coûter
 *    moins cher à l'image qu'un appartement meublé ;
 *  · **des cotes, pas des proportions à l'œil.** Une trame de 1,80 m, des
 *    étages de 3,55 m, des redans de trois mètres : le bâtiment se mesure, et
 *    c'est ce qui le sauve du volume générique ;
 *  · **aucune image d'archive.** Il n'y a pas une photographie de bâtiment
 *    dans cette page, et c'est délibéré : le produit vend la reconstitution du
 *    volume, il serait absurde de l'illustrer avec la photo de quelqu'un
 *    d'autre.
 *
 * Sur les teintes : elles sont **locales à ce fichier** et ne rejoignent pas
 * `lib/palette.ts`. Le nuancier du dépôt est un nuancier d'intérieur — mur
 * chaud, chêne, lin, laiton — étudié et contrôlé pour des surfaces qui se
 * touchent dans une pièce. Une façade de béton et de verre répond à une autre
 * règle, celle que demande cette page : neutre, du noir au blanc, la couleur
 * venant de la lumière et non de la matière. Les mélanger aurait sali les deux.
 */

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ETAGE, NEZ, NIVEAUX, RETRAIT, SOCLE, TRAME, empreinte } from '@/lib/residence';

/* La trame, les étages et l'empreinte vivent dans `lib/residence.ts` : la page
   affiche des chiffres qui doivent être ceux du bâtiment, et deux fichiers qui
   se souviennent chacun du nombre d'étages finissent toujours par diverger. */

/* ================================================================ teintes === */

/**
 * Un gris n'est jamais tout à fait gris.
 *
 * Chaque valeur porte une pointe de température, et toujours la même
 * direction : le béton tire vers le chaud, le verre et l'ombre vers le froid.
 * C'est ce décalage minuscule — deux ou trois points sur un canal — qui fait
 * qu'une façade neutre paraît éclairée par le soleil plutôt que peinte en
 * gris. Une palette rigoureusement désaturée rend un bâtiment en carton.
 */
const TON = {
  /** Béton clair des dalles et des joues. */
  beton: 0xc3c4c2,
  /** Sous-face des balcons et retombées : le même béton, à l'ombre. */
  soffite: 0x8e908f,
  /** Le noyau maçonné, plus dense. */
  refend: 0x9d9e9b,
  /** Le vitrage de vision, entre l'allège et le nez de dalle. */
  verre: 0x5d6d78,
  /** L'allège : le panneau plein qui masque la dalle, sous chaque vitrage. */
  allege: 0x2e3439,
  /** Les meneaux et la résille verticale, en bronze sombre. */
  meneau: 0x4c4945,
  /** Garde-corps vitrés des terrasses. */
  garde: 0x8894a0,
  /** Le sol du parvis. */
  parvis: 0xa9a9a5,
  /** Le miroir d'eau. */
  eau: 0x33424c,
  /** Les masses végétales du parvis. */
  vegetal: 0x5f6a55,
  /** Le tronc des arbres. */
  tronc: 0x53504a,
  /** L'horizon, qui sert au ciel et à la brume. Les deux doivent être le
      même ton, sinon le sol se détache du fond par une ligne. */
  horizon: 0xdcd7cb,
} as const;

/* ================================================================== lots === */

type Bin = { dispose(): void };

/**
 * Un lot de géométries par matériau.
 *
 * Repris tel quel de `interior.ts`, où il a divisé par cinq le nombre d'appels
 * de dessin d'un logement meublé. Le principe est le même ici et le gain plus
 * grand encore : un bâtiment est fait de centaines de volumes identiques.
 */
class Lot {
  private readonly lots = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(source: THREE.BufferGeometry, material: THREE.Material, matrix: THREE.Matrix4): void {
    let geometry = source;
    geometry.applyMatrix4(matrix);
    if (!geometry.index) {
      const indexed = mergeVertices(geometry);
      if (indexed !== geometry) geometry.dispose();
      geometry = indexed;
    }
    if (!geometry.getAttribute('uv')) {
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const lot = this.lots.get(material);
    if (lot) lot.push(geometry);
    else this.lots.set(material, [geometry]);
  }

  flush(group: THREE.Group, disposables: Bin[]): void {
    for (const [material, lot] of this.lots) {
      const merged = lot.length === 1 ? lot[0] : mergeGeometries(lot, false);
      if (!merged) {
        for (const geometry of lot) {
          disposables.push(geometry);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
        continue;
      }
      if (merged !== lot[0]) for (const geometry of lot) geometry.dispose();
      disposables.push(merged);
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = material.userData?.sansOmbre !== true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.lots.clear();
  }
}

export interface OptionsEdifice {
  /**
   * Le mode allégé, pour les machines faibles.
   *
   * Il ne retire **rien de ce qui fait l'image** : le soleil bas, ses ombres
   * portées, le retrait des vitrages, les redans, le miroir d'eau — tout reste.
   * Ce qui tombe, ce sont les trois postes qui coûtent cher sans se voir à
   * cette échelle : la définition de la carte d'ombre, la finesse du ciel, et
   * les meneaux des deux petits côtés, qui ne sont jamais dans le cadre plus
   * de quelques degrés.
   *
   * C'est la bonne façon de dégrader. Couper l'ombre ou l'éclairage aurait
   * rendu vingt pour cent de plus et donné un autre bâtiment.
   */
  leger?: boolean;
}

export interface Edifice {
  scene: THREE.Scene;
  /** Hauteur totale hors tout, en mètres. Sert à cadrer la caméra. */
  hauteur: number;
  dispose(): void;
}

/* ================================================================= ciel === */

/**
 * Le ciel, en dégradé vertical.
 *
 * Une sphère retournée avec un dégradé peint dans les sommets : deux
 * triangles de coût, et c'est ce qui donne au bâtiment un fond qui varie du
 * haut au bas. Un fond uni, si beau soit-il, aplatit une silhouette — il n'y a
 * plus de haut ni de bas dans l'image.
 */
function ciel(disposables: Bin[], leger: boolean): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(600, leger ? 20 : 32, leger ? 14 : 24);
  const position = geometry.getAttribute('position');
  const couleur = new Float32Array(position.count * 3);
  const haut = new THREE.Color(0x38536f);
  const horizon = new THREE.Color(TON.horizon);
  const bas = new THREE.Color(0x76736d);
  const teinte = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const u = position.getY(i) / 600;
    /* L'exposant décide de la hauteur à laquelle le ciel devient bleu. À
       0,62 le bleu n'arrivait qu'au zénith, et un cadrage d'architecture — qui
       regarde à peine au-dessus de l'horizontale — ne voyait qu'un aplat pâle.
       À 0,34, le dégradé travaille dans le tiers bas du ciel, c'est-à-dire
       dans le cadre. */
    if (u >= 0) teinte.copy(horizon).lerp(haut, Math.pow(u, 0.34));
    else teinte.copy(horizon).lerp(bas, Math.pow(-u, 0.8));
    couleur[i * 3] = teinte.r;
    couleur[i * 3 + 1] = teinte.g;
    couleur[i * 3 + 2] = teinte.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(couleur, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    /* Le ciel ne prend pas la brume. C'est évident une fois écrit et cela ne
       l'était pas : la brume est linéaire et la sphère est à six cents mètres,
       donc sans cette ligne le dégradé disparaît sous un aplat de la couleur
       de l'horizon, et on a passé une heure à se demander où était passé le
       ciel qu'on venait de peindre. */
    fog: false,
  });
  disposables.push(geometry, material);
  return new THREE.Mesh(geometry, material);
}

/* ============================================================= construction === */

/**
 * Monte l'édifice.
 *
 * L'ordre est celui d'un chantier, et ce n'est pas une coquetterie : chaque
 * étage a besoin de l'empreinte du précédent pour savoir où poser sa terrasse.
 */
export function buildEdifice(
  renderer?: THREE.WebGLRenderer | null,
  options: OptionsEdifice = {},
): Edifice {
  const leger = options.leger === true;
  const bin: Bin[] = [];
  const scene = new THREE.Scene();

  /*
   * La brume, et pourquoi elle change tout.
   *
   * Sans elle, la scène est faite de deux aplats qui se touchent : un sol et
   * un ciel, séparés par une arête nette. Aucun paysage ne ressemble à cela —
   * l'air est un matériau, il blanchit ce qui est loin, et c'est cette
   * dégradation-là qui donne à un bâtiment son échelle. Cent quatre-vingt-cinq
   * mètres de franchise, sept cent vingt de portée : la franchise est réglée
   * sur le plan le plus lointain de la page — cent quarante-deux mètres de
   * rayon, plus la demi-diagonale du bâtiment — pour que la façade reste
   * franche partout et que seul le parvis se perde.
   *
   * La couleur est **exactement** celle de l'horizon du ciel. Un ton de brume
   * qui s'en écarte de deux points recrée la ligne qu'on cherchait à effacer.
   */
  scene.fog = new THREE.Fog(TON.horizon, 185, 720);

  const voute = ciel(bin, leger);

  const mat = (color: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    bin.push(material);
    return material;
  };
  const beton = mat(TON.beton, 0.92);
  const soffite = mat(TON.soffite, 0.94);
  const refend = mat(TON.refend, 0.93);
  const meneau = mat(TON.meneau, 0.62, { metalness: 0.25 });
  const parvis = mat(TON.parvis, 0.95);
  const vegetal = mat(TON.vegetal, 0.96);
  /* Le verre est le seul matériau de la scène à porter du spéculaire. C'est
     voulu : dans une façade toute mate, c'est lui qui dit où est le ciel, et
     sans lui l'immeuble redevient une maquette de carton. */
  const verre = mat(TON.verre, 0.1, { metalness: 0.55 });
  /* L'allège est le panneau plein qui masque la dalle et le faux plafond, sur
     un mètre de haut au bas de chaque vitrage. Sans elle, un mur-rideau est un
     aquarium : la façade n'a plus qu'une seule matière du sol au plafond, et
     c'est exactement ce qui trahit un immeuble modélisé. */
  const allege = mat(TON.allege, 0.42, { metalness: 0.5 });
  const tronc = mat(TON.tronc, 0.9);
  const garde = mat(TON.garde, 0.12, {
    metalness: 0.3,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    userData: { sansOmbre: true },
  });
  /* L'eau n'est pas un métal, et le lui dire change tout. Avec `metalness`
     à 0,55 elle rendait un rectangle noir posé sur le parvis : le métal éteint
     la diffuse et ne réfléchit qu'à proportion de sa propre couleur, qui est
     sombre. À zéro, la réflexion suit Fresnel — presque rien de face, un
     miroir en rasant — et c'est exactement le comportement d'un bassin vu de
     loin, qui est la seule façon dont on le voit ici. */
  const eau = mat(TON.eau, 0.03, { metalness: 0 });

  const lot = new Lot();
  const groupe = new THREE.Group();
  const M = new THREE.Matrix4();
  const pose = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => lot.add(geometry, material, M.makeTranslation(x, y, z));

  /* ------------------------------------------------------------- socle --- */
  /*
   * Deux niveaux plus larges que la tour, et une retombée profonde au-dessus.
   *
   * Le socle n'est pas du décor : c'est lui qui pose le bâtiment au sol. Une
   * tour qui touche le parvis sans transition a l'air d'y avoir été déposée,
   * et c'est le défaut le plus courant des immeubles modélisés. L'ombre portée
   * de la retombée fait à elle seule la moitié du travail.
   */
  const s0 = empreinte(0);
  pose(new THREE.BoxGeometry((s0.hx + TRAME) * 2, 0.5, (s0.hz + TRAME) * 2), beton, 0, SOCLE, 0);
  pose(new THREE.BoxGeometry((s0.hx + TRAME) * 2 - 0.9, 0.42, (s0.hz + TRAME) * 2 - 0.9), soffite, 0, SOCLE - 0.34, 0);
  // Les refends du socle : on laisse le rez très ouvert, six blocs seulement.
  for (const [x, z] of [
    [-s0.hx + TRAME, -s0.hz],
    [0, -s0.hz],
    [s0.hx - TRAME, -s0.hz],
    [-s0.hx + TRAME, s0.hz],
    [0, s0.hz],
    [s0.hx - TRAME, s0.hz],
  ] as const) {
    pose(new THREE.BoxGeometry(TRAME * 0.7, SOCLE - 0.25, TRAME * 0.7), refend, x, (SOCLE - 0.25) / 2, z);
  }
  // Le vitrage du rez, en retrait derrière les refends.
  pose(
    new THREE.BoxGeometry(s0.hx * 2 - TRAME, SOCLE - 0.9, s0.hz * 2 - TRAME),
    verre,
    0,
    (SOCLE - 0.9) / 2 + 0.2,
    0,
  );

  /* ------------------------------------------------------------ étages --- */
  let sommet = SOCLE + 0.25;
  for (let niveau = 0; niveau < NIVEAUX; niveau += 1) {
    const e = empreinte(niveau);
    const bas = sommet;
    const dalle = bas + ETAGE - NEZ;

    /* Le bandeau vitré, en retrait de vingt centimètres derrière le nez de
       dalle. Ce retrait est tout : à fleur, la façade est un aplat ; en
       retrait, chaque étage porte sa propre ligne d'ombre, et c'est cette
       ligne qui donne l'échelle du bâtiment à cent mètres. */
    pose(
      new THREE.BoxGeometry(e.hx * 2 - 0.4, ETAGE - NEZ, e.hz * 2 - 0.4),
      verre,
      e.dx,
      bas + (ETAGE - NEZ) / 2,
      0,
    );

    /* Les allèges, plaquées devant le bas du vitrage, trois centimètres en
       avant pour ne pas se battre avec lui en profondeur. Quatre plaques par
       étage : c'est ce qui donne à la façade sa ligne horizontale sombre juste
       au-dessus de chaque dalle, et à l'immeuble son étagement. */
    const ALLEGE = 1.05;
    for (const z of [-e.hz + 0.17, e.hz - 0.17]) {
      pose(new THREE.BoxGeometry(e.hx * 2 - 0.4, ALLEGE, 0.06), allege, e.dx, bas + ALLEGE / 2, z);
    }
    for (const x of [e.dx - e.hx + 0.17, e.dx + e.hx - 0.17]) {
      pose(new THREE.BoxGeometry(0.06, ALLEGE, e.hz * 2 - 0.4), allege, x, bas + ALLEGE / 2, 0);
    }

    // Le nez de dalle, qui déborde de vingt centimètres.
    pose(new THREE.BoxGeometry(e.hx * 2 + 0.4, NEZ, e.hz * 2 + 0.4), beton, e.dx, dalle + NEZ / 2, 0);
    pose(
      new THREE.BoxGeometry(e.hx * 2 + 0.1, 0.16, e.hz * 2 + 0.1),
      soffite,
      e.dx,
      dalle - 0.08,
      0,
    );

    /* La résille : un meneau toutes les trames sur les deux longs côtés.
       C'est la seule répétition assumée de la façade, et elle est
       indispensable — sans verticales, un bandeau vitré n'a pas d'échelle. */
    const colonnes = Math.round((e.hx * 2) / TRAME);
    for (let i = 0; i <= colonnes; i += 1) {
      const x = e.dx - e.hx + i * ((e.hx * 2) / colonnes);
      for (const z of [-e.hz - 0.02, e.hz + 0.02]) {
        pose(new THREE.BoxGeometry(0.16, ETAGE - NEZ, 0.3), meneau, x, bas + (ETAGE - NEZ) / 2, z);
      }
    }
    const rangs = leger ? 0 : Math.round((e.hz * 2) / TRAME);
    for (let i = 1; i < rangs; i += 1) {
      const z = -e.hz + i * ((e.hz * 2) / rangs);
      for (const x of [e.dx - e.hx - 0.02, e.dx + e.hx + 0.02]) {
        pose(new THREE.BoxGeometry(0.3, ETAGE - NEZ, 0.16), meneau, x, bas + (ETAGE - NEZ) / 2, z);
      }
    }

    /* La terrasse dégagée par le redan, avec son garde-corps de verre et sa
       jardinière. C'est ce qu'on achète dans ce type de bâtiment, donc c'est
       ce qui doit se voir. */
    const suivant = niveau + 1 < NIVEAUX ? empreinte(niveau + 1) : null;
    if (suivant && suivant.hx < e.hx) {
      const bordAncien = e.dx + e.hx;
      const bordNeuf = suivant.dx + suivant.hx;
      const large = bordAncien - bordNeuf;
      const cx = bordNeuf + large / 2;
      pose(new THREE.BoxGeometry(large, 0.12, suivant.hz * 2), beton, cx, dalle + NEZ + 0.06, 0);
      pose(
        new THREE.BoxGeometry(0.09, 1.05, suivant.hz * 2),
        garde,
        bordAncien - 0.2,
        dalle + NEZ + 0.6,
        0,
      );
      /* Une jardinière **filante**, et non trois bacs espacés : posés au
         hasard sur une dalle, trois bacs se lisent de haut comme trois
         gommettes vertes. Une bande continue le long du garde-corps se lit
         comme une plantation, ce qu'elle est. */
      const bac = large * 0.34;
      pose(
        new THREE.BoxGeometry(bac + 0.18, 0.62, suivant.hz * 1.74 + 0.18),
        beton,
        bordAncien - 0.75 - bac / 2,
        dalle + NEZ + 0.31,
        0,
      );
      pose(
        new THREE.BoxGeometry(bac, 0.5, suivant.hz * 1.74),
        vegetal,
        bordAncien - 0.75 - bac / 2,
        dalle + NEZ + 0.5,
        0,
      );
      // La main courante : c'est elle qui rend un garde-corps de verre visible.
      pose(
        new THREE.BoxGeometry(0.12, 0.07, suivant.hz * 2),
        meneau,
        bordAncien - 0.2,
        dalle + NEZ + 1.12,
        0,
      );
    }

    sommet = dalle + NEZ;
  }

  /* ------------------------------------------------------ couronnement --- */
  /* Une retombée pleine au sommet, plus haute qu'un simple acrotère : elle
     ferme la silhouette. Un bâtiment qui s'arrête sur son dernier plancher a
     toujours l'air inachevé. */
  /*
   * Un acrotère creux, et une toiture en creux derrière lui.
   *
   * La première version posait un couvercle plein sur le dernier plancher :
   * vu d'en haut, l'immeuble finissait par une grande boîte beige, et c'était
   * la faute la plus visible de toute la scène. Un vrai couronnement est un
   * **muret périphérique** — quatre pans, rien au milieu — derrière lequel la
   * toiture est plus basse que le bord. C'est ce décalage de quarante
   * centimètres qui fait qu'un toit se lit comme un toit et non comme un
   * capot.
   */
  const haut = empreinte(NIVEAUX - 1);
  const ACROTERE = 1.25;
  const EPAIS = 0.36;
  for (const z of [-haut.hz - 0.25 + EPAIS / 2, haut.hz + 0.25 - EPAIS / 2]) {
    pose(
      new THREE.BoxGeometry(haut.hx * 2 + 0.5, ACROTERE, EPAIS),
      beton,
      haut.dx,
      sommet + ACROTERE / 2,
      z,
    );
  }
  for (const x of [haut.dx - haut.hx - 0.25 + EPAIS / 2, haut.dx + haut.hx + 0.25 - EPAIS / 2]) {
    pose(
      new THREE.BoxGeometry(EPAIS, ACROTERE, haut.hz * 2 + 0.5 - EPAIS * 2),
      beton,
      x,
      sommet + ACROTERE / 2,
      0,
    );
  }
  // La couverture, en creux de quarante centimètres derrière l'acrotère.
  pose(
    new THREE.BoxGeometry(haut.hx * 2 + 0.5 - EPAIS * 2, 0.22, haut.hz * 2 + 0.5 - EPAIS * 2),
    soffite,
    haut.dx,
    sommet + 0.11,
    0,
  );
  // Les édicules techniques, décalés vers l'arrière : une toiture parfaitement
  // nue est aussi fausse qu'un couvercle.
  pose(new THREE.BoxGeometry(TRAME * 2.4, 1.5, TRAME * 1.8), soffite, haut.dx - TRAME * 1.6, sommet + 0.97, -TRAME);
  pose(new THREE.BoxGeometry(TRAME * 1.2, 0.9, TRAME * 1.2), refend, haut.dx + TRAME, sommet + 0.67, TRAME * 1.2);
  /* La hauteur est mesurée ici sur la géométrie effectivement montée, et non
     reprise du calcul de `lib/residence.ts` : c'est elle qui cadre la caméra,
     et une caméra cadrée sur un chiffre théorique déborde le jour où la
     géométrie change. Que les deux tombent juste est vérifié par test. */
  const hauteur = sommet + 2.1;

  /* ------------------------------------------------------------ parvis --- */
  /* Le sol va jusqu'à la brume. Deux cent quarante mètres laissaient une
     arête franche en travers du ciel dès qu'on prenait un peu de hauteur —
     l'immeuble était posé sur une plaque, et on voyait le bord de la plaque.
     Neuf cents mètres, et la brume s'en charge bien avant. */
  pose(new THREE.BoxGeometry(900, 0.4, 900), parvis, 0, -0.2, 0);
  /* Le miroir d'eau, décalé du bâtiment. Il ne sert pas à faire joli : c'est
     la seule surface horizontale réfléchissante de la scène, donc la seule qui
     renvoie le ciel au sol et fasse tenir le bâtiment dans son terrain. */
  pose(new THREE.BoxGeometry(s0.hx * 2.4, 0.06, 14), eau, -6, 0.02, s0.hz + 17);
  pose(new THREE.BoxGeometry(s0.hx * 2.4 + 1.4, 0.12, 15.4), parvis, -6, -0.02, s0.hz + 17);
  /*
   * Les arbres.
   *
   * Une sphère sur un bâton donne une sucette, et quatre sucettes autour d'un
   * immeuble suffisent à faire basculer toute la scène du côté de la maquette
   * d'architecte scolaire. La couronne est donc faite de quatre masses
   * décalées, de rayons inégaux — c'est le même remède que pour les plantes
   * des intérieurs, et il tient à une seule chose : **une silhouette
   * irrégulière**. Le feuillage n'a pas besoin d'être détaillé, il a besoin de
   * ne pas être une primitive reconnaissable.
   */
  for (const [x, z, r] of [
    [-s0.hx - 9, s0.hz + 6, 2.6],
    [s0.hx + 11, s0.hz + 9, 3.1],
    [s0.hx + 7, -s0.hz - 11, 2.2],
    [-s0.hx - 13, -s0.hz - 7, 2.8],
    [-s0.hx - 24, s0.hz + 21, 3.4],
    [s0.hx + 26, -s0.hz - 19, 2.9],
  ] as const) {
    pose(new THREE.CylinderGeometry(0.17, 0.26, 4.6, 7), tronc, x, 2.3, z);
    const pied = 4.6 + r * 0.55;
    for (const [dx, dy, dz, k] of [
      [0, 0, 0, 1],
      [r * 0.52, r * 0.34, -r * 0.28, 0.72],
      [-r * 0.46, r * 0.2, r * 0.4, 0.66],
      [r * 0.16, -r * 0.32, r * 0.5, 0.58],
    ] as const) {
      pose(new THREE.SphereGeometry(r * k, leger ? 7 : 10, leger ? 6 : 8), vegetal, x + dx, pied + dy, z + dz);
    }
  }

  lot.flush(groupe, bin);
  scene.add(groupe);

  /* ----------------------------------------------------------- lumière --- */
  /*
   * Un soleil bas, et rien d'autre de directionnel.
   *
   * Bas, parce que c'est la seule hauteur de soleil qui donne à une façade sa
   * matière : à midi, un immeuble est un aplat surmonté d'un toit. À vingt
   * degrés, chaque nez de dalle porte son ombre sur le bandeau vitré qu'il
   * surplombe, et la façade se met à compter ses étages toute seule.
   */
  /* L'hémisphérique monte à 1,3 pour une raison précise : l'ombre portée du
     bâtiment sur le parvis. Elle est immense et parfaitement franche ; à 1,1
     elle tombait au noir et traversait le premier écran comme un aplat. Ce
     qu'on éclaire ici, ce n'est pas la façade, c'est le sol dans l'ombre. */
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x9d9890, 1.3));
  const soleil = new THREE.DirectionalLight(0xffe9c9, 2.6);
  /*
   * L'azimut du soleil se règle contre celui de la **caméra**, pas dans
   * l'absolu.
   *
   * Il valait −38°, et la caméra part de +34° : le soleil était derrière le
   * bâtiment pour tout le premier écran, qui montrait donc une silhouette
   * sombre sur un ciel clair. Une façade de béton qu'on ne voit qu'à
   * contre-jour n'a plus ni matière ni couleur, et tout le travail sur les nez
   * de dalle est perdu.
   *
   * À +18°, le grand côté que la caméra a devant elle au premier écran prend
   * le soleil de plein fouet et l'autre reste dans une lumière rasante : c'est
   * le contraste qui modèle le volume. Les derniers plans, eux, tournent vers
   * l'ombre — et c'est bien ainsi, la page s'y assombrit aussi.
   */
  const azimut = (18 * Math.PI) / 180;
  const site = (26 * Math.PI) / 180;
  const portee = 140;
  soleil.position.set(
    Math.cos(azimut) * Math.cos(site) * portee,
    Math.sin(site) * portee,
    Math.sin(azimut) * Math.cos(site) * portee,
  );
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(leger ? 1024 : 2048, leger ? 1024 : 2048);
  const cam = soleil.shadow.camera;
  cam.left = -70;
  cam.right = 70;
  cam.top = 90;
  cam.bottom = -20;
  cam.near = 40;
  cam.far = 320;
  cam.updateProjectionMatrix();
  /* Le biais est négatif et minuscule : une façade de verre presque tangente
     au soleil produit sinon des bandes d'ombre en escalier sur elle-même. */
  soleil.shadow.bias = -0.0006;
  soleil.shadow.normalBias = 0.06;
  scene.add(soleil);
  scene.add(soleil.target);

  /* Une lumière de renvoi, froide, sans ombre : c'est le ciel qui rentre sous
     les retombées. Sans elle, toutes les sous-faces sont noires et le bâtiment
     se lit comme un empilement de plaques. */
  const renvoi = new THREE.DirectionalLight(0xc9d8e6, 0.55);
  renvoi.position.set(-90, 30, 70);
  scene.add(renvoi);

  /*
   * Le ciel sert deux fois : on le regarde, et on s'y reflète.
   *
   * C'était le défaut central de la première version. Le verre y était donné
   * pour lisse — rugosité 0,14, métallique — mais sans environnement, une
   * surface lisse ne reflète *rien* : elle rend sa couleur propre, en plus
   * sombre. La façade entière tombait au noir et se lisait comme une grille de
   * parking. On construit donc une carte d'environnement à partir de la voûte
   * elle-même : le verre y prend le dégradé du ciel, clair vers le bas de
   * l'image et bleu vers le haut, et redevient du verre.
   *
   * La voûte est mise seule dans une scène le temps de la prise, sans quoi le
   * bâtiment se refléterait dans son propre vitrage.
   */
  let cible: THREE.WebGLRenderTarget | null = null;
  if (renderer) {
    const seul = new THREE.Scene();
    seul.add(voute);
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    cible = pmrem.fromScene(seul, 0.04, 1, 1000);
    pmrem.dispose();
    scene.environment = cible.texture;
    /* Assez pour que le verre reflète, pas assez pour délaver le béton : au
       delà de 0,8 les sous-faces s'éclaircissent et le bâtiment perd ses
       ombres propres. */
    scene.environmentIntensity = 0.7;
    renderer.shadowMap.enabled = true;
    /* Le filtrage doux coûte plus cher par pixel — mais la carte d'ombre,
       elle, n'est calculée qu'une fois (voir `Edifice.tsx`), et une ombre de
       cinquante mètres de long dessinée au pixel près trahit le rendu de
       synthèse plus sûrement que n'importe quel autre défaut. */
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  scene.add(voute);

  return {
    scene,
    hauteur,
    dispose() {
      for (const item of bin) item.dispose();
      cible?.dispose();
    },
  };
}
