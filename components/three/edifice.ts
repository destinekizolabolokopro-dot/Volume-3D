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
import {
  APPARTEMENT,
  ATRIUM,
  ETAGE,
  HALL as COTES,
  NEZ,
  NIVEAUX,
  RETRAIT,
  SOCLE,
  TRAME,
  altitudeNiveau,
  empreinte,
} from '@/lib/residence';

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
  /** Le halo autour du soleil, à l'horizon. */
  halo: 0xffe0b4,

  /* ------------------------------------------------------------ le hall ---
     La caméra finit **dedans**. Le rez cesse donc d'être une boîte de verre
     vue du dehors et devient une pièce : un sol qu'on voit de près, un
     plafond au-dessus de la tête, et des matières qu'on regarde à deux
     mètres. C'est le seul endroit de la scène où le nuancier se réchauffe —
     un hall d'immeuble est un intérieur, et un intérieur gris est un parking. */
  /** Le sol du hall : pierre claire polie. */
  pierre: 0xb8b3aa,
  /** Le marbre du comptoir et du mur de fond. */
  marbre: 0xd2ccc0,
  /** Le bois du comptoir et des banquettes. */
  bois: 0x7c6851,
  /** Les fûts des colonnes. */
  fut: 0x8e8b85,
  /** Le parquet du séjour. */
  parquet: 0x9a7f5f,
  /** Les textiles clairs : assises, tapis, rideaux. */
  lin: 0xc4bcae,
  /** Les masses bâties du lointain. */
  lointain: 0x8e8c88,
  /** Les silhouettes du hall. */
  gens: 0x3b3f44,
  /**
   * La pierre sombre des joues de l'atrium.
   *
   * Sombre, et c'est le point. Le puits n'a ni soleil ni ombre portée — la
   * carte d'ombre est gelée et la lumière du dehors n'y entre pas. Tout y est
   * éclairé par la carte d'environnement, c'est-à-dire de partout à la fois et
   * presque également : le relief ne peut donc **pas** venir de l'éclairage.
   * Il ne reste que la matière. Des joues claires donnaient quarante-trois
   * mètres de blanc uniforme où l'on ne distinguait ni les nervures, ni les
   * bandeaux, ni les coursives ; on a cherché la faute dans la géométrie et
   * dans la profondeur de champ avant de comprendre qu'elle était dans le
   * nuancier.
   */
  puits: 0x5c5e5d,
  /** Les corniches lumineuses du plafond. Volontairement en deçà du blanc :
      un matériau basique traverse quand même la courbe de tonalité, et un
      0xfff3e0 y ressort en blanc pur — c'est-à-dire en trou dans l'image. */
  lueur: 0xcbbda6,
} as const;

/* =============================================================== soleil === */

/**
 * La direction du soleil, en un seul endroit.
 *
 * Elle sert deux fois : à poser la lumière, et à peindre son halo dans le
 * ciel. Les deux doivent tomber au même degré près — un halo qui ne coïncide
 * pas avec l'ombre portée est le genre de faute qu'on ne sait pas nommer mais
 * qu'on voit tout de suite.
 */
const SOLEIL = { azimut: 18, site: 15 } as const;

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
  /** Le nom gravé sur le mur du hall. */
  nom?: string;
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
  const halo = new THREE.Color(TON.halo);
  const teinte = new THREE.Color();

  /*
   * Le halo du soleil.
   *
   * Un dégradé purement vertical donne un ciel de studio : la lumière vient de
   * partout et de nulle part. Il manque **l'endroit d'où elle vient**. On
   * ajoute donc une tache chaude autour de la direction du soleil, qui décroît
   * sur une quarantaine de degrés — c'est elle qu'on voit à droite du bâtiment
   * dans les rendus d'heure dorée, et c'est aussi elle que le verre reflète,
   * puisque la carte d'environnement est fabriquée à partir de cette voûte.
   */
  const az = (SOLEIL.azimut * Math.PI) / 180;
  const si = (SOLEIL.site * Math.PI) / 180;
  const vers = new THREE.Vector3(
    Math.cos(az) * Math.cos(si),
    Math.sin(si),
    Math.sin(az) * Math.cos(si),
  );
  const dir = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    const u = position.getY(i) / 600;
    /* L'exposant décide de la hauteur à laquelle le ciel devient bleu. À
       0,62 le bleu n'arrivait qu'au zénith, et un cadrage d'architecture — qui
       regarde à peine au-dessus de l'horizontale — ne voyait qu'un aplat pâle.
       À 0,34, le dégradé travaille dans le tiers bas du ciel, c'est-à-dire
       dans le cadre. */
    if (u >= 0) teinte.copy(horizon).lerp(haut, Math.pow(u, 0.34));
    else teinte.copy(horizon).lerp(bas, Math.pow(-u, 0.8));

    dir.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
    const proche = Math.max(0, dir.dot(vers));
    /* La puissance seize donne un halo d'environ quarante degrés : assez large
       pour éclairer un quart de ciel, assez serré pour qu'on sache où est le
       soleil. Plafonné à 0,85 — un halo qui sature à blanc pur devient une
       lampe, et une lampe dans un ciel se voit comme un défaut. */
    teinte.lerp(halo, Math.min(0.85, Math.pow(proche, 16)));

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

/* ============================================================== enseigne === */

/**
 * Le nom du projet, sur le mur du hall.
 *
 * C'est la seule texture de toute la scène, et elle mérite qu'on dise
 * pourquoi. Le dépôt a retiré ses cartes de relief l'une après l'autre :
 * simuler du crépi ou des lames de parquet avec une image, c'est faire passer
 * une photographie pour de la géométrie, et cela se voit. Un logotype ne pose
 * pas la même question — **c'est déjà du dessin**. Le graver en volume
 * demanderait une police vectorielle et une extrusion par lettre pour un
 * résultat qu'on ne distingue pas, à trois mètres, d'un lettrage peint.
 *
 * La police n'est pas forcément chargée quand on dessine : on peint une
 * première fois avec ce qui est disponible, puis on repeint quand
 * `document.fonts` a fini. Un canevas de mille vingt-quatre pixels de large
 * pour un panneau de neuf mètres soixante, soit un peu plus de cent points par
 * mètre — largement au-dessus de ce que la caméra approche.
 */
function enseigne(disposables: Bin[], nom: string): THREE.MeshBasicMaterial | null {
  if (typeof document === 'undefined') return null;
  const toile = document.createElement('canvas');
  toile.width = 1024;
  toile.height = 256;
  const ctx = toile.getContext('2d');
  if (!ctx) return null;

  const peindre = () => {
    ctx.clearRect(0, 0, toile.width, toile.height);
    ctx.fillStyle = '#f4f1ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 128px Inter, system-ui, sans-serif';
    /* L'interlettrage large est ce qui fait la différence entre un mot et une
       enseigne. Le canevas n'a pas de `letter-spacing` : on pose les lettres
       une par une. */
    const lettres = [...nom];
    const chasse = lettres.map((l) => ctx.measureText(l).width);
    const jeu = 46;
    const total = chasse.reduce((a, b) => a + b, 0) + jeu * (lettres.length - 1);
    let x = toile.width / 2 - total / 2;
    for (let i = 0; i < lettres.length; i += 1) {
      ctx.fillText(lettres[i], x + chasse[i] / 2, toile.height / 2);
      x += chasse[i] + jeu;
    }
  };
  peindre();

  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  document.fonts?.ready?.then(() => {
    peindre();
    texture.needsUpdate = true;
  });

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  material.userData = { sansOmbre: true };
  disposables.push(texture, material);
  return material;
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
  /* Deux voisines du verre principal, à quelques points près. C'est assez pour
     que la façade cesse d'être régulière, trop peu pour qu'on voie un damier. */
  const verreClair = mat(0x76838d, 0.12, { metalness: 0.45 });
  const verreSombre = mat(0x47535c, 0.09, { metalness: 0.6 });
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

  /* ---------------------------------------------------- matières du hall ---
     Le vitrage du rez est le seul de la scène à être **traversé** par la
     caméra, et le seul qu'on voie des deux côtés. Il est donc transparent
     pour de bon — on doit deviner le hall éclairé depuis le parvis — et il ne
     porte pas d'ombre : un mur-rideau qui projette une ombre pleine à
     l'intérieur du hall le plongerait dans le noir. */
  const vitrine = mat(0x8fa2ad, 0.06, {
    metalness: 0.2,
    opacity: 0.3,
    transparent: true,
    userData: { sansOmbre: true },
  });
  const pierre = mat(TON.pierre, 0.2, { metalness: 0.04 });
  const parquet = mat(TON.parquet, 0.66);
  const lin = mat(TON.lin, 0.86);
  const lointain = mat(TON.lointain, 0.95);
  /* Les silhouettes du hall sont mates et sombres, et c'est un choix, pas un
     raccourci. Le dépôt a déjà appris cette leçon sur les intérieurs : une
     figure humaine à laquelle on essaie de donner un visage tombe dans la
     vallée dérangeante à la première image. Une silhouette d'à-plat, elle, est
     la convention de tous les rendus d'architecture depuis cinquante ans — on
     y lit une personne, une échelle, une vie, et rien de faux. */
  const gens = mat(TON.gens, 0.88);
  const puits = mat(TON.puits, 0.72, { metalness: 0.03 });
  const marbre = mat(TON.marbre, 0.24, { metalness: 0.03 });
  const bois = mat(TON.bois, 0.62);
  const fut = mat(TON.fut, 0.55, { metalness: 0.05 });
  /* Les corniches lumineuses sont un matériau **basique** : elles ne
     reçoivent pas la lumière, elles la donnent. Une source lumineuse rendue
     avec un matériau qui s'assombrit dans l'ombre n'est pas une source. */
  const lueur = new THREE.MeshBasicMaterial({ color: TON.lueur, fog: false });
  lueur.userData = { sansOmbre: true };
  bin.push(lueur);
  /* Le jour vu depuis le fond d'un puits de quarante-trois mètres : clair,
     froid, et bien en deçà du blanc. */
  const ciel_haut = new THREE.MeshBasicMaterial({ color: 0x9aa6ad, fog: false });
  ciel_haut.userData = { sansOmbre: true };
  bin.push(ciel_haut);

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

  /*
   * Une plaque percée par l'atrium.
   *
   * C'est la fonction qui a coûté le plus cher à trouver, et elle tient en
   * quinze lignes. Le puits était monté — murs, nervures, coursives, verrière,
   * vingt mille triangles au compteur — et la caméra, placée en plein milieu,
   * ne voyait qu'un aplat gris. On a soupçonné la profondeur de champ, puis le
   * nuancier, puis la puissance des lampes ; le tir de rayon a fini par
   * répondre : sous-face de dalle, **à un mètre soixante-dix**.
   *
   * Chaque niveau pose en effet deux plaques pleines aux dimensions du
   * plancher — le nez de dalle et sa sous-face — et douze plaques pleines
   * referment un vide aussi sûrement que douze planchers. Percer les murs
   * autour d'un vide ne suffit pas : il faut percer **tout ce qui le
   * traverse**, et une plaque qui le traverse ne se voit pas dans le code, elle
   * se voit dans l'image.
   *
   * D'où cette fonction, qui remplace une plaque par les quatre morceaux qui
   * l'entourent dès qu'elle recouvre l'emprise du puits.
   */
  const percee = (
    materiau: THREE.Material,
    largeur: number,
    epaisseur: number,
    profondeur: number,
    cx: number,
    cy: number,
    cz: number,
  ) => {
    const x0 = cx - largeur / 2;
    const x1 = cx + largeur / 2;
    const z0 = cz - profondeur / 2;
    const z1 = cz + profondeur / 2;
    const dehors = x1 <= ATRIUM.x0 || x0 >= ATRIUM.x1 || z1 <= ATRIUM.z0 || z0 >= ATRIUM.z1;
    if (dehors) {
      pose(new THREE.BoxGeometry(largeur, epaisseur, profondeur), materiau, cx, cy, cz);
      return;
    }
    const morceau = (a: number, b: number, c: number, d: number) => {
      if (b - a < 0.01 || d - c < 0.01) return;
      pose(new THREE.BoxGeometry(b - a, epaisseur, d - c), materiau, (a + b) / 2, cy, (c + d) / 2);
    };
    const mx0 = Math.max(x0, ATRIUM.x0);
    const mx1 = Math.min(x1, ATRIUM.x1);
    morceau(x0, mx0, z0, z1);
    morceau(mx1, x1, z0, z1);
    morceau(mx0, mx1, z0, Math.max(z0, ATRIUM.z0));
    morceau(mx0, mx1, Math.min(z1, ATRIUM.z1), z1);
  };

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
  /* ------------------------------------------------------------- hall --- */
  /*
   * Le rez n'est plus une boîte, c'est une pièce.
   *
   * Tant que la caméra restait dehors, une seule boîte de verre suffisait :
   * on n'en voyait jamais que la face avant, et ce qu'il y avait derrière
   * n'existait pas. Le vol se termine maintenant **dedans**, et tout change —
   * il faut un sol qu'on regarde à deux mètres, un plafond au-dessus de la
   * tête, une porte par laquelle passer, et de la lumière qui vienne de
   * l'intérieur.
   *
   * Les cotes tiennent en trois nombres : 30,60 m sur 19,80 m dans œuvre, et
   * 5,43 m sous plafond. C'est grand, et c'est le sujet — un hall d'immeuble
   * de standing se mesure à sa hauteur libre bien plus qu'à sa surface.
   */
  /* Les cotes du hall viennent de `lib/residence.ts`, comme la trame : la
     caméra doit s'arrêter entre ces murs-là, et c'est vérifié par test. */
  const IX = COTES.hx;
  const IZ = COTES.hz;
  /** Hauteur libre sous le plafond du hall. */
  const HALL = COTES.haut;
  /** Hauteur du vitrage ; au-dessus, une retombée pleine. */
  const VITRE = 4.9;
  /** Demi-largeur de la porte, sur la face +x. C'est par là qu'on entre. */
  const PORTE = COTES.porte;
  /** Hauteur du linteau de la porte. */
  const LINTEAU = 3.9;

  // Le sol, débordant légèrement pour couvrir le seuil.
  pose(new THREE.BoxGeometry(IX * 2 + 0.6, 0.44, IZ * 2 + 0.6), pierre, 0, 0, 0);
  /* Le plafond, **percé**. Le vide de l'atrium le traverse, et c'est par là
     que le vol quitte le hall : on ne peut pas monter à travers une dalle.
     Quatre morceaux autour du trou plutôt qu'un panneau entier. */
  const trou = { x0: ATRIUM.x0, x1: ATRIUM.x1, z0: ATRIUM.z0, z1: ATRIUM.z1 };
  percee(soffite, IX * 2, 0.14, IZ * 2, 0, HALL - 0.07, 0);

  /* Le mur du fond, en marbre. Il ferme la perspective du vol : la caméra
     s'arrête devant lui, et c'est lui qui porte le nom du projet. Sans mur, le
     hall serait traversant et le dernier plan donnerait sur le parvis d'en
     face, c'est-à-dire sur rien.
     Il est cannelé — un refend tous les quatre-vingt-dix centimètres, saillant
     de six. C'est peu, et c'est tout ce qu'il faut : un mur plein rendu sans
     relief reçoit la lumière d'un bloc et redevient un aplat gris, quelle que
     soit sa matière. Les cannelures lui donnent une trame d'ombres, donc une
     échelle, donc une matière. */
  pose(new THREE.BoxGeometry(0.32, HALL, IZ * 2), marbre, -IX + 0.16, HALL / 2, 0);
  for (let i = -10; i <= 10; i += 1) {
    pose(new THREE.BoxGeometry(0.06, HALL - 0.3, 0.1), marbre, -IX + 0.35, (HALL - 0.3) / 2, i * 0.92);
  }

  /* Les vitrages, panneau par panneau. La face +x est percée : deux jouées,
     une imposte au-dessus de la porte. Les faces ±z sont pleine hauteur. */
  const glace = (w: number, h: number, x: number, y: number, z: number, selonZ: boolean) =>
    pose(
      selonZ ? new THREE.BoxGeometry(0.08, h, w) : new THREE.BoxGeometry(w, h, 0.08),
      vitrine,
      x,
      y,
      z,
    );
  for (const z of [-IZ, IZ]) glace(IX * 2, VITRE, 0, VITRE / 2, z, false);
  for (const cote of [-1, 1]) {
    const large = IZ - PORTE;
    glace(large, VITRE, IX, VITRE / 2, cote * (PORTE + large / 2), true);
  }
  glace(PORTE * 2, VITRE - LINTEAU, IX, (VITRE + LINTEAU) / 2, 0, true);

  /* Les meneaux du rez : un tous les 1,80 m, comme partout ailleurs. C'est ce
     qui raccroche le socle à la trame de la tour ; sans eux, le rez est une
     vitrine et la tour un immeuble. */
  /* Un meneau toutes les **deux** trames, et non toutes les trames comme en
     façade courante. La caméra passe à deux mètres de ce vitrage-là : au pas
     de 1,80 m, la première version donnait une palissade de montants dans
     laquelle le hall disparaissait. À 3,60 m, on lit encore la trame et on
     voit à travers. */
  for (let i = -4; i <= 4; i += 1) {
    const x = i * TRAME * 2;
    if (Math.abs(x) > IX - 0.2) continue;
    for (const z of [-IZ, IZ]) {
      pose(new THREE.BoxGeometry(0.1, VITRE, 0.18), meneau, x, VITRE / 2, z);
    }
  }
  for (let i = -2; i <= 2; i += 1) {
    const z = i * TRAME * 2;
    if (Math.abs(z) > IZ - 0.2 || Math.abs(z) < PORTE - 0.2) continue;
    pose(new THREE.BoxGeometry(0.18, VITRE, 0.1), meneau, IX, VITRE / 2, z);
  }
  // Les deux montants de la porte, plus épais : ce sont eux qui la dessinent.
  for (const cote of [-1, 1]) {
    pose(new THREE.BoxGeometry(0.3, LINTEAU, 0.3), meneau, IX, LINTEAU / 2, cote * PORTE);
  }
  pose(new THREE.BoxGeometry(0.3, 0.18, PORTE * 2), meneau, IX, LINTEAU, 0);

  /* La marquise. Elle sort de quatre mètres au-dessus du seuil, et sa
     sous-face porte une ligne de lumière : c'est le premier détail que la
     caméra traverse, à un mètre au-dessus de l'objectif. */
  pose(new THREE.BoxGeometry(4.4, 0.34, PORTE * 2 + 3.4), beton, IX + 2.2, LINTEAU + 0.6, 0);
  pose(new THREE.BoxGeometry(4.0, 0.1, PORTE * 2 + 3.0), soffite, IX + 2.2, LINTEAU + 0.38, 0);
  pose(new THREE.BoxGeometry(2.6, 0.06, PORTE * 2 + 1.2), lueur, IX + 2.2, LINTEAU + 0.33, 0);
  // Le seuil : un tapis de pierre plus sombre, qui marque l'entrée au sol.
  pose(new THREE.BoxGeometry(5.0, 0.06, PORTE * 2 + 2.0), refend, IX + 2.4, 0.23, 0);

  /* Les colonnes. Quatre fûts qui rythment la profondeur du hall — c'est ce
     qui empêche la pièce d'être un hangar, et c'est surtout ce qui donne à la
     caméra quelque chose à dépasser en entrant. Sans premier plan qui défile,
     un travelling n'a pas de vitesse. */
  for (const x of [-3.0, 5.4]) {
    for (const z of [-4.6, 4.6]) {
      pose(new THREE.CylinderGeometry(0.44, 0.44, HALL, leger ? 10 : 18), fut, x, HALL / 2, z);
      pose(new THREE.BoxGeometry(1.3, 0.14, 1.3), marbre, x, 0.29, z);
    }
  }

  /* Les corniches lumineuses : quatre lignes continues dans le plafond. Elles
     ne portent pas la lumière du hall — ce sont les lampes qui s'en chargent —
     mais elles disent d'où elle vient, et une lumière dont on ne voit pas la
     source paraît toujours fausse. */
  /* Les corniches ne courent plus d'un bout à l'autre : elles s'arrêtent au
     bord du vide, sinon elles le traversaient en flottant dans l'air. */
  for (const z of [-7.4, -2.6, 2.6, 7.4]) {
    const coupe = z > trou.z0 && z < trou.z1;
    const x0 = coupe ? trou.x1 : -IX + 1.5;
    const x1 = IX - 1.5;
    pose(new THREE.BoxGeometry(x1 - x0, 0.05, 0.44), lueur, (x0 + x1) / 2, HALL - 0.16, z);
    pose(new THREE.BoxGeometry(x1 - x0 + 0.4, 0.22, 0.9), soffite, (x0 + x1) / 2, HALL - 0.24, z);
  }

  /* Le comptoir, décalé de l'axe. Posé au milieu, il barre la perspective et
     la caméra lui rentre dedans ; décalé, il devient ce devant quoi on passe. */
  pose(new THREE.BoxGeometry(1.15, 1.12, 7.2), bois, -8.6, 0.79, -4.2);
  pose(new THREE.BoxGeometry(1.45, 0.09, 7.5), marbre, -8.6, 1.39, -4.2);
  pose(new THREE.BoxGeometry(0.9, 0.05, 6.6), lueur, -8.6, 0.28, -4.2);

  // Deux banquettes basses, du côté opposé au comptoir.
  for (const z of [3.2, 6.4]) {
    pose(new THREE.BoxGeometry(2.2, 0.42, 0.9), bois, -6.4, 0.44, z);
    pose(new THREE.BoxGeometry(2.0, 0.12, 0.76), marbre, -6.4, 0.71, z);
  }

  /*
   * Les silhouettes.
   *
   * Un hall vide est un hall qui n'a pas ouvert. Six personnes suffisent à
   * changer ce qu'on lit dans l'image : elles donnent l'échelle — cinq mètres
   * quarante sous plafond ne veulent rien dire tant que rien de connu ne se
   * tient dessous — et elles disent que le bâtiment est habité, ce qui est
   * exactement ce qu'un programme immobilier vend.
   *
   * Quatre volumes chacune, pas un de plus : deux jambes, un buste, une tête.
   * On ne cherche pas la ressemblance, on la fuit : la seule chose pire qu'un
   * hall vide serait un hall peuplé de mannequins au visage approximatif. La
   * silhouette d'à-plat est la convention du rendu d'architecture depuis
   * cinquante ans, et elle est juste — on y lit une personne sans y lire
   * personne en particulier.
   */
  const personne = (x: number, z: number, cap: number, taille: number) => {
    const T = taille;
    const cos = Math.cos(cap);
    const sin = Math.sin(cap);
    /* L'écart des jambes se prend dans l'axe des épaules, donc perpendiculaire
       au cap : une personne de profil a les jambes l'une derrière l'autre, et
       les écarter en x lui en ferait pousser une troisième de face. */
    for (const cote of [-1, 1]) {
      const dx = -sin * cote * 0.11;
      const dz = cos * cote * 0.11;
      pose(
        new THREE.CylinderGeometry(0.075, 0.055, T * 0.48, 6),
        gens,
        x + dx,
        0.24 + T * 0.24,
        z + dz,
      );
    }
    pose(
      new THREE.CylinderGeometry(0.2, 0.16, T * 0.36, 8),
      gens,
      x,
      0.24 + T * 0.48 + T * 0.18,
      z,
    );
    pose(new THREE.SphereGeometry(T * 0.072, 8, 6), gens, x, 0.24 + T * 0.9, z);
  };
  for (const [x, z, cap, taille] of [
    [-6.4, -5.6, 2.1, 1.74],
    [-5.2, -6.4, -1.0, 1.62],
    [1.2, 2.6, 3.0, 1.79],
    [3.4, -3.2, 1.4, 1.68],
    [8.6, 4.4, 2.6, 1.71],
    [-11.4, 6.2, 0.4, 1.66],
  ] as const) {
    personne(x, z, cap, taille);
  }

  /* Le nom, sur le mur du fond. C'est la seule image de toute la page — une
     signalétique, dessinée dans un canevas au chargement. Elle est ici à sa
     place et nulle part ailleurs : un logotype est du texte gravé sur un mur,
     pas une matière qu'on simule. */
  const signe = enseigne(bin, options.nom ?? 'ORIEL');
  if (signe) {
    /* Décalé du milieu du mur, et pas par goût : le dernier plan du vol est
       une diagonale, et un logotype centré sur le mur tombait pile derrière le
       titre de la page. Posé à trois mètres soixante de l'axe, il vient se
       placer dans le tiers gauche du cadre, là où la page ne met rien. */
    const plaque = new THREE.PlaneGeometry(8.4, 2.1);
    bin.push(plaque);
    const mesh = new THREE.Mesh(plaque, signe);
    mesh.position.set(-IX + 0.42, 3.0, 3.6);
    mesh.rotation.y = Math.PI / 2;
    groupe.add(mesh);
  }

  /* ------------------------------------------------------------ étages --- */
  let sommet = SOCLE + 0.25;
  for (let niveau = 0; niveau < NIVEAUX; niveau += 1) {
    const e = empreinte(niveau);
    const bas = sommet;
    const dalle = bas + ETAGE - NEZ;

    /*
     * Le bandeau vitré, en retrait de vingt centimètres derrière le nez de
     * dalle. Ce retrait est tout : à fleur, la façade est un aplat ; en
     * retrait, chaque étage porte sa propre ligne d'ombre, et c'est cette
     * ligne qui donne l'échelle du bâtiment à cent mètres.
     *
     * Il est monté en **quatre faces creuses** et non plus en un seul volume
     * plein. Tant que la caméra restait dehors, un bloc suffisait : on n'en
     * voyait jamais que l'extérieur. Le vol se termine maintenant dans un
     * séjour du cinquième — à l'intérieur du bloc, donc, où l'on ne voyait
     * rien du tout, les faces étant tournées vers le dehors.
     *
     * Et les teintes varient d'une face à l'autre. Trois nuances, choisies par
     * une fonction du niveau et de la face : c'est la seule irrégularité de
     * toute la façade, et elle est indispensable. Un mur-rideau dont les cent
     * vingt panneaux ont exactement le même ton n'est pas un immeuble, c'est
     * un tableur — il n'y a derrière ces vitres ni rideau tiré, ni store
     * baissé, ni pièce éclairée.
     */
    const EP = 0.16;
    const teinte = (face: number) => {
      const h = (niveau * 7 + face * 13) % 11;
      return h < 2 ? verreClair : h < 4 ? verreSombre : verre;
    };
    const baie = niveau === APPARTEMENT.niveau;
    for (const [i, z] of [-(e.hz - 0.2), e.hz - 0.2].entries()) {
      pose(
        new THREE.BoxGeometry(e.hx * 2 - 0.4, ETAGE - NEZ, EP),
        teinte(i),
        e.dx,
        bas + (ETAGE - NEZ) / 2,
        z,
      );
    }
    for (const [i, x] of [e.dx - (e.hx - 0.2), e.dx + (e.hx - 0.2)].entries()) {
      /* La face qui donne sur la terrasse du séjour est transparente : c'est
         la seule vitre de tout le bâtiment que l'on regarde du dedans, et le
         dernier plan de la page la traverse. */
      const quoi = baie && i === 1 ? vitrine : teinte(i + 2);
      pose(
        new THREE.BoxGeometry(EP, ETAGE - NEZ, e.hz * 2 - 0.4 - EP * 2),
        quoi,
        x,
        bas + (ETAGE - NEZ) / 2,
        0,
      );
    }

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

    /* Le nez de dalle, qui déborde de vingt centimètres — et sa sous-face.
       Les deux sont **percés** par l'atrium : ce sont eux qui le refermaient. */
    percee(beton, e.hx * 2 + 0.4, NEZ, e.hz * 2 + 0.4, e.dx, dalle + NEZ / 2, 0);
    percee(soffite, e.hx * 2 + 0.1, 0.16, e.hz * 2 + 0.1, e.dx, dalle - 0.08, 0);

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

  /* ------------------------------------------------------------ atrium --- */
  /*
   * Le puits, ses coursives et sa verrière.
   *
   * C'est la pièce qui a rendu le reste possible. Le vol devait conduire
   * jusqu'à un appartement ; une caméra qui monte en ligne droite traverse
   * onze planchers, et on ne voit que cela. Il fallait un vide, et un vide
   * dans un immeuble d'habitation porte un nom : c'est un atrium, desservi par
   * coursives, et cela remplace onze couloirs aveugles par onze niveaux de
   * lumière du jour.
   *
   * Sa surface est déduite du plancher annoncé — voir `surfacePlancher` dans
   * `lib/residence.ts`. Un puits qu'on voit de part en part et une surface qui
   * l'ignore ne peuvent pas coexister sur la même page.
   */
  const AX = (ATRIUM.x0 + ATRIUM.x1) / 2;
  const AZ = (ATRIUM.z0 + ATRIUM.z1) / 2;
  const AL = ATRIUM.x1 - ATRIUM.x0;
  const AP = ATRIUM.z1 - ATRIUM.z0;
  const CIME = altitudeNiveau(NIVEAUX - 1) + ETAGE - NEZ;
  const CORPS = CIME - HALL;

  /*
   * Les quatre joues du puits, en marbre clair : c'est ce qui renvoie le jour.
   *
   * Cannelées, et bandées à chaque niveau — deux ajouts faits après coup, sur
   * capture. La première version n'avait que les quatre murs nus, et le plan
   * de la montée ne montrait **rien** : quarante-trois mètres de marbre lisse
   * éclairés par une source lointaine donnent un dégradé, pas une image. Sans
   * arête, l'œil n'a ni échelle, ni hauteur, ni matière — et il ne sait même
   * pas qu'il regarde un puits.
   */
  for (const z of [ATRIUM.z0 - 0.12, ATRIUM.z1 + 0.12]) {
    pose(new THREE.BoxGeometry(AL + 0.48, CORPS, 0.24), puits, AX, HALL + CORPS / 2, z);
  }
  for (const x of [ATRIUM.x0 - 0.12, ATRIUM.x1 + 0.12]) {
    pose(new THREE.BoxGeometry(0.24, CORPS, AP), puits, x, HALL + CORPS / 2, AZ);
  }
  /* Les nervures, **claires sur fond sombre**. Une nervure de la couleur de
     son mur ne se voit pas dans un volume sans ombre : c'est le contraste
     d'albédo qui la dessine, pas son relief. */
  for (let i = -4; i <= 4; i += 1) {
    for (const z of [ATRIUM.z0 + 0.07, ATRIUM.z1 - 0.07]) {
      pose(new THREE.BoxGeometry(0.14, CORPS, 0.14), marbre, AX + i * 0.9, HALL + CORPS / 2, z);
    }
    for (const x of [ATRIUM.x0 + 0.07, ATRIUM.x1 - 0.07]) {
      pose(new THREE.BoxGeometry(0.14, CORPS, 0.14), marbre, x, HALL + CORPS / 2, AZ + i * 0.9);
    }
  }
  /* Et un bandeau à chaque plancher, sur les deux joues sans coursive : c'est
     ce qui compte les étages quand on lève les yeux. */
  for (let n = 1; n < NIVEAUX; n += 1) {
    const sol = altitudeNiveau(n);
    for (const x of [ATRIUM.x0 + 0.16, ATRIUM.x1 - 0.16]) {
      pose(new THREE.BoxGeometry(0.3, 0.44, AP - 0.5), marbre, x, sol - 0.22, AZ);
    }
  }

  /* Les coursives, une paire par niveau. Ce sont elles qui donnent l'échelle
     du puits : sans elles, un vide de quarante-trois mètres n'a pas de
     graduation et pourrait aussi bien en faire dix. */
  for (let n = 0; n < NIVEAUX; n += 1) {
    const sol = altitudeNiveau(n);
    if (sol < HALL + 1) continue;
    for (const sens of [-1, 1]) {
      const bord = sens < 0 ? ATRIUM.z0 : ATRIUM.z1;
      const centre = bord - sens * (ATRIUM.coursive / 2);
      const nez = bord - sens * ATRIUM.coursive;
      pose(new THREE.BoxGeometry(AL, 0.24, ATRIUM.coursive), pierre, AX, sol - 0.12, centre);
      pose(new THREE.BoxGeometry(AL, 0.2, 0.14), soffite, AX, sol - 0.3, nez);
      // Garde-corps de verre et main courante : la même grammaire qu'en terrasse.
      pose(new THREE.BoxGeometry(AL, 1.02, 0.06), garde, AX, sol + 0.51, nez);
      pose(new THREE.BoxGeometry(AL, 0.07, 0.12), meneau, AX, sol + 1.05, nez);
    }
  }

  /* La verrière, et la lueur juste au-dessus. Le vitrage seul ne se voit pas
     par en dessous : ce qu'on regarde, dans un puits, c'est la lumière, et il
     faut donc quelque chose qui en émette. */
  pose(new THREE.BoxGeometry(AL + 0.4, 0.1, AP + 0.4), vitrine, AX, CIME, AZ);
  /* Le ciel vu par en dessous, et pas une lampe. La première version posait
     ici le même matériau lumineux que les corniches du hall : soixante-douze
     mètres carrés de blanc au-dessus de la caméra, que la profondeur de champ
     étalait ensuite sur la moitié de l'écran. Un ton nettement plus bas, et
     une surface réduite au vrai vitrage. */
  pose(new THREE.BoxGeometry(AL - 0.6, 0.06, AP - 0.6), ciel_haut, AX, CIME + 0.2, AZ);
  for (let i = -2; i <= 2; i += 1) {
    pose(new THREE.BoxGeometry(0.16, 0.34, AP + 0.4), meneau, AX + i * (AL / 5), CIME + 0.1, AZ);
  }

  /* ------------------------------------------------------- appartement --- */
  /*
   * Le séjour du cinquième, et la fin du vol.
   *
   * Cinquième niveau parce que c'est là que se produit le premier redan : le
   * seul étage qui dispose de cinq mètres quarante de terrasse sur toute sa
   * longueur. Un appartement sans dehors aurait fait un séjour avec fenêtre ;
   * celui-ci a une terrasse, et le dernier plan la traverse du regard pour
   * finir sur l'horizon.
   *
   * Le mobilier est réduit à ce que la caméra voit depuis un seul point de
   * vue, et disposé pour ce point de vue : un canapé de dos au premier plan,
   * l'îlot et la table à mi-distance, la baie au fond. Meubler une pièce
   * entière qu'on ne verra que d'un endroit est du travail perdu — et surtout
   * du travail qui finit dans le cadre là où on ne l'attend pas.
   */
  const SOL = altitudeNiveau(APPARTEMENT.niveau);
  const DALLAGE = SOL + 0.12;
  const PX0 = APPARTEMENT.x0;
  const PX1 = APPARTEMENT.x1;
  const PZ0 = APPARTEMENT.z0;
  const PZ1 = APPARTEMENT.z1;
  const PL = PX1 - PX0;
  const PP = PZ1 - PZ0;
  const PCX = (PX0 + PX1) / 2;
  const PCZ = (PZ0 + PZ1) / 2;

  pose(new THREE.BoxGeometry(PL, 0.12, PP), parquet, PCX, SOL + 0.06, PCZ);
  pose(new THREE.BoxGeometry(PL, 0.12, PP), soffite, PCX, DALLAGE + APPARTEMENT.haut, PCZ);
  // Les deux joues, et la cloison d'entrée percée d'un passage de 3,60 m.
  for (const z of [PZ0 - 0.09, PZ1 + 0.09]) {
    pose(new THREE.BoxGeometry(PL, APPARTEMENT.haut, 0.18), marbre, PCX, DALLAGE + APPARTEMENT.haut / 2, z);
  }
  for (const sens of [-1, 1]) {
    const large = PP / 2 - APPARTEMENT.entree;
    pose(
      new THREE.BoxGeometry(0.18, APPARTEMENT.haut, large),
      marbre,
      PX0,
      DALLAGE + APPARTEMENT.haut / 2,
      PCZ + sens * (APPARTEMENT.entree + large / 2),
    );
  }
  // Une corniche lumineuse le long de la baie : le soir, c'est elle qu'on voit.
  pose(new THREE.BoxGeometry(0.4, 0.05, PP - 1.2), lueur, PX1 - 0.5, DALLAGE + APPARTEMENT.haut - 0.12, PCZ);

  // Le tapis, puis le canapé en L, de dos.
  pose(new THREE.BoxGeometry(5.2, 0.03, 4.0), lin, PCX + 1.2, DALLAGE + 0.02, PCZ - 0.6);
  pose(new THREE.BoxGeometry(0.9, 0.72, 3.6), lin, PCX - 1.0, DALLAGE + 0.36, PCZ - 0.6);
  pose(new THREE.BoxGeometry(2.6, 0.72, 0.9), lin, PCX + 0.4, DALLAGE + 0.36, PCZ - 2.4);
  pose(new THREE.BoxGeometry(0.9, 0.26, 3.6), bois, PCX - 1.0, DALLAGE + 0.85, PCZ - 0.6);
  // La table basse, en marbre.
  pose(new THREE.BoxGeometry(1.5, 0.06, 1.0), marbre, PCX + 1.6, DALLAGE + 0.38, PCZ - 0.6);
  pose(new THREE.BoxGeometry(0.9, 0.36, 0.6), fut, PCX + 1.6, DALLAGE + 0.18, PCZ - 0.6);

  // L'îlot de la cuisine, contre la joue nord.
  pose(new THREE.BoxGeometry(3.4, 0.92, 1.0), bois, PCX - 1.6, DALLAGE + 0.46, PZ1 - 1.6);
  pose(new THREE.BoxGeometry(3.6, 0.06, 1.2), marbre, PCX - 1.6, DALLAGE + 0.95, PZ1 - 1.6);
  // La table et ses quatre chaises, entre l'îlot et la baie.
  pose(new THREE.BoxGeometry(2.2, 0.06, 1.0), bois, PCX + 2.4, DALLAGE + 0.74, PZ1 - 1.8);
  for (const dx of [-0.9, 0.9]) {
    pose(new THREE.BoxGeometry(0.12, 0.72, 0.9), fut, PCX + 2.4 + dx, DALLAGE + 0.36, PZ1 - 1.8);
  }
  for (const dx of [-0.7, 0.7]) {
    for (const dz of [-0.75, 0.75]) {
      pose(new THREE.BoxGeometry(0.44, 0.44, 0.44), lin, PCX + 2.4 + dx, DALLAGE + 0.22, PZ1 - 1.8 + dz);
      pose(new THREE.BoxGeometry(0.44, 0.5, 0.08), bois, PCX + 2.4 + dx, DALLAGE + 0.69, PZ1 - 1.8 + dz * 1.18);
    }
  }
  // Un arbre en pot près de la baie : la seule verticale de la pièce.
  pose(new THREE.CylinderGeometry(0.34, 0.28, 0.6, 10), marbre, PX1 - 1.3, DALLAGE + 0.3, PZ0 + 1.4);
  pose(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), tronc, PX1 - 1.3, DALLAGE + 1.25, PZ0 + 1.4);
  for (const [dx, dy, dz, r] of [
    [0, 0.5, 0, 0.62],
    [0.34, 0.28, 0.2, 0.44],
    [-0.3, 0.34, -0.24, 0.4],
  ] as const) {
    pose(
      new THREE.SphereGeometry(r, leger ? 7 : 10, leger ? 6 : 8),
      vegetal,
      PX1 - 1.3 + dx,
      DALLAGE + 1.9 + dy,
      PZ0 + 1.4 + dz,
    );
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
  percee(
    soffite,
    haut.hx * 2 + 0.5 - EPAIS * 2,
    0.22,
    haut.hz * 2 + 0.5 - EPAIS * 2,
    haut.dx,
    sommet + 0.11,
    0,
  );
  // Les édicules techniques, décalés vers l'arrière : une toiture parfaitement
  // nue est aussi fausse qu'un couvercle.
  /* Décalés hors de l'emprise du puits : un local technique posé sur une
     verrière, c'est une verrière en moins. */
  pose(new THREE.BoxGeometry(TRAME * 2.4, 1.5, TRAME * 1.8), soffite, -2.2, sommet + 0.97, -5.2);
  pose(new THREE.BoxGeometry(TRAME * 1.2, 0.9, TRAME * 1.2), refend, -3.4, sommet + 0.67, 4.6);
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
  /* Deux arbres ont été déplacés après coup, et pour la même raison. Avec la
     profondeur de champ, un feuillage situé à quinze mètres de l'objectif et
     bien derrière le point de netteté devient une masse verte de six cents
     pixels ; l'un d'eux s'étalait exactement derrière la plaque de légende du
     deuxième écran de galerie. Un premier plan flou est un bon outil tant
     qu'il ne s'assoit pas sur le texte — et l'endroit où il s'assoit ne se
     devine pas depuis le code, il se voit sur la capture. */
  /*
   * Le lointain.
   *
   * C'est la correction qui a le plus changé l'image pour le moins de
   * géométrie. Le bâtiment se dressait sur une dalle vide de neuf cents
   * mètres : quelle que soit la qualité de sa façade, il ressemblait à une
   * maquette posée sur une table, parce qu'une maquette est précisément un
   * bâtiment sans voisins. Quarante-deux masses bâties entre cent quatre-vingts
   * et quatre cent vingt mètres, dans la brume, et il est dans une ville.
   *
   * Elles sont posées par une suite déterministe et non par un tirage : une
   * ville qui change à chaque rechargement n'est pas un lieu. La règle laisse
   * un vide devant la façade d'entrée — on ne bâtit pas devant son propre
   * parvis — et fait monter les hauteurs vers le fond, ce qui creuse la
   * perspective au lieu de la barrer.
   */
  let graine = 7;
  const tirage = () => {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
  };
  for (let i = 0; i < 42; i += 1) {
    const angle = (i / 42) * Math.PI * 2 + tirage() * 0.14;
    const loin = 180 + tirage() * 240;
    const x = Math.cos(angle) * loin;
    const z = Math.sin(angle) * loin;
    // Le parvis d'entrée reste dégagé : rien dans le cône du vol.
    if (x > 60 && Math.abs(z) < loin * 0.42) continue;
    const haut = 18 + tirage() * 46 + (loin - 180) * 0.09;
    const large = 16 + tirage() * 26;
    const profond = 16 + tirage() * 26;
    pose(new THREE.BoxGeometry(large, haut, profond), lointain, x, haut / 2, z);
    pose(new THREE.BoxGeometry(large + 1, 0.8, profond + 1), soffite, x, haut + 0.4, z);
  }

  for (const [x, z, r] of [
    [-s0.hx - 16, s0.hz + 13, 2.6],
    [-s0.hx - 6, -s0.hz - 16, 3.1],
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
  const azimut = (SOLEIL.azimut * Math.PI) / 180;
  const site = (SOLEIL.site * Math.PI) / 180;
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
   * Les lampes du hall.
   *
   * Le hall est sous vingt-six mille mètres cubes de béton : le soleil n'y
   * entre que par la façade est, et la carte d'ombre — gelée après la première
   * image — l'y laisse dans le noir. Il lui faut donc son propre éclairage,
   * et c'est une bonne nouvelle : un hall éclairé de l'intérieur, vu du
   * parvis à travers son vitrage, est exactement l'image que vend un immeuble
   * de standing à la tombée du jour.
   *
   * Trois lampes ponctuelles, chaudes, **sans ombre**. Sans ombre parce qu'une
   * carte d'ombre par lampe ponctuelle est un cube de six faces à redessiner,
   * soit dix-huit rendus supplémentaires par image pour un gain que personne
   * ne remarque dans une pièce à quatre murs clairs. Et une portée bornée à
   * trente-quatre mètres, sans quoi elles éclaireraient le parvis au travers
   * des murs.
   */
  for (const [x, z] of [
    [-9.5, 0],
    [0, -5],
    [4, 5],
  ] as const) {
    /*
     * Quarante-cinq, et pas cent cinq.
     *
     * L'intensité d'une source ponctuelle est une **luminance à un mètre** :
     * avec une décroissance en carré, ce que reçoit une surface à `d` mètres
     * vaut `I / d²`. Les lampes du hall sont à quatre mètres quatre-vingts du
     * sol : à 105, elles y déversaient 4,6 — soit près du double du soleil de
     * la scène, qui est à 2,6. Tout saturait en haut de la courbe de tonalité,
     * et c'est ce qui a rendu le puits illisible : on pouvait y changer la
     * couleur des murs sans que l'image bouge d'un pixel, puisqu'ils étaient
     * déjà à blanc. Le nuancier ne peut rien quand l'exposition est fausse.
     */
    const lampe = new THREE.PointLight(0xffe6c2, 45, 34, 2);
    lampe.position.set(x, HALL - 0.6, z);
    scene.add(lampe);
  }

  /*
   * Le jour qui descend dans le puits.
   *
   * La verrière est au douzième ; la carte d'environnement éclaire tout de la
   * même façon, sans savoir qu'il y a quarante mètres de gaine entre elle et
   * le hall. Deux sources froides, échelonnées dans la hauteur, refont ce que
   * l'occlusion ne sait pas faire : un puits plus clair en haut qu'en bas.
   * C'est un mensonge d'éclairagiste, et c'est le mensonge qui rend l'image
   * vraie.
   */
  for (const y of [CIME - 6, HALL + CORPS * 0.42]) {
    /* Même règle : les joues du puits sont à quatre mètres de l'axe, on vise
       autour de 1,5 — donc vingt-six, et non soixante-dix-huit. */
    const jour = new THREE.PointLight(0xdfe8f2, 26, 46, 2);
    jour.position.set(AX, y, AZ);
    scene.add(jour);
  }

  /* Et une lampe dans le séjour, chaude, pour que la pièce existe le soir. */
  const salon = new THREE.PointLight(0xffe3ba, 24, 26, 2);
  salon.position.set(PCX + 1, DALLAGE + APPARTEMENT.haut - 0.5, PCZ - 0.4);
  scene.add(salon);

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
