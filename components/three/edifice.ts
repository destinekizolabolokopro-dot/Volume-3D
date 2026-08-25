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
import { ETAGE, HALL as COTES, NEZ, NIVEAUX, RETRAIT, SOCLE, TRAME, empreinte } from '@/lib/residence';

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
  const marbre = mat(TON.marbre, 0.24, { metalness: 0.03 });
  const bois = mat(TON.bois, 0.62);
  const fut = mat(TON.fut, 0.55, { metalness: 0.05 });
  /* Les corniches lumineuses sont un matériau **basique** : elles ne
     reçoivent pas la lumière, elles la donnent. Une source lumineuse rendue
     avec un matériau qui s'assombrit dans l'ombre n'est pas une source. */
  const lueur = new THREE.MeshBasicMaterial({ color: TON.lueur, fog: false });
  lueur.userData = { sansOmbre: true };
  bin.push(lueur);

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
  // Le plafond, et la retombée périphérique au-dessus du vitrage.
  pose(new THREE.BoxGeometry(IX * 2, 0.14, IZ * 2), soffite, 0, HALL - 0.07, 0);

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
  for (const x of [-7.2, 3.6]) {
    for (const z of [-4.6, 4.6]) {
      pose(new THREE.CylinderGeometry(0.44, 0.44, HALL, leger ? 10 : 18), fut, x, HALL / 2, z);
      pose(new THREE.BoxGeometry(1.3, 0.14, 1.3), marbre, x, 0.29, z);
    }
  }

  /* Les corniches lumineuses : quatre lignes continues dans le plafond. Elles
     ne portent pas la lumière du hall — ce sont les lampes qui s'en chargent —
     mais elles disent d'où elle vient, et une lumière dont on ne voit pas la
     source paraît toujours fausse. */
  for (const z of [-7.4, -2.6, 2.6, 7.4]) {
    pose(new THREE.BoxGeometry(IX * 2 - 3, 0.05, 0.44), lueur, 0, HALL - 0.16, z);
    pose(new THREE.BoxGeometry(IX * 2 - 2.6, 0.22, 0.9), soffite, 0, HALL - 0.24, z);
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
  /* Deux arbres ont été déplacés après coup, et pour la même raison. Avec la
     profondeur de champ, un feuillage situé à quinze mètres de l'objectif et
     bien derrière le point de netteté devient une masse verte de six cents
     pixels ; l'un d'eux s'étalait exactement derrière la plaque de légende du
     deuxième écran de galerie. Un premier plan flou est un bon outil tant
     qu'il ne s'assoit pas sur le texte — et l'endroit où il s'assoit ne se
     devine pas depuis le code, il se voit sur la capture. */
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
    const lampe = new THREE.PointLight(0xffe6c2, 135, 34, 2);
    lampe.position.set(x, HALL - 0.6, z);
    scene.add(lampe);
  }

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
