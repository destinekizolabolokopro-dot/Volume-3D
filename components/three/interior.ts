/**
 * Le logement en trois dimensions.
 *
 * Ce module ne connaît ni le défilement, ni le scénario, ni React : il fabrique
 * la scène — sols, murs percés, plinthes, mobilier, palier, porte, vis-à-vis —
 * à partir d'un plan et rien d'autre.
 *
 * Il est séparé pour une raison précise : le site montre le **même** logement
 * deux fois, une première en visite guidée sur la page d'accueil, une seconde
 * en visite libre où le visiteur conduit. Si ces deux pages construisaient
 * chacune leur scène, elles divergeraient au premier ajustement — et la
 * promesse du produit, c'est justement que les deux montrent le même volume.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  WALL_FACADE,
  WALL_SKIN,
  containsPoint,
  distance,
  planBounds,
  pointAt,
  projectOnWall,
  roomCenter,
  roomWalls,
  solidSpans,
  wallThickness,
  type Interval,
} from '@/lib/plan';
import {
  FURNITURE,
  FURNITURE_METAL,
  FURNITURE_ROUGHNESS,
  OUTSIDE,
  ROUGHNESS,
  SHELL,
} from '@/lib/palette';
import type { FurnitureTone } from '@/lib/palette';
import type { Massing } from '@/lib/showcase';
import type { PlanDoor, PlanPoint, PlanRoom } from '@/lib/types';

/** De quoi défaire proprement tout ce qu'on a alloué. */
export interface Bin {
  dispose(): void;
}

/** L'ouverture par laquelle on entre, et d'où on la regarde. */
export interface Entrance {
  door: PlanDoor;
  roomId: string;
  outside: PlanPoint;
}

/* Les épaisseurs viennent de `lib/plan.ts` : le contrôle du mobilier s'en sert
   aussi, et les deux ne doivent pas en avoir deux versions. */
const SKIN = WALL_SKIN;
const FACADE = WALL_FACADE;
/* La hauteur des plinthes et des corniches est portée par leur profil, plus
   bas : `PROFIL_PLINTHE` et `PROFIL_CORNICHE`. */

/* ------------------------------------------------------------ moulures --- */

/*
 * Une plinthe n'est pas un parallélépipède.
 *
 * Rendue en bloc, elle donne une bande de couleur au bas du mur : elle occupe
 * la bonne place mais ne fait rien, parce qu'un bloc n'a que deux orientations
 * et que les deux reçoivent la même lumière que le mur. Ce qui fait une plinthe,
 * c'est son profil — deux ou trois redans où l'ombre s'accroche et se pose en
 * traits horizontaux. C'est exactement ce que l'œil cherche pour lire la
 * hauteur d'une pièce, et c'est pour cela qu'un menuisier moulure une planche
 * qui pourrait rester droite.
 *
 * Les profils sont donnés en mètres dans le plan vertical perpendiculaire au
 * mur : x est la saillie depuis la face du mur, y la hauteur depuis le sol pour
 * une plinthe, depuis le bas du bandeau pour une corniche. Ils sont extrudés le
 * long du mur, ce qui donne exactement ce que donne une moulure : une section
 * constante sur toute la longueur.
 *
 * Les valeurs sont celles d'un profil courant de menuiserie parisienne — une
 * plinthe de neuf centimètres à doucine, une corniche à gorge de douze — pas
 * une invention. C'est ce qui fait que la scène ne ressemble pas à un rendu.
 */
type Profil = [number, number][];

/**
 * De combien une moulure s'enfonce dans la surface qu'elle rejoint.
 *
 * La corniche montait pile à la hauteur du plafond, la plinthe descendait pile
 * au niveau du sol, et **toutes deux s'adossaient pile au nu du mur** : à chaque
 * fois deux faces exactement coplanaires, et le tampon de profondeur n'a alors
 * aucun moyen de choisir. Ce que ça donne à l'écran n'est pas une erreur
 * franche mais un pointillé le long du raccord, qui bouge quand la caméra
 * bouge — le défaut le plus visible de l'image et le plus difficile à nommer
 * quand on ne sait pas d'où il vient.
 *
 * Le premier passage n'avait traité que les extrémités hautes et basses. Le dos
 * restait à fleur du mur, et le pointillé avec lui, sur toute la longueur de la
 * corniche : il faut donc enfoncer les trois côtés — d'où le `-NOYADE` en tête
 * et en queue des profils, qui est la saillie depuis la face du mur.
 *
 * Deux millimètres et demi suffisent à trancher, et personne ne voit deux
 * millimètres et demi.
 */
const NOYADE = 0.0025;

/** Plinthe à doucine : montant droit, deux redans, retour au mur. */
const PROFIL_PLINTHE: Profil = [
  [-NOYADE, 0],
  [0.019, 0],
  [0.019, 0.062],
  [0.014, 0.07],
  [0.014, 0.076],
  [0.009, 0.082],
  [0.009, 0.088],
  [-NOYADE, 0.09],
];

/** Corniche à gorge : la diagonale creuse, puis deux ressauts vers le plafond. */
const PROFIL_CORNICHE: Profil = [
  [-NOYADE, 0],
  [0.048, 0.052],
  [0.048, 0.07],
  [0.036, 0.081],
  [0.036, 0.097],
  [0.016, 0.112],
  [0.016, 0.12],
  [-NOYADE, 0.12],
];

/** Réutilisés à chaque pièce plutôt que réalloués : la construction en pose
 *  quelques milliers. */
const AXE_Y = new THREE.Vector3(0, 1, 0);
const IDENTITE = new THREE.Matrix4();

/* ------------------------------------------------------- arêtes vives --- */

/*
 * Rien n'a d'arête parfaitement vive.
 *
 * Une boîte rendue avec des arêtes à angle droit ne renvoie de lumière que par
 * ses faces : l'arête elle-même n'a aucune surface, donc aucun reflet, et deux
 * faces mates se rencontrent sur une ligne qui n'existe pas dans le monde. Un
 * chanfrein de quelques millimètres suffit à lui donner une largeur — et cette
 * largeur, orientée autrement que les deux faces, accroche un filet de lumière
 * qui souligne le volume.
 *
 * C'est le détail le moins cher de toute la scène : quelques dizaines de
 * triangles par objet, invisibles au budget maintenant que tout est fusionné,
 * et c'est ce qui fait qu'un meuble cesse de ressembler à un carton. Il ne
 * devient visible qu'avec des matériaux physiques : sous Lambert, une arête
 * chanfreinée rend exactement comme une arête vive.
 *
 * Deux rayons, et la différence est structurelle. Le bâti se contente de deux
 * millimètres — c'est le rayon d'un angle de plâtre, et surtout deux panneaux
 * qui se rejoignent laissent alors une rainure de deux millimètres, invisible à
 * distance de pièce. Un chanfrein de menuiserie sur un mur ouvrirait des joints
 * qu'on verrait.
 */
const CHANFREIN_BATI = 0.002;
const CHANFREIN_MEUBLE = 0.006;

/**
 * Côté, en mètres, de la maille du grain d'enduit.
 *
 * Les coordonnées de texture d'une boîte vont de zéro à un par face, quelle que
 * soit sa taille : la même carte de grain s'étirerait sur un mur de cinq mètres
 * et se serrerait sur un chambranle de six centimètres, et le raccord entre les
 * deux se verrait comme un changement de matière. On remet donc les coordonnées
 * à l'échelle du monde — un pavé de trente centimètres partout — pour que le
 * grain ait la même finesse sur toute la scène.
 *
 * L'approximation porte sur les joues : elles reçoivent l'échelle de la face,
 * ce qui est faux d'un facteur égal au rapport de l'épaisseur à la largeur.
 * Sur des joues de quelques centimètres, cela ne se voit pas.
 */
const MAILLE_GRAIN = 0.3;

/**
 * Met les coordonnées de texture d'une boîte à l'échelle du monde, et les cale
 * sur la position du panneau dans le mur.
 *
 * L'échelle seule ne suffit pas. Deux panneaux voisins commencent tous deux à
 * zéro : le motif redémarre à leur jonction, et la coupure se lit comme une
 * ligne horizontale en travers du mur. En décalant les coordonnées de la
 * position réelle du panneau, le grain traverse le raccord sans le voir.
 */
function worldUv(
  geometry: THREE.BufferGeometry,
  width: number,
  height: number,
  alongOffset: number,
  heightOffset: number,
): void {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return;
  const u = width / MAILLE_GRAIN;
  const v = height / MAILLE_GRAIN;
  const du = alongOffset / MAILLE_GRAIN;
  const dv = heightOffset / MAILLE_GRAIN;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, uv.getX(index) * u + du, uv.getY(index) * v + dv);
  }
  uv.needsUpdate = true;
}

/**
 * Une boîte aux arêtes adoucies, avec repli sur la boîte franche quand elle est
 * trop mince pour recevoir un chanfrein.
 *
 * Le nombre de segments suit le rayon, et ce n'est pas une optimisation : un
 * chanfrein de deux millimètres n'a besoin que d'une facette, parce qu'on ne
 * le voit jamais que comme une ligne de lumière sur l'arête. Un coussin de
 * quatre centimètres rendu avec la même facette unique donne un octogone, et
 * un octogone se lit comme une caisse biseautée — exactement ce qu'on
 * cherchait à quitter. Au-delà de deux centimètres il faut de la courbure, pas
 * du biseau.
 */
function box(
  w: number,
  h: number,
  d: number,
  radius: number,
  /**
   * Strates horizontales, pour un panneau assez grand pour que l'ombrage cuit
   * dans ses sommets ait besoin de place. Voir `panel`.
   */
  strates = 1,
): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(w, h, d) * 0.48);
  if (strates > 1) return new THREE.BoxGeometry(w, h, d, 1, strates, 1);
  if (r < 0.0006) return new THREE.BoxGeometry(w, h, d);
  const segments = r > 0.045 ? 4 : r > 0.02 ? 3 : 1;
  return new RoundedBoxGeometry(w, h, d, segments, r);
}

/**
 * Un pas de subdivision : chaque triangle en donne quatre.
 *
 * Les milieux sont mémorisés par arête, donc deux triangles voisins partagent
 * exactement le même sommet neuf : le maillage reste cousu, sans jonction en T
 * — et une jonction en T, sur une surface dont la couleur est portée par les
 * sommets, se voit tout de suite comme une couture claire.
 */
function subdiviserUnPas(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const index = geometry.index!;
  const noms = Object.keys(geometry.attributes);
  const source = new Map<string, THREE.BufferAttribute>();
  const sortie = new Map<string, number[]>();
  for (const nom of noms) {
    const attribut = geometry.getAttribute(nom) as THREE.BufferAttribute;
    source.set(nom, attribut);
    sortie.set(nom, Array.from(attribut.array as ArrayLike<number>));
  }
  let compte = source.get('position')!.count;
  const connus = new Map<number, number>();
  const milieu = (i: number, j: number): number => {
    const cle = i < j ? i * 16777216 + j : j * 16777216 + i;
    const vu = connus.get(cle);
    if (vu !== undefined) return vu;
    for (const nom of noms) {
      const attribut = source.get(nom)!;
      const taille = attribut.itemSize;
      const liste = sortie.get(nom)!;
      for (let k = 0; k < taille; k += 1) {
        liste.push(
          ((attribut.array[i * taille + k] as number) +
            (attribut.array[j * taille + k] as number)) /
            2,
        );
      }
    }
    connus.set(cle, compte);
    compte += 1;
    return compte - 1;
  };

  const triangles: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const ab = milieu(a, b);
    const bc = milieu(b, c);
    const ca = milieu(c, a);
    triangles.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }

  const suivant = new THREE.BufferGeometry();
  for (const nom of noms) {
    suivant.setAttribute(
      nom,
      new THREE.BufferAttribute(new Float32Array(sortie.get(nom)!), source.get(nom)!.itemSize),
    );
  }
  suivant.setIndex(triangles);
  // Un milieu de deux normales unitaires ne l'est plus. Sur du plan c'est sans
  // effet, mais la fonction ne sait pas qu'elle travaille sur du plan.
  if (suivant.getAttribute('normal')) suivant.normalizeNormals();
  return suivant;
}

/** Subdivise jusqu'à ce qu'aucune arête ne dépasse `maille`, dans la limite de `passes`. */
function subdiviser(
  geometry: THREE.BufferGeometry,
  maille: number,
  passes = 5,
): THREE.BufferGeometry {
  let courant = geometry;
  for (let pas = 0; pas < passes; pas += 1) {
    const index = courant.index;
    const position = courant.getAttribute('position');
    if (!index || !position) break;
    let plusLongue = 0;
    for (let t = 0; t < index.count; t += 3) {
      for (let e = 0; e < 3; e += 1) {
        const i = index.getX(t + e);
        const j = index.getX(t + ((e + 1) % 3));
        const d = Math.hypot(
          position.getX(i) - position.getX(j),
          position.getY(i) - position.getY(j),
          position.getZ(i) - position.getZ(j),
        );
        if (d > plusLongue) plusLongue = d;
      }
    }
    if (plusLongue <= maille) break;
    const suivant = subdiviserUnPas(courant);
    if (courant !== geometry) courant.dispose();
    courant = suivant;
  }
  return courant;
}
/** Hauteur de la corniche, au raccord du mur et du plafond. Elle doit
 *  correspondre au dernier point de `PROFIL_CORNICHE`. */
const CORNICE = 0.12;

/* --------------------------------------------------------- fusion --- */

/**
 * Le fusionneur.
 *
 * Un logement construit pièce par pièce donne trois cent soixante-seize appels
 * de dessin pour cinq mille triangles : chaque pan de mur, chaque plinthe,
 * chaque pied de table est un objet distinct que la carte graphique doit
 * préparer séparément. Le coût n'est pas dans les triangles — cinq mille, c'est
 * une misère — il est dans le nombre d'objets.
 *
 * On accumule donc les géométries par matériau, on les transforme une fois pour
 * toutes dans le repère de la scène, et on n'envoie qu'un objet par matériau.
 * Le compte tombe à une dizaine d'appels, et le budget ainsi libéré paie le
 * détail : chanfreins, profils de moulure, plus de mobilier.
 *
 * Toutes les géométries d'un même lot doivent porter les mêmes attributs. On
 * complète donc `color` en blanc quand l'occlusion n'a pas été cuite : sans ça
 * la fusion échoue, et elle échoue silencieusement.
 */
class Batch {
  private readonly lots = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(
    source: THREE.BufferGeometry,
    material: THREE.Material,
    matrix: THREE.Matrix4,
    /** Facteur de luminosité par sommet, dans le repère de la scène. */
    paint?: (x: number, y: number, z: number) => number,
    /**
     * Taille de maille visée avant de peindre.
     *
     * Une couleur portée par les sommets ne peut décrire que ce que le maillage
     * a de résolution. Le sol d'un séjour est un rectangle, donc deux triangles,
     * donc quatre sommets : la décroissance du jour, qui est une courbe sur sept
     * mètres, y était réduite à un dégradé linéaire entre quatre coins — c'est
     * à dire à rien. Subdiviser avant de peindre est ce qui rend la lumière
     * visible ; sans cela, tout le travail sur la décroissance ne sortait que
     * sur les objets déjà découpés.
     */
    maille?: number,
  ): void {
    let geometry = source;
    geometry.applyMatrix4(matrix);
    /*
     * Indexées ou pas, mais pas les deux.
     *
     * Les primitives de three.js sont indexées ; une extrusion ne l'est pas. La
     * fusion refuse un mélange des deux — et elle le refuse en écrivant dans la
     * console, pas en levant une erreur : le lot retombait sur des objets
     * séparés et la moitié du gain de la fusion disparaissait sans que rien ne
     * le signale. On indexe donc ce qui ne l'est pas, ce qui soude au passage
     * les sommets rigoureusement identiques.
     */
    if (!geometry.index) {
      const indexed = mergeVertices(geometry);
      if (indexed !== geometry) geometry.dispose();
      geometry = indexed;
    }
    if (maille) {
      const fin = subdiviser(geometry, maille);
      if (fin !== geometry) {
        geometry.dispose();
        geometry = fin;
      }
    }
    const position = geometry.getAttribute('position');
    if (!geometry.getAttribute('color')) {
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(position.count * 3).fill(1), 3),
      );
    }
    /* Le pinceau s'applique après la transformation : il raisonne en
       coordonnées de scène, donc il peut dépendre de la hauteur ou de la
       distance à une fenêtre, ce qu'un repère local ne permet pas. */
    if (paint) {
      const colour = geometry.getAttribute('color') as THREE.BufferAttribute;
      for (let index = 0; index < position.count; index += 1) {
        const k = paint(position.getX(index), position.getY(index), position.getZ(index));
        colour.setXYZ(
          index,
          colour.getX(index) * k,
          colour.getY(index) * k,
          colour.getZ(index) * k,
        );
      }
      colour.needsUpdate = true;
    }
    // `uv` manque sur certaines primitives ; il doit exister partout ou nulle part.
    if (!geometry.getAttribute('uv')) {
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const lot = this.lots.get(material);
    if (lot) lot.push(geometry);
    else this.lots.set(material, [geometry]);
  }

  /** Verse les objets fusionnés dans un groupe, et rend les géométries sources. */
  flush(group: THREE.Group, disposables: { dispose(): void }[]): void {
    for (const [material, lot] of this.lots) {
      /* Certains matériaux ne doivent rien projeter. Le cas qui compte est le
         verre : la carte d'ombre est un tampon de profondeur, elle ignore la
         transparence, et une vitre y écrit exactement comme un mur. Les
         fenêtres étaient donc murées du point de vue du soleil, et le logement
         entier rendait par temps couvert — sans qu'aucune valeur d'éclairage ne
         soit fausse. */
      const casts = material.userData?.sansOmbre !== true;
      const merged = lot.length === 1 ? lot[0] : mergeGeometries(lot, false);
      if (!merged) {
        // La fusion refuse des attributs incompatibles : on retombe sur des
        // objets séparés plutôt que de perdre la géométrie.
        for (const geometry of lot) {
          disposables.push(geometry);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = casts;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
        continue;
      }
      if (merged !== lot[0]) for (const geometry of lot) geometry.dispose();
      disposables.push(merged);
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = casts;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.lots.clear();
  }
}

/* ------------------------------------------------- ombrage des raccords --- */

/*
 * L'occlusion des angles, cuite dans les sommets.
 *
 * Le rendu était juste et pourtant plat : l'histogramme d'une image du parcours
 * tenait à 58 % dans une seule tranche de luminance, sans noirs et sans hautes
 * lumières. Ce n'était ni une sur-exposition — rien ne brûlait — ni une erreur
 * de couleur : il manquait les ombres douces que le coin d'une pièce prend
 * toujours, parce qu'un mur y voit moins de ciel qu'en son milieu.
 *
 * Un moteur sans éclairage global ne les calcule pas. On les peint donc dans
 * les sommets : la base des murs s'assombrit sur trente centimètres, le raccord
 * du plafond sur dix-huit. C'est gratuit — pas une passe de rendu, pas une
 * texture — et c'est ce qui rend la profondeur.
 *
 * Monter l'ambiante aurait fait l'inverse : plus de lumière partout, donc
 * encore moins d'écart.
 */
const AO_FLOOR = 0.3;
const AO_FLOOR_STRENGTH = 0.74;
const AO_CEILING = 0.18;
const AO_CEILING_STRENGTH = 0.9;

/*
 * La lumière du jour, cuite dans les sommets.
 *
 * C'est l'effet dominant de toute photographie d'intérieur, et il manquait
 * entièrement : une pièce était éclairée aussi fort au fond qu'au bord de la
 * fenêtre. Physiquement, la lumière d'une ouverture décroît avec le carré de la
 * distance et avec l'angle sous lequel on la voit ; un moteur sans éclairage
 * global ne calcule ni l'un ni l'autre — il traite la carte d'environnement
 * comme un ciel vu de partout, y compris depuis le fond d'un couloir aveugle.
 *
 * On corrige donc à la main, par la seule chose qui compte à l'œil : la
 * distance à l'ouverture la plus proche. Le fond d'une pièce garde un peu plus
 * de la moitié de sa lumière — assez pour que la profondeur se lise, pas assez
 * pour qu'on croie à une panne d'éclairage.
 */
const JOUR_PROCHE = 1.4;
const JOUR_LOIN = 7.5;
const JOUR_FOND = 0.58;

/** Les centres des ouvertures sur l'extérieur, dans le repère de la scène. */
function daylightSources(doors: PlanDoor[], origin: PlanPoint): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (const door of doors) {
    if (door.kind !== 'window') continue;
    points.push(
      new THREE.Vector3(
        (door.a.x + door.b.x) / 2 - origin.x,
        (door.sill + door.height) / 2,
        (door.a.y + door.b.y) / 2 - origin.y,
      ),
    );
  }
  return points;
}

/** Facteur de lumière du jour en un point, entre `JOUR_FOND` et 1. */
function daylightAt(sources: THREE.Vector3[], x: number, y: number, z: number): number {
  if (sources.length === 0) return 1;
  let nearest = Infinity;
  for (const source of sources) {
    const d = Math.hypot(source.x - x, source.y - y, source.z - z);
    if (d < nearest) nearest = d;
  }
  const t = Math.min(1, Math.max(0, (nearest - JOUR_PROCHE) / (JOUR_LOIN - JOUR_PROCHE)));
  return 1 - (1 - JOUR_FOND) * smoothstep(t);
}

/**
 * Le fond des angles.
 *
 * Là où deux surfaces se rejoignent, la lumière ambiante n'arrive plus que par
 * un demi-espace : le pourtour d'un sol et d'un plafond est toujours plus
 * sombre que son milieu. C'est ce que fait un moteur hors ligne en quelques
 * minutes de calcul ; ici la distance au bord suffit, parce que les pièces sont
 * des polygones convexes ou presque et qu'on ne cherche pas la valeur exacte,
 * seulement le fait que le bord soit plus sombre que le centre.
 *
 * Sans ce terme, le plafond se lit comme un couvercle posé sur la pièce plutôt
 * que comme sa cinquième face — le raccord est net, et un raccord net entre
 * deux surfaces également éclairées est ce qui trahit le plus vite une image de
 * synthèse.
 */
const RECOIN_SOL = 0.5;
const RECOIN_PLAFOND = 0.72;
const RECOIN_FORCE = 0.2;

function angleMort(
  bord: readonly (readonly [number, number])[],
  x: number,
  z: number,
  portee: number,
): number {
  let proche = Infinity;
  for (let i = 0; i < bord.length; i += 1) {
    const [ax, az] = bord[i];
    const [bx, bz] = bord[(i + 1) % bord.length];
    const dx = bx - ax;
    const dz = bz - az;
    const carre = dx * dx + dz * dz;
    const t = carre === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / carre));
    const d = Math.hypot(x - (ax + t * dx), z - (az + t * dz));
    if (d < proche) proche = d;
  }
  return 1 - RECOIN_FORCE * (1 - smoothstep(Math.min(1, proche / portee)));
}

/** Hauteur de la faïence dans une pièce d'eau. Un mètre vingt est l'usage. */
const FAIENCE = 1.2;

/** Pas de subdivision des dalles : au-delà, la décroissance redevient un plan. */
const MAILLE_DALLE = 0.55;

/** Facteur d'occlusion à une hauteur donnée, sous un plafond donné. */
function occlusionAt(y: number, ceiling: number): number {
  const fromFloor = Math.min(1, Math.max(0, y / AO_FLOOR));
  const low = AO_FLOOR_STRENGTH + (1 - AO_FLOOR_STRENGTH) * smoothstep(fromFloor);
  const fromCeiling = Math.min(1, Math.max(0, (ceiling - y) / AO_CEILING));
  const high = AO_CEILING_STRENGTH + (1 - AO_CEILING_STRENGTH) * smoothstep(fromCeiling);
  return low * high;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}


/**
 * Les teintes du mobilier viennent de `lib/palette.ts`, où elles sont
 * justifiées et vérifiées. Ce fichier ne décide d'aucune couleur : il les
 * applique. C'est ce qui garantit que ce qui est rendu est bien ce qui a été
 * étudié.
 */
const TONES: Record<Massing['tone'], number> = FURNITURE;

export interface InteriorOptions {
  rooms: PlanRoom[];
  doors: PlanDoor[];
  massing?: Massing[];
  /** Renseignée pour que la scène porte un palier et une porte qui s'ouvre. */
  entrance?: Entrance | null;
  /**
   * Le renderer, pour cuire la carte d'environnement.
   *
   * C'est la seule chose que la construction lui demande, et elle la lui rend
   * aussitôt : la carte est une texture, la scène n'en garde pas d'autre trace.
   * Sans elle, les matériaux physiques n'ont rien à refléter et rendent comme
   * du Lambert.
   */
  renderer?: THREE.WebGLRenderer | null;
  /**
   * Ce qu'il y a autour du logement.
   *
   * `ville` — l'appartement : un palier d'immeuble derrière la porte, des
   * façades haussmanniennes en vis-à-vis, le sol de la rue sept mètres plus
   * bas. `jardin` — la maison de plain-pied : une pelouse au niveau du
   * plancher, une haie, une ligne d'arbres, et un perron couvert.
   *
   * Le décor extérieur était écrit en dur pour l'appartement, et il a tenu tant
   * qu'il n'y avait qu'un décor. Vu depuis la maison, il devenait franchement
   * faux : la baie de 3,60 m censée ouvrir sur un jardin donnait sur une cour
   * parisienne, et la porte d'entrée d'une maison de plain-pied s'ouvrait sur
   * une cage d'escalier. Le dedans peut être générique — quatre murs sont
   * quatre murs — mais le dehors dit ce qu'est le bien.
   */
  dehors?: Dehors;
}

export type Dehors = 'ville' | 'jardin';

export interface Interior {
  scene: THREE.Scene;
  /** Le repère du plan est recentré : les coordonnées 3D restent petites. */
  origin: PlanPoint;
  /** Le battant, si la scène en a un. `closed` et `sweep` sont en radians. */
  leaf: { group: THREE.Group; closed: number; sweep: number } | null;
  dispose(): void;
}

/**
 * Règle le rendu de la même façon pour toutes les vues du logement.
 *
 * Sans compression tonale, un intérieur clair correctement éclairé rend des
 * murs à 255 partout : la pièce devient un aplat blanc et le volume disparaît,
 * ce qui est exactement l'inverse du but. La courbe ACES ramène les hautes
 * lumières dans l'échelle et rend au blanc ses nuances.
 */
export function configure(renderer: THREE.WebGLRenderer): void {
  /* La résolution de départ ; `adaptQuality` la corrige ensuite à la mesure. */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x101614, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  /*
   * PCF, et non le filtrage doux.
   *
   * `PCFSoftShadowMap` est abandonné par three.js : il retombe silencieusement
   * sur PCF, si bien qu'on croyait avoir des ombres douces sans en avoir. Le
   * choisir explicitement change deux choses — la console se tait, et l'intention
   * est dite.
   *
   * Et c'est le bon choix, pas un pis-aller. La source qui compte ici est le
   * soleil : vu de la Terre il fait un demi-degré, ses ombres sont presque
   * nettes, et l'ombre d'un meneau sur un placard doit se lire comme un meneau.
   * Le flou, on l'obtient là où il existe vraiment — dans les angles — par
   * l'occlusion cuite dans les sommets.
   */
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

/**
 * Le ciel, cuit en carte d'environnement.
 *
 * Un matériau physique a besoin de savoir ce qu'il reflète. Sans environnement,
 * son terme spéculaire n'a rien à renvoyer : il rend exactement comme du
 * Lambert, c'est-à-dire comme du papier, et tout le travail de rugosité ne se
 * voit nulle part.
 *
 * On n'a pas d'image HDR à charger — et on n'en veut pas : c'est un fichier de
 * plusieurs mégaoctets pour une page d'accueil. On cuit donc la carte à partir
 * du dégradé de ciel qui est déjà là. Le résultat n'est pas un panorama de
 * référence, mais il porte l'essentiel : plus clair en haut, plus chaud en bas,
 * et c'est ce dégradé qui donne aux surfaces satinées leur reflet doux.
 *
 * `PMREMGenerator` fait le filtrage par rugosité une fois pour toutes ; il est
 * détruit juste après, il ne sert qu'à la cuisson.
 */
function environnement(
  renderer: THREE.WebGLRenderer,
  disposables: { dispose(): void }[],
): THREE.Texture {
  const cuisine = new THREE.Scene();
  const dome = sky(disposables);
  cuisine.add(dome);
  /* Un sol clair sous le dôme : sans lui, la moitié basse de la carte est
     noire, et tout ce qui regarde vers le bas — le dessous d'une tablette, le
     nez d'une marche — se retrouve éteint. Une pièce a un sol ; sa carte
     d'environnement doit en avoir un aussi. */
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: 0xcfc7ba, side: THREE.DoubleSide }),
  );
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = -12;
  cuisine.add(sol);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const cible = pmrem.fromScene(cuisine, 0.04);
  pmrem.dispose();
  sol.geometry.dispose();
  (sol.material as THREE.Material).dispose();
  disposables.push(cible);
  return cible.texture;
}

/** Monte la scène complète. Un seul appel, un seul `dispose`. */
export function buildInterior({
  rooms,
  doors,
  massing = [],
  entrance = null,
  renderer = null,
  dehors = 'ville',
}: InteriorOptions): Interior {
  const box = planBounds(rooms);
  const origin = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const bin: Bin[] = [];

  const scene = new THREE.Scene();
  scene.add(sky(bin));
  if (renderer) {
    scene.environment = environnement(renderer, bin);
    /* Le ciel cuit est un ciel dégagé : pris à sa valeur, il éclaire un
       logement comme une véranda. La moitié suffit à faire vivre le spéculaire
       sans effacer le soleil, qui doit rester la source qu'on lit. */
    /* Ramenée de 1,05 à 0,55 : la carte d'environnement porte le spéculaire,
       et le spéculaire est précisément ce dont une maquette se passe. Elle
       reste, parce qu'elle est directionnelle — un mur tourné vers la fenêtre
       reçoit le ciel — mais elle éclaire au lieu de faire briller. */
    scene.environmentIntensity = 0.55;
  }
  lights(
    scene,
    Math.max(box.maxX - box.minX, box.maxY - box.minY),
    rooms.reduce((tallest, room) => Math.max(tallest, room.height), 2.5),
    rooms,
    doors,
  );
  scene.add(ground(dehors, bin));
  scene.add(surroundings(rooms, doors, origin, bin, dehors));
  scene.add(shell(rooms, doors, origin, bin));
  scene.add(baseShadow(rooms, origin, bin));
  scene.add(furniture(massing, doors, origin, bin));

  const leaf = entrance ? doorLeaf(entrance, rooms, origin, bin) : null;
  if (leaf) scene.add(leaf.group);
  if (entrance) {
    scene.add(
      dehors === 'jardin'
        ? porch(entrance, rooms, doors, origin, bin)
        : landing(entrance, rooms, origin, bin),
    );
  }

  return {
    scene,
    origin,
    leaf,
    dispose() {
      for (const item of bin) item.dispose();
    },
  };
}

/* ============================================================ construction */

function sky(disposables: { dispose(): void }[]): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(160, 32, 16);
  geometry.scale(-1, 1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: { haut: { value: new THREE.Color(0x7ea9de) }, bas: { value: new THREE.Color(0xf6f2ea) } },
    vertexShader: `
      varying float h;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        h = normalize(world.xyz).y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 haut;
      uniform vec3 bas;
      varying float h;
      void main() { gl_FragColor = vec4(mix(bas, haut, smoothstep(-0.05, 0.6, h)), 1.0); }
    `,
    depthWrite: false,
  });
  disposables.push(geometry, material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * L'éclairage.
 *
 * Une lumière rasante qui porte une ombre, et deux lumières douces qui
 * rattrapent les zones qu'elle n'atteint pas. C'est l'ombre qui fait tout le
 * travail : sans elle, un intérieur en volumes mats se lit comme un patron
 * découpé, et aucune quantité de lumière supplémentaire n'y change quoi que ce
 * soit — au contraire, elle aplatit encore.
 *
 * Le soleil vient de la rue, donc de la façade percée par la fenêtre du séjour.
 * Il n'éclaire ni la chambre ni la salle d'eau ; c'est ce qui doit arriver, et
 * c'est justement ce qui rend la scène crédible.
 */
/**
 * D'où vient le soleil.
 *
 * Il venait d'une direction fixe, choisie une fois pour la démonstration et
 * sans rapport avec le logement. Pour ce plan-là, elle tombait à peu près
 * juste ; pour le plan d'un client, elle pouvait aussi bien arriver par un mur
 * aveugle, et la visite entière rendait alors par temps couvert.
 *
 * On le place donc en fonction du bien : dehors, en face de la plus grande
 * ouverture, à trente-quatre degrés au-dessus de l'horizon — la hauteur d'un
 * soleil de milieu de matinée à Paris, celle qui fait entrer la lumière loin
 * dans la pièce sans écraser les volumes — et décalé de vingt-cinq degrés sur
 * le côté. Ce décalage n'est pas cosmétique : de face, la tache au sol est un
 * rectangle qui recopie la fenêtre et se lit comme une erreur ; de biais, c'est
 * un parallélogramme, et c'est ce que fait le soleil.
 */
function sunDirection(rooms: PlanRoom[], doors: PlanDoor[]): THREE.Vector3 {
  /* Les fenêtres, avec leur largeur et la direction vers laquelle elles
     regardent. */
  const baies: { largeur: number; cap: number; x: number; y: number }[] = [];
  for (const door of doors) {
    if (door.kind !== 'window') continue;
    const largeur = Math.hypot(door.b.x - door.a.x, door.b.y - door.a.y);
    if (largeur < 0.2) continue;
    const middle = { x: (door.a.x + door.b.x) / 2, y: (door.a.y + door.b.y) / 2 };
    const along = Math.atan2(door.b.y - door.a.y, door.b.x - door.a.x);
    let out = { x: Math.cos(along + Math.PI / 2), y: Math.sin(along + Math.PI / 2) };
    const dedans = { x: middle.x + out.x * 0.2, y: middle.y + out.y * 0.2 };
    if (rooms.some((room) => containsPoint(room, dedans))) out = { x: -out.x, y: -out.y };
    baies.push({ largeur, cap: Math.atan2(out.y, out.x), x: middle.x, y: middle.y });
  }
  // Sans fenêtre relevée, on garde une direction franche plutôt que rien.
  if (baies.length === 0) return new THREE.Vector3(-4, 7, -11);

  /*
   * L'azimut qui éclaire le plus de vitrage.
   *
   * Une première version plaçait le soleil devant la plus grande baie. Pour un
   * studio à une fenêtre c'est la même chose ; pour un logement qui en a trois,
   * cela revenait à en éclairer une et à laisser les deux autres au gris. On
   * cherche donc la direction qui maximise la surface vitrée *projetée* — la
   * somme des largeurs pondérées par le cosinus de l'angle d'incidence, ce qui
   * est exactement la quantité de lumière que la façade reçoit. Le résultat est
   * un compromis quand les fenêtres regardent ailleurs, et la solution évidente
   * quand elles regardent toutes du même côté.
   */
  let meilleurCap = baies[0].cap;
  let meilleur = -1;
  for (let pas = 0; pas < 36; pas += 1) {
    const cap = (pas * Math.PI) / 18;
    let recu = 0;
    for (const baie of baies) {
      const incidence = Math.cos(cap - baie.cap);
      if (incidence > 0) recu += baie.largeur * incidence;
    }
    if (recu > meilleur) {
      meilleur = recu;
      meilleurCap = cap;
    }
  }

  /*
   * Puis le décalage et la hauteur.
   *
   * Trente-quatre degrés au-dessus de l'horizon : la hauteur d'un soleil de
   * milieu de matinée à Paris, celle qui fait entrer la lumière loin dans la
   * pièce sans écraser les volumes. Et vingt-cinq degrés sur le côté — ce
   * décalage n'est pas cosmétique : de face, la tache au sol est un rectangle
   * qui recopie la fenêtre et se lit comme une erreur ; de biais, c'est un
   * parallélogramme, et c'est ce que fait le soleil.
   */
  const ECART = (25 * Math.PI) / 180;
  const HAUTEUR = (34 * Math.PI) / 180;
  const cap = meilleurCap + ECART;
  const portee = 16;
  /* Le soleil est placé au-dessus du centre du logement plutôt qu'au-dessus
     d'une fenêtre : la carte d'ombre est centrée sur la cible, et une source
     décentrée en gaspillerait la moitié. */
  return new THREE.Vector3(
    Math.cos(cap) * portee,
    Math.tan(HAUTEUR) * portee,
    Math.sin(cap) * portee,
  );
}

function lights(
  scene: THREE.Scene,
  /** Le plus grand côté de l'emprise, en mètres. */
  extent: number,
  /** La plus haute hauteur sous plafond du logement. */
  ceiling: number,
  rooms: PlanRoom[],
  doors: PlanDoor[],
): void {
  /*
   * L'équilibre a été refait quand la carte d'environnement est arrivée.
   *
   * Avant elle, l'ambiante et l'hémisphérique portaient à elles seules tout ce
   * que le soleil n'atteint pas, et il leur fallait des valeurs fortes. La carte
   * fait maintenant ce travail — mieux, puisqu'elle est directionnelle : un mur
   * tourné vers la fenêtre reçoit le ciel, un mur tourné vers l'intérieur reçoit
   * la pièce. Garder les anciennes valeurs revenait à compter deux fois, et
   * l'image partait au blanc.
   *
   * Il reste une hémisphérique faible, et elle sert à une chose précise : la
   * carte est cuite dehors, elle ne sait rien des plafonds. Sans ce reste, un
   * plafond peint en blanc rend gris sale — physiquement défendable, mais c'est
   * l'inverse de ce qu'on vient montrer.
   */
  /*
   * L'équilibre a basculé du côté du ciel avec le passage en maquette.
   *
   * Un soleil à 2,4 contre une hémisphérique à 0,6, c'est un rapport de quatre
   * — le rapport d'une photographie d'intérieur en plein midi, avec ses
   * hautes lumières brûlées et ses ombres bouchées. C'est aussi ce qui rendait
   * les images dures : chaque pièce avait un côté cramé et un côté noir, et
   * l'œil lisait « rendu 3D » avant de lire « logement ».
   *
   * Une maquette est éclairée comme un objet posé sur une table : beaucoup de
   * ciel, un soleil qui ne fait que dire d'où vient le jour. Le rapport tombe
   * à un et demi. Les ombres restent — sans elles le décor redevient un patron
   * découpé — mais elles se lisent au lieu de trancher.
   */
  scene.add(new THREE.HemisphereLight(0xfff4e4, 0xd9d2c6, 1.35));

  const sun = new THREE.DirectionalLight(0xfff0d6, 1.45);
  const from = sunDirection(rooms, doors);
  sun.position.copy(from);
  sun.castShadow = true;
  /* Mille vingt-quatre pixels pour un logement entier donnaient une ombre en
     escalier sur le nez des marches et le bord des tablettes. Le coût d'une
     carte deux fois plus fine se paie une fois par image, et la scène ne compte
     plus qu'une cinquantaine d'appels : elle peut se le permettre. */
  sun.shadow.mapSize.set(2048, 2048);
  /*
   * L'étendue de la carte d'ombre, calculée et non devinée.
   *
   * Elle valait « la moitié du plus grand côté, plus deux mètres ». Pour un
   * logement en L de dix mètres sur cinq, cela fait sept — mais la caméra
   * d'ombre regarde en biais, et ce qu'elle doit couvrir est la *diagonale* du
   * plan, augmentée de ce que la hauteur projette au sol sous l'angle du
   * soleil. Le compte tombait à peu près trois mètres court : au-delà, plus
   * rien n'était ombré, et la limite se voyait en trait clair en travers du
   * mur du fond.
   *
   * On ne prend pas non plus une marge confortable : à résolution fixe, une
   * carte deux fois plus large est une ombre deux fois plus grossière.
   */
  const elevation = Math.max(0.15, Math.atan2(from.y, Math.hypot(from.x, from.z)));
  const reach = extent * 0.72 + ceiling / Math.tan(elevation);
  const frustum = sun.shadow.camera as THREE.OrthographicCamera;
  frustum.left = -reach;
  frustum.right = reach;
  frustum.top = reach;
  frustum.bottom = -reach;
  frustum.near = 0.5;
  frustum.far = 40;
  frustum.updateProjectionMatrix();
  // Le biais compense l'auto-ombrage d'une surface plane : sans lui, les sols
  // se couvrent de moirures là où la lumière les frôle.
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.022;
  scene.add(sun);
  scene.add(sun.target);

  const bounce = new THREE.DirectionalLight(0xd8e4f2, 0.3);
  bounce.position.set(9, 4, 7);
  scene.add(bounce);
}

/**
 * Le sol du palier, sous et autour du logement.
 *
 * Sans lui, la première image de la page montre une porte et un pan de mur
 * flottant dans le ciel : on ne comprend pas où l'on se trouve, et la porte
 * cesse d'être une porte. Un simple plan sombre, très large, suffit à poser le
 * sol sous les pieds du visiteur — et il reçoit l'ombre de la façade, ce qui
 * ancre le bâti au lieu de le poser dessus.
 */
function ground(dehors: Dehors, disposables: { dispose(): void }[]): THREE.Mesh {
  const jardin = dehors === 'jardin';
  const geometry = new THREE.PlaneGeometry(220, 220);
  const material = new THREE.MeshStandardMaterial({
    color: jardin ? OUTSIDE.pelouse : OUTSIDE.rue,
    roughness: ROUGHNESS.dehors,
  });
  disposables.push(geometry, material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  /* En ville, sept mètres plus bas : le logement est à un étage, comme la
     quasi-totalité des locations de ce type. Au niveau du sol, chaque fenêtre
     donnait sur un aplat de terre à hauteur d'œil — la vue la plus déprimante
     possible pour un bien qu'on essaie de montrer sous son meilleur jour.

     Une maison de plain-pied, elle, est *au* sol : douze centimètres sous le
     plancher, la hauteur d'une marche de seuil. C'est ce qui fait qu'on voit la
     pelouse commencer au ras de la baie au lieu de flotter au-dessus. */
  mesh.position.y = jardin ? -0.12 : -7;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Le vis-à-vis : ce qu'on voit par les fenêtres.
 *
 * Un pan d'immeuble en face de chaque façade percée. Sans lui, une fenêtre
 * s'ouvre sur un dégradé de ciel uniforme, et l'œil comprend immédiatement
 * qu'il n'y a rien derrière — le volume perd d'un coup ce qu'on venait de lui
 * gagner. Avec, la profondeur de champ existe : il y a un dehors.
 */
/**
 * La façade d'en face, avec ses fenêtres.
 *
 * Ce qu'on voit par une fenêtre compte autant que la fenêtre. Un aplat brun à
 * dix-neuf mètres ne dit rien — ni la distance, ni l'échelle, ni qu'il y a une
 * rue. Quelques rangées de fenêtres suffisent : elles donnent au vis-à-vis une
 * taille, donc une distance, et le logement cesse d'être une boîte posée dans
 * le vide.
 *
 * Volontairement sans détail : ce sont des rectangles sombres sur une pierre
 * claire, à la limite de la lisibilité depuis l'intérieur. Une façade
 * travaillée attirerait le regard dehors, ce qui est exactement ce qu'on ne
 * veut pas d'une visite d'appartement.
 */
function facadeTexture(tone: number, disposables: Bin[]): THREE.Texture {
  /* Assez fin pour que la fenêtre ait un bord : à deux cent cinquante-six
     pixels de large pour trente-huit mètres, un texel faisait quinze
     centimètres et les fenêtres rendaient en carrés flous. */
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d')!;
  const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
  context.fillStyle = hex(tone);
  context.fillRect(0, 0, W, H);

  /* Un étage tous les huit pixels de hauteur : la texture couvre trente-huit
     mètres de large sur douze de haut, donc l'étage fait à peu près deux
     mètres soixante-quinze. */
  /* Quatre étages sur douze mètres : deux mètres soixante-quinze de hauteur
     d'étage, et treize travées sur trente-huit mètres, soit une travée de deux
     mètres quatre-vingt-dix. Ce sont les proportions d'un immeuble de rapport,
     et c'est ce qui donne au vis-à-vis son échelle — donc sa distance. */
  const etages = 4;
  const travees = 13;
  const hauteurEtage = H / (etages + 0.5);
  const pas = W / travees;

  /*
   * Ce qu'on ajoute ici n'est pas du décor : c'est ce qui donne une adresse.
   *
   * La façade d'en face est dans le champ de chaque fenêtre du logement, donc
   * dans la moitié des images de la visite. Réduite à des trous sombres dans un
   * aplat, elle se lit comme un fond peint — et un fond peint derrière une
   * fenêtre par ailleurs juste est ce qui ramène toute l'image au rang de
   * maquette.
   *
   * Trois traits suffisent, et ce sont ceux qu'on voit depuis n'importe quelle
   * fenêtre parisienne : le bandeau qui marque chaque plancher, le balcon
   * filant en fer forgé, et le zinc du dernier niveau au-dessus d'une corniche.
   * Aucun ne coûte de géométrie — tout est peint dans la texture.
   */

  // Le calcaire n'est pas d'un seul ton : chaque travée a vieilli à sa façon.
  for (let travee = 0; travee < travees; travee += 1) {
    const ecart = (bruit(travee, 7, 13) - 0.5) * 0.06;
    context.fillStyle =
      ecart > 0 ? `rgba(255,255,255,${ecart.toFixed(3)})` : `rgba(24,20,16,${(-ecart).toFixed(3)})`;
    context.fillRect(travee * pas, 0, pas, H);
  }

  // Le bandeau de plancher : un ressaut clair, et son ombre juste dessous.
  for (let etage = 1; etage <= etages; etage += 1) {
    const y = H - etage * hauteurEtage;
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(0, y - 2, W, 2.5);
    context.fillStyle = 'rgba(24,20,16,0.1)';
    context.fillRect(0, y + 0.5, W, 1.5);
  }

  /* Le zinc du comble, sous lequel court la corniche. C'est la ligne qui dit
     « Paris » avant même qu'on ait compté les étages. */
  const comble = hauteurEtage * 0.5;
  context.fillStyle = 'rgba(74,78,82,0.34)';
  context.fillRect(0, 0, W, comble - 4);
  context.fillStyle = 'rgba(255,255,255,0.24)';
  context.fillRect(0, comble - 4.5, W, 4.5);
  context.fillStyle = 'rgba(24,20,16,0.13)';
  context.fillRect(0, comble, W, 2);

  for (let etage = 0; etage < etages; etage += 1) {
    for (let travee = 0; travee < travees; travee += 1) {
      /* Deux fenêtres sur trente sont éteintes ou masquées : une grille
         parfaitement régulière se lit comme un motif, pas comme un immeuble. */
      const manque = bruit(travee, etage, 21) < 0.07;
      if (manque) continue;
      const largeur = pas * 0.34;
      const hauteur = hauteurEtage * 0.52;
      const x = travee * pas + (pas - largeur) / 2;
      const y = H - (etage + 1) * hauteurEtage + hauteurEtage * 0.2;
      // Le tableau de la fenêtre, puis le vitrage, plus sombre encore.
      context.fillStyle = 'rgba(255,255,255,0.22)';
      context.fillRect(x - 1.5, y - 1.5, largeur + 3, hauteur + 3);
      const nuit = 0.34 + bruit(travee, etage, 31) * 0.18;
      context.fillStyle = `rgba(26,24,22,${nuit.toFixed(3)})`;
      context.fillRect(x, y, largeur, hauteur);
    }
  }

  /*
   * Les balcons filants, au deuxième et au dernier étage habitable.
   *
   * Ce n'est pas un choix d'esthète : la loi de 1859 impose l'alignement des
   * balcons, et l'usage les a mis à ces deux niveaux-là. C'est pour cela qu'une
   * façade parisienne se reconnaît de dos, sans en lire un seul détail — deux
   * lignes horizontales sombres à des hauteurs précises.
   */
  for (const etage of [etages - 3, etages - 1]) {
    if (etage < 0) continue;
    const appui = H - (etage + 1) * hauteurEtage + hauteurEtage * 0.72;
    const rampe = hauteurEtage * 0.3;
    // La dalle de pierre, en léger débord.
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(0, appui, W, 2.5);
    // Les barreaux de fonte, puis la main courante qui les tient.
    context.fillStyle = 'rgba(30,28,26,0.4)';
    for (let x = 1; x < W; x += 3.2) context.fillRect(x, appui - rampe, 1.1, rampe);
    context.fillStyle = 'rgba(30,28,26,0.52)';
    context.fillRect(0, appui - rampe, W, 1.8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  disposables.push(texture);
  return texture;
}

function surroundings(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  origin: PlanPoint,
  disposables: { dispose(): void }[],
  dehors: Dehors = 'ville',
): THREE.Group {
  if (dehors === 'jardin') return garden(rooms, doors, origin, disposables);
  const group = new THREE.Group();
  group.name = 'vis-a-vis';
  const stone = new THREE.MeshStandardMaterial({
    map: facadeTexture(OUTSIDE.vis_a_vis, disposables),
    roughness: ROUGHNESS.dehors,
  });
  // Plus loin, plus clair : c'est ce que fait l'atmosphère, et c'est ce qui
  // donne la profondeur sans coûter un seul calcul de plus.
  const far = new THREE.MeshStandardMaterial({
    map: facadeTexture(OUTSIDE.vis_a_vis_loin, disposables),
    roughness: ROUGHNESS.dehors,
  });
  disposables.push(stone, far);

  const placed: number[] = [];
  for (const window of doors) {
    if (window.kind !== 'window') continue;
    const room = rooms.find((candidate) => candidate.id === (window.from || window.to));
    if (!room) continue;

    const angle = alphaOf(window.a, window.b);
    // Une seule façade par orientation : deux fenêtres sur le même mur n'ont
    // pas besoin de deux immeubles.
    const key = Math.round((angle * 180) / Math.PI);
    if (placed.some((seen) => Math.abs(seen - key) < 5)) continue;
    placed.push(key);

    const middle = { x: (window.a.x + window.b.x) / 2, y: (window.a.y + window.b.y) / 2 };
    let out = { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };
    if (containsPoint(room, { x: middle.x + out.x * 0.05, y: middle.y + out.y * 0.05 })) {
      out = { x: -out.x, y: -out.y };
    }

    /* Deux plans successifs plutôt qu'un seul mur. Assez bas pour qu'il reste
       du ciel au-dessus — une première version montait à vingt-deux mètres à
       quinze de distance, la façade d'en face bouchait entièrement chaque
       fenêtre et le logement paraissait aveugle — et assez décalés pour qu'on
       lise une rue, et non un panneau. */
    /* Les toitures tombent volontairement bas : à un étage, on voit le ciel
       au-dessus de l'immeuble d'en face, et c'est ce qui fait qu'un logement
       paraît clair. Réglées trop haut, les façades bouchaient chaque fenêtre et
       l'appartement semblait aveugle. */
    for (const [reach, tall, lift, tone] of [
      [19, 12, -3.5, stone],
      [29, 18, -2, far],
    ] as const) {
      const geometry = new THREE.BoxGeometry(38, tall, 2);
      disposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, tone);
      mesh.position.set(
        middle.x - origin.x + out.x * reach,
        lift,
        middle.y - origin.y + out.y * reach,
      );
      mesh.rotation.y = -angle;
      group.add(mesh);
    }
  }
  return group;
}

/**
 * Le dehors d'une maison de plain-pied.
 *
 * Il remplace le vis-à-vis d'immeuble, et il ne s'écrit pas de la même façon.
 * En ville, on pose un pan de façade en face de chaque fenêtre : chaque
 * ouverture regarde dans une direction, et cette direction a un vis-à-vis. Une
 * maison, elle, est **posée dans un terrain** — la haie fait le tour, et ce qui
 * compte est qu'il n'y ait pas de trou dans le coin où deux façades se
 * rencontrent. On borne donc l'emprise du bâti, pas chaque baie.
 *
 * Trois plans, et pas un de plus :
 *
 *  · **la haie**, à neuf mètres, un mètre soixante-dix de haut. Sa hauteur est
 *    le seul chiffre qui compte : elle passe à deux centimètres sous l'œil, si
 *    bien qu'on voit son dessus et, par-dessus, autre chose. Montée à deux
 *    mètres elle murait le jardin ; descendue à un mètre elle cessait de border
 *    quoi que ce soit et le terrain partait à l'infini.
 *  · **les arbres**, en masses de feuillage sans tronc. Un tronc à vingt mètres
 *    fait deux pixels de large : il coûte de la géométrie et ne se voit pas.
 *    Ce qui se lit d'une baie, c'est la silhouette des houppiers sur le ciel.
 *  · **la lisière du fond**, à trente mètres, plus claire — l'atmosphère fait
 *    ça, et c'est ce qui donne la profondeur sans un seul calcul de plus.
 *
 * Aucun détail au-delà. Un jardin travaillé attirerait le regard dehors, ce qui
 * est exactement ce qu'on ne veut pas d'une visite de logement.
 */
function garden(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  origin: PlanPoint,
  disposables: Bin[],
): THREE.Group {
  void doors;
  const group = new THREE.Group();
  group.name = 'jardin';

  const box = planBounds(rooms);
  const hx = (box.maxX - box.minX) / 2;
  const hz = (box.maxY - box.minY) / 2;
  const SOL = -0.12;

  const haie = new THREE.MeshStandardMaterial({ color: OUTSIDE.haie, roughness: ROUGHNESS.dehors });
  const loin = new THREE.MeshStandardMaterial({
    color: OUTSIDE.lointain,
    roughness: ROUGHNESS.dehors,
  });
  const dalle = new THREE.MeshStandardMaterial({
    color: OUTSIDE.dalle,
    roughness: ROUGHNESS.dehors,
  });
  disposables.push(haie, loin, dalle);

  const batch = new Batch();
  const pose = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => batch.add(geometry, material, new THREE.Matrix4().makeTranslation(x, y, z));

  /* La haie : quatre haies qui se recouvrent aux angles. Se recouvrir est le
     but — bout à bout, il restait au coin un jour de quelques centimètres par
     lequel on voyait le ciel au ras du sol, et un trou de ciel au niveau de
     l'herbe se remarque tout de suite. */
  const RECUL = 9;
  const HAUT = 1.7;
  const EPAIS = 0.85;
  const px = hx + RECUL;
  const pz = hz + RECUL;
  for (const z of [-pz, pz]) {
    pose(new THREE.BoxGeometry(px * 2 + EPAIS, HAUT, EPAIS), haie, 0, SOL + HAUT / 2, z);
  }
  for (const x of [-px, px]) {
    pose(new THREE.BoxGeometry(EPAIS, HAUT, pz * 2 + EPAIS), haie, x, SOL + HAUT / 2, 0);
  }

  /* Les houppiers. Les positions viennent d'une suite déterministe : une
     scène qui change de forme à chaque chargement n'est pas une scène qu'on
     peut contrôler en image. */
  let graine = 7;
  const suivant = () => {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
  };
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + suivant() * 0.3;
    /* Vingt mètres au minimum. À quinze, un houppier passait dans le cadre
       d'une fenêtre à une taille où l'on comptait ses facettes — et une sphère
       à neuf méridiens comptée de près n'est pas un arbre, c'est un polyèdre.
       Loin, la même sphère est une masse, ce qu'un houppier est effectivement. */
    const rayon = 20 + suivant() * 9;
    const taille = 2.4 + suivant() * 1.6;
    pose(
      new THREE.SphereGeometry(taille, 10, 7),
      i % 3 === 0 ? loin : haie,
      Math.cos(angle) * (px + rayon - RECUL),
      SOL + 2.8 + suivant() * 2.2,
      Math.sin(angle) * (pz + rayon - RECUL),
    );
  }

  // La lisière du fond, qui ferme l'horizon sous le ciel.
  const LOIN = 30;
  for (const z of [-(hz + LOIN), hz + LOIN]) {
    pose(new THREE.BoxGeometry((hx + LOIN) * 2, 7, 2.5), loin, 0, SOL + 3.5, z);
  }
  for (const x of [-(hx + LOIN), hx + LOIN]) {
    pose(new THREE.BoxGeometry(2.5, 7, (hz + LOIN) * 2), loin, x, SOL + 3.5, 0);
  }

  /* La terrasse, contre la façade jardin, sous la baie. Sans elle, l'herbe
     monte jusqu'au vitrage et la baie donne l'impression de s'ouvrir sur un
     champ ; avec, on lit une maison qui a un dehors habité. */
  pose(
    new THREE.BoxGeometry(hx * 1.5, 0.1, 3.2),
    dalle,
    0,
    SOL + 0.05,
    hz + 1.6,
  );

  /*
   * Le toit.
   *
   * Une maison sans toit vue du dehors n'est pas une maison : c'est une boîte.
   * Et le dehors, ici, ce sont les trois premiers pour cent du défilement — la
   * toute première image du site, celle qui décide si l'on continue. Deux pans
   * et deux pignons suffisent à ce qu'on lise « maison de plain-pied » avant
   * d'avoir lu la légende.
   *
   * **Il ne projette pas d'ombre**, et c'est délibéré. Le débord de quarante-
   * cinq centimètres, sous un soleil à trente-quatre degrés, rabat soixante-sept
   * centimètres d'ombre sur la façade — donc sur le haut de chaque fenêtre,
   * donc sur la lumière de chaque pièce. Or il n'est vu que du dehors, et
   * seulement en silhouette : lui payer une ombre reviendrait à assombrir tout
   * l'intérieur pour un objet que la visite ne montre jamais de près.
   */
  const toit = new THREE.MeshStandardMaterial({
    color: OUTSIDE.toit,
    roughness: 0.85,
    /* Le drapeau existe pour le verre — une vitre écrit dans la carte d'ombre
       comme un mur — et il sert ici pour la même raison de fond : un objet
       qu'on ne voit qu'en silhouette n'a pas à peser sur la lumière du dedans. */
    userData: { sansOmbre: true },
  });
  disposables.push(toit);
  const plafond = rooms.reduce((haut, room) => Math.max(haut, room.height), 2.5);
  const DEBORD = 0.45;
  const rx = hx + DEBORD;
  const rz = hz + DEBORD;
  const PENTE = (18 * Math.PI) / 180;
  const faite = rz * Math.tan(PENTE);
  const rampant = rz / Math.cos(PENTE);
  /* Huit centimètres au-dessus du plafond, et pas zéro.
     Posé pile dessus, le dessous du bandeau et la dalle de plafond étaient
     coplanaires : deux surfaces à la même profondeur, que le tampon départage
     au bit près. Le résultat se voyait dans *toutes* les images d'intérieur —
     des échardes noires en travers du plafond, à chaque pièce. Un centimètre
     aurait suffi à l'échelle de la scène ; huit tiennent aussi à distance de
     projection, où la précision du tampon est plus grossière. */
  const JEU = 0.08;

  // Le bandeau, qui ferme le haut des murs sous les pans.
  pose(new THREE.BoxGeometry(rx * 2, 0.24, rz * 2), toit, 0, plafond + JEU + 0.12, 0);

  for (const sens of [-1, 1]) {
    batch.add(
      new THREE.BoxGeometry(rx * 2, 0.18, rampant),
      toit,
      new THREE.Matrix4()
        .makeRotationX(-sens * PENTE)
        .setPosition(0, plafond + JEU + 0.24 + faite / 2, (sens * rz) / 2),
    );
  }

  for (const sens of [-1, 1]) {
    const pignon = new THREE.Shape();
    pignon.moveTo(-rz, 0);
    pignon.lineTo(rz, 0);
    pignon.lineTo(0, faite);
    pignon.closePath();
    batch.add(
      new THREE.ShapeGeometry(pignon),
      toit,
      new THREE.Matrix4()
        .makeRotationY((sens * Math.PI) / 2)
        .setPosition(sens * rx, plafond + JEU + 0.24, 0),
    );
  }

  batch.flush(group, disposables);
  return group;
}

/**
 * Le perron, devant la porte d'une maison.
 *
 * Il tient le même rôle que le palier d'immeuble — sans lui, la première image
 * du site montre une porte et un pan de mur seuls dans le ciel, et une porte
 * qu'on ne situe pas cesse d'être une porte — mais il le tient à l'envers.
 *
 * Le palier joue du contraste : on part d'une cage d'escalier sombre et fermée
 * pour entrer dans un logement clair, et ce passage fait la moitié de l'effet.
 * Devant une maison, ce contraste-là n'existe pas et le fabriquer serait un
 * mensonge : on est dehors, en plein jour. Ce qui reste à faire est plus
 * simple, et c'est déjà beaucoup — **donner un sol sous les pieds, un abri
 * au-dessus de la tête et un cadre autour de la porte.** Trois choses, et l'on
 * comprend qu'on se tient devant une entrée plutôt que devant une image.
 */
function porch(
  entrance: Entrance,
  rooms: PlanRoom[],
  doors: PlanDoor[],
  origin: PlanPoint,
  disposables: Bin[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'perron';
  const room = rooms.find((candidate) => candidate.id === entrance.roomId);
  if (!room) return group;

  const { a, b } = entrance.door;
  const door = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  let out = { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };
  if (containsPoint(room, { x: door.x + out.x * 0.05, y: door.y + out.y * 0.05 })) {
    out = { x: -out.x, y: -out.y };
  }

  const dalle = new THREE.MeshStandardMaterial({
    color: OUTSIDE.dalle,
    roughness: ROUGHNESS.dehors,
  });
  const enduit = new THREE.MeshStandardMaterial({
    color: OUTSIDE.enduit,
    roughness: ROUGHNESS.dehors,
  });
  disposables.push(dalle, enduit);

  /** Un point du perron, repéré en (le long du mur, vers l'extérieur, hauteur). */
  const at = (alongWall: number, outward: number, lift: number) =>
    new THREE.Vector3(
      door.x - origin.x + Math.cos(angle) * alongWall + out.x * outward,
      lift,
      door.y - origin.y + Math.sin(angle) * alongWall + out.y * outward,
    );

  /* Un lot par matériau, comme partout ailleurs dans ce fichier.
     Le perron compte une quinzaine de dalles pour deux teintes : posées une par
     une, c'étaient quinze appels de dessin pour un décor qu'on ne voit que trois
     secondes. Fusionnées, deux. Sur la maison entière la mesure est passée de
     111 appels par image à moins de quatre-vingt-dix. */
  const batch = new Batch();
  const slab = (
    alongWall: number,
    outward: number,
    lift: number,
    size: [number, number, number],
    material: THREE.Material,
  ) => {
    batch.add(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      material,
      new THREE.Matrix4().makeRotationY(-angle).setPosition(at(alongWall, outward, lift)),
    );
  };

  const LARGEUR = 3.4;
  const PROFONDEUR = 2.8;
  const ALLEE = 14;

  /* La dalle du perron, puis l'allée qui s'en va. L'allée n'est pas du décor :
     c'est elle qui donne la direction du regard sur la toute première image, et
     sans elle la caméra se tient sur une pelouse, nulle part. */
  slab(0, PROFONDEUR / 2, -0.035, [LARGEUR, 0.07, PROFONDEUR], dalle);
  slab(0, PROFONDEUR + ALLEE / 2, -0.06, [1.5, 0.06, ALLEE], dalle);

  /* Une marche au seuil : douze centimètres, la hauteur dont le terrain est
     descendu. Sans elle, le plancher intérieur et la pelouse se rejoignaient
     au même niveau et la maison paraissait posée sur l'herbe. */
  slab(0, 0.28, -0.075, [LARGEUR * 0.62, 0.09, 0.56], dalle);

  /* L'auvent et ses deux poteaux. C'est ce qui fait qu'on lit une entrée de
     maison plutôt qu'une porte dans un mur : partout, une porte d'entrée est
     abritée, et c'est cet abri qu'on reconnaît avant la porte. */
  /*
   * L'auvent, et rien d'autre au-dessus.
   *
   * Première version : un auvent de deux mètres dix sur deux poteaux, comme un
   * porche. En image, la caméra se tenant à deux mètres quatre-vingt-dix de la
   * porte se retrouvait *sous* l'abri, entre deux poteaux, sous un plafond —
   * c'est-à-dire exactement dans la cage d'escalier qu'on venait de remplacer.
   * Le décor avait changé, le cadrage non.
   *
   * Ce qu'il faut ici n'est pas un abri où l'on tient : c'est une casquette qui
   * dise « entrée » sans occuper le cadre. Quatre-vingt-dix centimètres en
   * porte-à-faux, et le ciel reste au-dessus de la tête.
   */
  const opening = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  const HAUT = 2.42;
  slab(0, 0.45, HAUT, [opening * 2 + 0.7, 0.12, 0.9], enduit);

  /*
   * La façade d'entrée, sur toute sa longueur.
   *
   * Le logement n'a pas de peau extérieure : ses murs sont tournés vers le
   * dedans, ce qui est le bon choix — une visite se passe à l'intérieur, et
   * doubler chaque mur reviendrait à doubler la géométrie pour trois secondes
   * d'image. Le palier d'immeuble s'en accommodait en fermant lui-même les deux
   * mètres qui l'entourent, parce qu'on ne voit rien d'autre d'une cage
   * d'escalier.
   *
   * Devant une maison, on voit tout. La première version fermait de la même
   * façon trois mètres quarante autour de la porte : au-delà, la caméra voyait
   * le ciel là où aurait dû se trouver la moitié droite de la maison. Une
   * maison dont la façade s'arrête à un mètre de la porte n'est pas une maison.
   *
   * On construit donc **le pan entier**, d'un bout à l'autre du plan, percé de
   * ses ouvertures — la porte et les fenêtres qui donnent sur cette rue-là. Le
   * découpage est une soustraction d'intervalles : on trie les ouvertures le
   * long du mur, on remplit ce qui reste entre elles, et on ajoute pour chacune
   * son allège et son imposte. Les fenêtres y gagnent un tableau vu de dehors,
   * ce qui est exactement ce qui manquait pour qu'elles se lisent comme des
   * fenêtres et non comme des trous.
   *
   * Un seul pan : c'est le seul que la visite regarde du dehors. Les trois
   * autres ne se voient que de l'intérieur, à travers un vitrage, où c'est le
   * jardin qu'on regarde et non le mur qu'on traverse.
   */
  const FACADE = Math.max(HAUT, room.height);
  const surLaLigne = (point: PlanPoint) =>
    Math.abs((point.x - door.x) * out.x + (point.y - door.y) * out.y) < 0.05;
  const leLong = (point: PlanPoint) =>
    (point.x - door.x) * Math.cos(angle) + (point.y - door.y) * Math.sin(angle);

  let gauche = -opening;
  let droite = opening;
  for (const candidate of rooms) {
    for (const point of candidate.points) {
      if (!surLaLigne(point)) continue;
      const u = leLong(point);
      if (u < gauche) gauche = u;
      if (u > droite) droite = u;
    }
  }

  const percees = [entrance.door, ...doors.filter((hole) => hole.id !== entrance.door.id)]
    .filter((hole) => surLaLigne(hole.a) && surLaLigne(hole.b))
    .map((hole) => {
      const u = [leLong(hole.a), leLong(hole.b)].sort((one, two) => one - two);
      return { de: u[0], a: u[1], allege: hole.sill, linteau: Math.min(hole.height, FACADE) };
    })
    .sort((one, two) => one.de - two.de);

  const pan = (de: number, a: number, bas: number, haut: number) => {
    if (a - de < 0.01 || haut - bas < 0.01) return;
    slab((de + a) / 2, 0.04, (bas + haut) / 2, [a - de, haut - bas, 0.08], enduit);
  };

  let curseur = gauche;
  for (const percee of percees) {
    pan(curseur, percee.de, 0, FACADE);
    pan(percee.de, percee.a, 0, percee.allege);
    pan(percee.de, percee.a, percee.linteau, FACADE);
    curseur = Math.max(curseur, percee.a);
  }
  pan(curseur, droite, 0, FACADE);

  /*
   * Le ciel de la façade d'entrée.
   *
   * Le soleil est placé en face de la plus grande ouverture du logement — pour
   * la maison, la baie du séjour, donc du côté jardin. La façade d'entrée est
   * par conséquent **à l'ombre de la maison elle-même**, à toute heure. C'est
   * juste, et c'est le cas de la moitié des maisons ; ce qui ne l'est pas, c'est
   * l'image qui en sortait : une porte presque noire, alors que dehors, à
   * l'ombre, un ciel dégagé éclaire encore beaucoup.
   *
   * Ce que la scène sous-estimait est cette lumière-là. La carte
   * d'environnement la porte pour les surfaces intérieures, mais elle est cuite
   * sur un dôme fermé : dehors, une façade voit la moitié du ciel, ce qui est
   * bien plus. On ajoute donc la part manquante, de face et sans ombre portée
   * — une ombre de plus coûterait une seconde carte pour éclairer trois murs.
   *
   * Bleutée, parce que c'est ce qu'est la lumière d'ombre ouverte : du ciel
   * sans soleil. Une fois posée, le contraste entre le perron et l'intérieur
   * chaud fonctionne dans le bon sens — on entre dans quelque chose de plus
   * chaud, pas de plus clair.
   */
  const ciel = new THREE.DirectionalLight(0xdce9f2, 2.1);
  ciel.position.copy(at(-1.2, 9, 7));
  ciel.target.position.copy(at(0, 0, 1.2));
  group.add(ciel);
  group.add(ciel.target);

  /* L'applique, à droite de la porte. Elle éclaire peu — il fait jour — mais
     elle est le seul objet du perron qui dise que quelqu'un habite ici. */
  const lampe = new THREE.PointLight(0xffd9a8, 3.2, 4.5, 2);
  lampe.position.copy(at(opening + 0.3, 0.2, 1.95));
  group.add(lampe);

  const verre = new THREE.MeshBasicMaterial({ color: 0xfff1da });
  const globe = new THREE.BoxGeometry(0.12, 0.2, 0.1);
  disposables.push(verre, globe);
  const source = new THREE.Mesh(globe, verre);
  source.position.copy(at(opening + 0.3, 0.09, 1.95));
  source.rotation.y = -angle;
  group.add(source);

  batch.flush(group, disposables);
  return group;
}

/**
 * Le parquet, en lames.
 *
 * Un aplat brun se lit comme un aplat brun, quelle que soit sa couleur. Ce qui
 * fait un sol, ce sont les joints : ils donnent une direction à la pièce, une
 * échelle — on compte les lames et on sait que la pièce fait quatre mètres — et
 * un peu de grain sous la lumière rasante.
 *
 * Deux mètres de motif pour dix lames de vingt centimètres, avec des joints en
 * bout décalés d'une rangée à l'autre. Les coordonnées d'un sol sont exprimées
 * en mètres — `ShapeGeometry` les reprend telles quelles — donc une répétition
 * de 0,5 fait tomber le motif exactement sur ses deux mètres.
 */
/*
 * Ce qui a disparu ici, et pourquoi.
 *
 * Trois fonctions vivaient à cet endroit : un bruit déterministe, un
 * fabricant de cartes de normales, et deux cartes bâties dessus — le grain de
 * l'enduit et le relief des lames. Elles marchaient, elles ne coûtaient pas un
 * triangle, et elles sont parties entières.
 *
 * Une carte de normales ne déplace rien : elle ment sur l'orientation de la
 * surface pour qu'un aplat reçoive la lumière comme s'il avait du relief. Le
 * mensonge tient de face et se défait en lumière rasante — c'est-à-dire à
 * chaque passage de porte, là où le regard traîne. Sur une image qui vise la
 * photographie, c'est un défaut qu'on accepte pour ce qu'il rapporte ; sur une
 * maquette, il ne rapporte rien, parce qu'une maquette n'a pas de grain.
 *
 * On garde le motif du sol, qui est un dessin et porte une échelle, et on
 * laisse le volume à ce qui le dit vraiment : l'occlusion cuite dans les
 * sommets, et la proportion des masses.
 *
 * Le bruit déterministe reste : il ne fabrique aucun relief, il sert à teinter
 * une lame et une pierre au hasard — un hasard qui doit donner le même mur à
 * chaque chargement, sans quoi le décor changerait de forme d'une visite à
 * l'autre et on ne pourrait plus le contrôler en image.
 */

/** Bruit de valeur, déterministe : deux exécutions donnent le même mur. */
function bruit(x: number, y: number, graine: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + graine * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/* ------------------------------------------------- point de Hongrie --- */

/*
 * Le parquet à chevrons, dit point de Hongrie.
 *
 * C'est la signature d'un appartement parisien, plus encore que la corniche :
 * on la reconnaît sur une photographie de vingt centimètres de côté. Les lames
 * sont coupées en biais et se rejoignent bout à bout le long d'un axe, ce qui
 * dessine des V emboîtés — à ne pas confondre avec les bâtons rompus, où les
 * lames sont coupées droit et s'emboîtent en L.
 *
 * Le motif se ramène à deux familles de droites, ce qui le rend exactement
 * répétable :
 *
 *  · les **axes**, verticaux, tous les `COLONNE` pixels : ce sont les lignes
 *    où deux lames se rencontrent bout à bout, et où le V se referme ;
 *  · les **rives**, obliques à quarante-cinq degrés, tous les `LAME` pixels
 *    mesurés perpendiculairement : ce sont les longs côtés des lames.
 *
 * L'inclinaison s'inverse d'une colonne à l'autre. C'est ce qui fait que les
 * rives des deux colonnes voisines se rejoignent exactement sur l'axe — la
 * démonstration tient en une ligne : à `u = 0` d'un côté et `u = COLONNE` de
 * l'autre, les deux familles retombent sur les mêmes ordonnées, multiples de
 * `LAME · √2`. Sans cette coïncidence le motif ne serait pas un chevron mais
 * deux hachures voisines.
 */
const CHEVRON_SIZE = 512;
/** Largeur d'une colonne, en pixels de texture. Une colonne vaut 50 cm au sol. */
const COLONNE = 128;
/** Nombre de rives par côté de texture. Fixe la largeur d'une lame : 8,8 cm. */
const RIVES = 16;
const LAME = CHEVRON_SIZE / (RIVES * Math.SQRT2);

/** Coordonnée en travers des lames, en pixels. Les rives sont ses multiples. */
function travers(x: number, y: number): number {
  const colonne = Math.floor(x / COLONNE);
  const u = x - colonne * COLONNE;
  const sens = colonne % 2 === 0 ? 1 : -1;
  return (u - sens * y) / Math.SQRT2;
}

/** Numéro de la lame sous un pixel : colonne et rang, pour la teinter. */
function lameSous(x: number, y: number): { colonne: number; rang: number } {
  return {
    colonne: Math.floor(x / COLONNE),
    rang: Math.floor(travers(x, y) / LAME),
  };
}

function plankTexture(disposables: Bin[]): THREE.Texture {
  const SIZE = CHEVRON_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(SIZE, SIZE);

  const base = SHELL.chene;
  const joint = SHELL.chene_joint;
  const canal = (couleur: number, decalage: number) => (couleur >> decalage) & 255;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const { colonne, rang } = lameSous(x, y);
      /* Chaque lame prend son propre écart de teinte, faible et déterministe :
         un vrai parquet n'a pas deux lames identiques, mais l'écart entre elles
         se compte en unités, pas en dizaines. */
      const teinte = 1 + (((rang * 5 + colonne * 3) % 7) - 3) * 0.035;
      // Le fil du bois court dans le sens de la lame.
      const fil = 1 + (bruit(Math.floor(travers(x, y)), Math.floor(x / 3), 11) - 0.5) * 0.05;

      // Distance aux deux familles de joints, en pixels.
      const aRive = Math.min(
        Math.abs(travers(x, y) - rang * LAME),
        Math.abs((rang + 1) * LAME - travers(x, y)),
      ) * Math.SQRT2;
      const aAxe = Math.min(x - colonne * COLONNE, (colonne + 1) * COLONNE - x);
      const creux = Math.min(aRive, aAxe) < 1.6 ? 1 : 0;

      const index = (y * SIZE + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const decalage = 16 - c * 8;
        const bois = Math.min(255, Math.round(canal(base, decalage) * teinte * fil));
        image.data[index + c] = creux ? canal(joint, decalage) : bois;
      }
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.5, 0.5);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  disposables.push(texture);
  return texture;
}

/** Angle d'un segment dans le repère du plan. */
const alphaOf = (a: PlanPoint, b: PlanPoint): number => Math.atan2(b.y - a.y, b.x - a.x);

/** Normale rentrante d'un mur, déduite du polygone et non supposée. */
function inwardNormal(room: PlanRoom, a: PlanPoint, b: PlanPoint): PlanPoint {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const candidate = { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };
  const probe = { x: middle.x + candidate.x * 0.02, y: middle.y + candidate.y * 0.02 };
  return containsPoint(room, probe) ? candidate : { x: -candidate.x, y: -candidate.y };
}

/**
 * Le bâti : sols, plafonds, murs percés, plinthes.
 *
 * Chaque pièce porte sa propre peau de mur, décalée vers l'intérieur d'une
 * demi-épaisseur. Sans ce décalage, deux pièces mitoyennes posent deux boîtes
 * exactement au même endroit et les faces clignotent l'une sur l'autre à chaque
 * mouvement de caméra — le défaut le plus visible qui soit, et le plus facile à
 * éviter. Accessoirement, c'est aussi ce qui donne à une cloison son épaisseur
 * et à une embrasure sa profondeur.
 */
function shell(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  origin: PlanPoint,
  disposables: { dispose(): void }[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bati';
  const jour = daylightSources(doors, origin);
  const batch = new Batch();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3(1, 1, 1);

  /*
   * Plus de cartes de normales, nulle part.
   *
   * Elles étaient là pour le grain de l'enduit et le relief des lames — un
   * faux relief, calculé sur l'orientation de la surface, sans un triangle de
   * plus. Bien faites, et à jeter quand même : une maquette n'a pas de grain.
   * Le faux relief est exactement ce qui trahit une image de synthèse — il se
   * comporte bien de face et se défait en lumière rasante, c'est-à-dire à
   * chaque passage de porte. Un pan de plâtre lisse, lui, ne se défait jamais.
   *
   * Ce qui reste pour dire le volume est ce qui le disait déjà vraiment :
   * l'occlusion cuite dans les sommets, et la proportion des masses.
   */
  const wall = new THREE.MeshStandardMaterial({
    color: SHELL.mur,
    roughness: ROUGHNESS.mur,
    vertexColors: true,
  });
  /* Une seule peinture pour tout ce qui est menuiserie : plinthes, corniches,
     chambranles, dormants, battants. C'est ainsi qu'on peint un appartement, et
     c'est aussi ce qui donne à la scène son unité. */
  const joinery = new THREE.MeshStandardMaterial({
    color: SHELL.menuiserie,
    roughness: ROUGHNESS.menuiserie,
    vertexColors: true,
  });
  /*
   * Le sol garde son dessin, et perd son relief.
   *
   * Le motif — le point de Hongrie — est une **information** : il donne une
   * direction à la pièce et une échelle qu'on peut compter, une lame vaut huit
   * centimètres et demi. C'est ce qu'un plan de maquette porte aussi, imprimé
   * à plat. Le relief, lui, était une imitation de matière, et c'est la seule
   * partie qui tirait vers la fausse photo.
   */
  const parquet = new THREE.MeshStandardMaterial({
    map: plankTexture(disposables),
    roughness: ROUGHNESS.parquet,
  });
  const carrelage = new THREE.MeshStandardMaterial({
    color: SHELL.carrelage,
    roughness: ROUGHNESS.carrelage,
  });
  const ceiling = new THREE.MeshStandardMaterial({
    color: SHELL.plafond,
    roughness: ROUGHNESS.plafond,
    side: THREE.DoubleSide,
  });
  /* Un rien de verre : de quoi dire qu'il y en a, sans éteindre la vue. Sous un
     éclairage sans reflets, une vitre trop marquée devient un voile gris et le
     logement paraît sale. */
  const glass = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xdce9f2,
    roughness: ROUGHNESS.verre,
    metalness: 0,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    userData: { sansOmbre: true },
  });
  disposables.push(wall, joinery, parquet, carrelage, ceiling, glass);

  /**
   * Le contour d'une dalle, prêt à être basculé à l'horizontale.
   *
   * Le `y` est inversé, et il le faut. Le repère du plan a son y vers le bas ;
   * la scène a son z vers l'avant. Une `ShapeGeometry` naît à plat dans le plan
   * XY, normale vers +Z, et on la couche en la faisant tourner autour de X :
   *
   *  · de +90°, l'empreinte tombe juste mais la normale pointe vers le **bas** —
   *    le sol est éliminé par le culling, le soleil ne l'atteint jamais, et à sa
   *    place on voit ce qu'il y a derrière ;
   *  · de −90°, la normale est bonne mais l'empreinte est **retournée** — le sol
   *    d'une pièce se retrouve ailleurs que la pièce.
   *
   * En inversant le y d'abord, la rotation de −90° donne les deux à la fois. Les
   * coordonnées de texture s'en trouvent miroitées sur un axe, ce qui n'a aucune
   * conséquence sur un motif de lames.
   */
  const toSlab = (p: PlanPoint) => new THREE.Vector2(p.x - origin.x, -(p.y - origin.y));

  for (const room of rooms) {
    /* Pièce d'eau : le sol est carrelé, et les murs le sont jusqu'à hauteur
       d'usage. Le test porte sur l'identifiant *et* le nom, parce qu'un relevé
       peut nommer la pièce sans que son identifiant le dise. */
    const mouille = /eau|bain|wc|douche/i.test(room.id + room.name);
    const shape = new THREE.Shape(room.points.map(toSlab));
    const slab = new THREE.ShapeGeometry(shape);
    slab.rotateX(-Math.PI / 2);
    /* Le pourtour, en coordonnées de scène, pour l'assombrissement d'angle. */
    const bord = room.points.map((p) => [p.x - origin.x, p.y - origin.y] as const);
    /* Le clone est pris avant la mise en lot : subdiviser rend une géométrie
       neuve et libère l'ancienne, donc la source n'est plus une source. */
    const top = slab.clone();
    batch.add(
      slab,
      mouille ? carrelage : parquet,
      IDENTITE,
      (x, y, z) => daylightAt(jour, x, y, z) * angleMort(bord, x, z, RECOIN_SOL),
      MAILLE_DALLE,
    );

    // Le plafond regarde vers le bas. Il reste en double face : depuis la pièce
    // voisine, le regard passe par une porte et le prend par-dessus.
    batch.add(
      top,
      ceiling,
      matrix.makeTranslation(0, room.height, 0),
      /*
       * Le plafond est la plus grande surface du champ quand la caméra est à
       * hauteur d'œil, et c'était la plus plate : une seule teinte du mur au
       * mur. Deux choses le sauvent, et aucune n'est un objet posé dessus — la
       * décroissance du jour, qui creuse le fond de la pièce, et l'ombre du
       * pourtour, qui rattache le plafond aux murs au lieu de le laisser
       * flotter au-dessus d'eux comme un couvercle.
       */
      (x, y, z) => daylightAt(jour, x, y, z) * angleMort(bord, x, z, RECOIN_PLAFOND),
      MAILLE_DALLE,
    );

    /*
     * Les murs montent vingt centimètres au-dessus du plafond.
     *
     * Sinon les deux s'arrêtent exactement à la même hauteur, et au ras du
     * plafond le regard passe par-dessus l'arête du mur : on aperçoit alors le
     * vide entre deux pièces — un logement n'est pas un rectangle plein, il a
     * des creux — et donc le ciel, en plein milieu de l'appartement. Le
     * surplus est caché par le plafond, il ne coûte rien.
     */
    const shellTop = room.height + 0.2;

    for (const segment of roomWalls(room)) {
      const openings: Interval[] = [];
      const framed: { span: Interval; door: PlanDoor }[] = [];
      for (const door of doors) {
        const span = projectOnWall(segment, { a: door.a, b: door.b });
        if (span) {
          openings.push(span);
          framed.push({ span, door });
        }
      }

      const length = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      const angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
      const normal = inwardNormal(room, segment.a, segment.b);

      const thickness = wallThickness(room, segment, rooms, SKIN, FACADE);

      /**
       * Habille une ouverture : chambranle pour une porte, dormant, meneau,
       * tablette et vitre pour une fenêtre.
       *
       * C'est ce qui distingue une ouverture d'un trou. Un trou rectangulaire
       * dans un mur ne se lit pas comme une porte, quelle que soit sa taille —
       * il manque l'encadrement, et l'œil le réclame avant tout le reste.
       */
      const dress = (span: Interval, door: PlanDoor) => {
        const width = (span.to - span.from) * length;
        if (width < 0.2) return;
        const jamb = 0.055;
        const inset = span.to - span.from;
        const side = (inset * 0.5 * jamb) / Math.max(width, 0.001);

        if (door.kind === 'window') {
          // Dormant : deux montants, une traverse haute, une allège.
          panel(span.from, span.from + side, door.sill, door.height - door.sill, joinery, thickness + 0.02);
          panel(span.to - side, span.to, door.sill, door.height - door.sill, joinery, thickness + 0.02);
          panel(span.from, span.to, door.height - jamb, jamb, joinery, thickness + 0.02);
          panel(span.from, span.to, door.sill, jamb, joinery, thickness + 0.02);
          // Meneau central : le trait qui fait qu'on lit « fenêtre » et non « ouverture ».
          const middleSpan = (span.from + span.to) / 2;
          panel(middleSpan - side / 2, middleSpan + side / 2, door.sill, door.height - door.sill, joinery, thickness + 0.02);
          // Tablette d'appui, qui déborde franchement dans la pièce.
          panel(span.from - side, span.to + side, door.sill - 0.04, 0.04, joinery, thickness + 0.14);
          // La vitre, au nu extérieur de l'embrasure.
          panel(span.from, span.to, door.sill, door.height - door.sill, glass, 0.012);
          return;
        }

        // Porte ou passage : un chambranle sur trois côtés.
        panel(span.from - side, span.from, 0, door.height + jamb, joinery, thickness + 0.03);
        panel(span.to, span.to + side, 0, door.height + jamb, joinery, thickness + 0.03);
        panel(span.from - side, span.to + side, door.height, jamb, joinery, thickness + 0.03);
      };

      const panel = (from: number, to: number, bottom: number, height: number, material: THREE.Material, depth = thickness) => {
        const width = (to - from) * length;
        if (width < 0.008 || height < 0.008) return;
        const centre = pointAt(segment, (from + to) / 2);
        /*
         * Un panneau haut reçoit des strates.
         *
         * L'occlusion est cuite dans les sommets, et un mur de deux mètres
         * soixante n'en avait que deux dans le sens de la hauteur : la bande
         * sombre de trente centimètres au pied du mur se retrouvait étirée sur
         * toute sa hauteur, c'est-à-dire transformée en un voile uniforme. Le
         * calcul était juste et le maillage n'avait pas la place de le porter.
         * Seize centimètres de pas suffisent à retrouver la courbe ; le
         * chanfrein de deux millimètres saute au passage, et il ne manque à
         * personne sur une surface que la plinthe et la corniche encadrent.
         */
        const strates = height > 0.5 ? Math.min(20, Math.round(height / 0.16)) : 1;
        const geometry = box(width, height, depth, CHANFREIN_BATI, strates);
        worldUv(geometry, width, height, from * length, bottom);
        position.set(
          centre.x - origin.x + normal.x * (depth / 2),
          bottom + height / 2,
          centre.y - origin.y + normal.y * (depth / 2),
        );
        quaternion.setFromAxisAngle(AXE_Y, -angle);
        batch.add(geometry, material, matrix.compose(position, quaternion, echelle), (x, y, z) =>
          occlusionAt(y, room.height) * daylightAt(jour, x, y, z),
        );
      };

      /**
       * Pose une moulure : le profil est extrudé le long du mur, depuis sa face.
       *
       * Le repère local du profil est (saillie, hauteur) ; l'extrusion se fait
       * selon z. La matrice envoie donc x sur la normale intérieure du mur, y
       * vers le haut, z le long du mur — et la translation place l'origine au
       * début du tronçon, sur la face du mur et non sur la ligne du plan.
       */
      const moulding = (
        from: number,
        to: number,
        bottom: number,
        profil: Profil,
        material: THREE.Material,
      ) => {
        const run = (to - from) * length;
        if (run < 0.02) return;
        const shape = new THREE.Shape(profil.map(([x, y]) => new THREE.Vector2(x, y)));
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: run,
          bevelEnabled: false,
          curveSegments: 1,
        });
        const start = pointAt(segment, from);
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const placement = new THREE.Matrix4().set(
          normal.x, 0, dir.x, start.x - origin.x + normal.x * thickness,
          0,        1, 0,     bottom,
          normal.y, 0, dir.y, start.y - origin.y + normal.y * thickness,
          0,        0, 0,     1,
        );
        batch.add(geometry, material, placement, (x, y, z) =>
          occlusionAt(y, room.height) * daylightAt(jour, x, y, z),
        );
      };

      for (const span of solidSpans(openings)) {
        /*
         * Une salle d'eau est carrelée, et ça se voit avant qu'on ait rien lu.
         *
         * Elle était peinte du même enduit que les chambres. Or ce qui fait
         * reconnaître une salle d'eau sur une image, avant la douche et avant la
         * vasque, c'est la faïence : elle ne rend pas la lumière comme une
         * peinture mate — l'étude de matière lui donne 0,26 de rugosité contre
         * 0,93 — donc elle accroche un reflet là où le mur n'en a aucun. C'est
         * ce reflet qui dit « pièce d'eau », pas le motif.
         *
         * À un mètre vingt, hauteur d'usage en France, et seulement dans les
         * pièces d'eau : le même mur reste peint partout ailleurs.
         */
        if (mouille && FAIENCE < shellTop) {
          panel(span.from, span.to, 0, FAIENCE, carrelage);
          panel(span.from, span.to, FAIENCE, shellTop - FAIENCE, wall);
        } else {
          panel(span.from, span.to, 0, shellTop, wall);
        }
        moulding(span.from, span.to, -NOYADE, PROFIL_PLINTHE, joinery);
      }
      for (const { span, door } of framed) {
        if (door.sill > 0.01) panel(span.from, span.to, 0, door.sill, wall);
        if (door.height < room.height) {
          panel(span.from, span.to, door.height, shellTop - door.height, wall);
        }
        dress(span, door);
      }

      /* La corniche.
         Douze centimètres de bois peint au raccord du mur et du plafond. C'est
         le détail qui coûte le moins cher de toute la scène et qui se voit le
         plus : sans lui, un mur rejoint un plafond sur une arête nette, ce qui
         n'arrive dans aucun immeuble ancien et se lit immédiatement comme une
         maquette. */
      for (const span of solidSpans(openings)) {
        moulding(span.from, span.to, room.height - CORNICE + NOYADE, PROFIL_CORNICHE, joinery);
      }
    }
  }

  batch.flush(group, disposables);
  return group;
}

/**
 * L'ombre au pied des murs.
 *
 * Les murs s'assombrissent sur leurs trente derniers centimètres — l'occlusion
 * cuite dans leurs sommets — mais le sol, lui, ne s'assombrit pas en les
 * approchant. L'angle n'est donc sombre que d'un côté, et le raccord se lit
 * comme un décollement : le mur ne pose pas sur le sol, il flotte au-dessus.
 *
 * Le sol ne peut pas recevoir la même occlusion : sa dalle est une
 * triangulation de contour, tous ses sommets sont sur le bord, et les teinter
 * assombrirait la pièce entière. On peint donc une bande dégradée le long de
 * chaque mur — c'est le même procédé que sous un meuble, et pour la même
 * raison : une tache peinte n'a pas de géométrie, donc pas de coin à rater.
 */
const OMBRE_PLINTHE = 0.34;

function baseShadow(
  rooms: PlanRoom[],
  origin: PlanPoint,
  disposables: Bin[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ombre-plinthe';

  /* Un dégradé horizontal : opaque contre le mur, transparent au bout de la
     bande. Une seule texture pour toutes les pièces. */
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = 1;
  const context = canvas.getContext('2d')!;
  const degrade = context.createLinearGradient(0, 0, size, 0);
  degrade.addColorStop(0, 'rgba(20,17,13,0.4)');
  degrade.addColorStop(0.45, 'rgba(20,17,13,0.13)');
  degrade.addColorStop(1, 'rgba(20,17,13,0)');
  context.fillStyle = degrade;
  context.fillRect(0, 0, size, 1);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    userData: { sansOmbre: true },
  });
  disposables.push(texture, material);

  const batch = new Batch();
  const matrix = new THREE.Matrix4();

  for (const room of rooms) {
    for (const wall of roomWalls(room)) {
      const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
      if (length < 0.2) continue;
      const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
      const normal = inwardNormal(room, wall.a, wall.b);
      const thickness = wallThickness(room, wall, rooms, SKIN, FACADE);

      /* Le plan naît dans XY : on le couche, u le long du mur et v en travers,
         le dégradé partant de la face du mur vers l'intérieur. */
      const geometry = new THREE.PlaneGeometry(OMBRE_PLINTHE, length);
      geometry.rotateZ(Math.PI / 2);
      geometry.rotateX(-Math.PI / 2);
      const centre = pointAt(wall, 0.5);
      const recul = thickness + OMBRE_PLINTHE / 2;
      matrix.makeRotationY(-angle);
      matrix.setPosition(
        centre.x - origin.x + normal.x * recul,
        0.003,
        centre.y - origin.y + normal.y * recul,
      );
      batch.add(geometry, material, matrix);
    }
  }

  batch.flush(group, disposables);
  return group;
}

/** Le mobilier, ramené à ses masses, posé sur son ombre de contact. */
function furniture(
  items: Massing[],
  doors: PlanDoor[],
  origin: PlanPoint,
  disposables: { dispose(): void }[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'mobilier';
  if (items.length === 0) return group;

  const materials = new Map<string, THREE.Material>();
  const shadow = contactShadow(disposables);
  const batch = new Batch();
  /* Le mobilier reçoit la même décroissance que le bâti : un canapé au fond de
     la pièce doit s'assombrir comme le mur derrière lui, sinon il s'en détache
     et se met à flotter. */
  const jour = daylightSources(doors, origin);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3(1, 1, 1);

  /** Le verre des parois de douche, construit à la première qui s'en sert. */
  let vitre: THREE.MeshStandardMaterial | undefined;
  /** Le verre lumineux d'un plafonnier, de même. */
  let verre: THREE.MeshBasicMaterial | undefined;

  /** Le matériau d'une teinte, construit une fois pour toute la scène. */
  const matiere = (tone: FurnitureTone): THREE.Material => {
    let material = materials.get(tone);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: TONES[tone],
        roughness: FURNITURE_ROUGHNESS[tone],
        metalness: FURNITURE_METAL[tone] ?? 0,
        vertexColors: true,
      });
      materials.set(tone, material);
      disposables.push(material);
    }
    return material;
  };

  for (const item of items) {
    const material = matiere(item.tone);
    const base = item.base ?? 0;
    const spin = -((item.yaw ?? 0) * Math.PI) / 180;
    /* Un textile roule sur son bord : le rayon vient de l'épaisseur du volume,
       pas d'une constante. Une couette de dix-sept centimètres roule plus large
       qu'un coussin de huit, et c'est ce rapport-là qui donne l'échelle. */
    const chanfrein = (w: number, h: number, d: number) =>
      item.moelleux ? Math.min(0.075, Math.min(w, h, d) * 0.46) : CHANFREIN_MEUBLE;

    /** Pose une boîte, exprimée dans le repère local du meuble. */
    const part = (
      w: number,
      h: number,
      d: number,
      dx: number,
      y: number,
      dz: number,
      tone?: FurnitureTone,
    ) => {
      const geometry = box(w, h, d, tone ? CHANFREIN_MEUBLE : chanfrein(w, h, d));
      position.set(
        item.x - origin.x + dx * Math.cos(spin) + dz * Math.sin(spin),
        y,
        item.y - origin.y - dx * Math.sin(spin) + dz * Math.cos(spin),
      );
      quaternion.setFromAxisAngle(AXE_Y, spin);
      batch.add(
        geometry,
        tone ? matiere(tone) : material,
        matrix.compose(position, quaternion, echelle),
        (x, y, z) => daylightAt(jour, x, y, z),
      );
    };

    if (item.shape === 'table') {
      const top = Math.min(0.06, item.h * 0.22);
      const leg = 0.055;
      const inset = 0.055;
      part(item.w, top, item.d, 0, base + item.h - top / 2, 0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          part(
            leg,
            item.h - top,
            leg,
            (sx * (item.w / 2 - inset - leg / 2)),
            base + (item.h - top) / 2,
            (sz * (item.d / 2 - inset - leg / 2)),
          );
        }
      }
    } else if (item.shape === 'placard') {
      /*
       * Une armoire n'est pas une caisse.
       *
       * Rendue en bloc plein, elle occupe deux mètres de haut sur un mur clair
       * et s'y lit comme un panneau blanc collé là — c'est la forme la plus
       * grande de la scène et la seule sans aucune articulation. Une plinthe en
       * retrait et un joint vertical entre deux portes suffisent : ce sont les
       * deux lignes que l'œil cherche pour dire « meuble » plutôt que « mur ».
       *
       * Le joint suit la façade, et la façade est le grand côté de l'empreinte :
       * une armoire est adossée par son long côté. Fendre systématiquement selon
       * `w` aurait coupé en deux la joue de celles qui présentent leur `d`.
       */
      const plinth = Math.min(0.09, item.h * 0.06);
      const reveal = 0.014;
      const alongW = item.w >= item.d;
      const front = alongW ? item.w : item.d;
      const vantaux = Math.max(1, Math.round(item.portes ?? 2));
      const leaf = (front - reveal * (vantaux - 1)) / vantaux;
      const corps = item.h - plinth;
      // La plinthe est en retrait : c'est le retrait qui se voit, pas la plinthe.
      part(item.w - 0.04, plinth, item.d - 0.04, 0, base + plinth / 2, 0);
      for (let index = 0; index < vantaux; index += 1) {
        const shift = (index - (vantaux - 1) / 2) * (leaf + reveal);
        part(
          alongW ? leaf : item.w,
          corps,
          alongW ? item.d : leaf,
          alongW ? shift : 0,
          base + plinth + corps / 2,
          alongW ? 0 : shift,
        );
        /*
         * La poignée.
         *
         * Un vantail sans poignée n'est pas une porte, c'est un panneau — et
         * une enfilade de panneaux blancs se lit comme un mur doublé. C'est
         * une barre de laiton de deux centimètres : à l'écran elle ne fait
         * qu'une ligne, mais c'est la ligne qui dit qu'on peut l'ouvrir, et
         * elle donne au passage l'échelle du meuble, parce que tout le monde
         * sait la hauteur d'une poignée.
         *
         * Elle se pose du côté du refend, jamais du côté de la charnière : les
         * vantaux s'ouvrent en se séparant, donc les poignées se rejoignent au
         * milieu du meuble.
         */
        const cote = vantaux === 1 ? 1 : shift <= 0 ? 1 : -1;
        const marge = leaf / 2 - 0.055;
        const bras = Math.min(0.2, corps * 0.42);
        /* Où se pose une poignée dépend de ce qu'on ouvre, et une seule règle
           ne couvre pas les trois cas. Sur un caisson bas on l'attrape par le
           haut du vantail ; sur une armoire, à hauteur de main ; sur un meuble
           suspendu, par le bas, parce que la main vient d'en dessous. */
        const sommet = base + item.h;
        const hauteur =
          sommet < 1.25
            ? sommet - bras / 2 - 0.04
            : base < 0.9
              ? Math.min(1.02, base + plinth + corps - bras / 2 - 0.04)
              : base + plinth + bras / 2 + 0.06;
        /* La barre déborde la façade des deux côtés, et c'est la profondeur du
           meuble qu'elle traverse — pas sa façade. Confondre les deux donne une
           poignée aussi longue que l'armoire est large, qui sort d'un mètre
           dans la pièce : c'est ce qu'un contrôle en image a montré, un bloc de
           laiton flottant devant le placard d'entrée. */
        const profondeur = alongW ? item.d : item.w;
        /* Cinq centimètres et demi de plus que le meuble, donc un débord de
           près de trois centimètres de chaque côté : c'est ce qu'il faut pour
           qu'une barre se voie de biais. Un débord d'un millimètre existe dans
           la géométrie et n'existe pas à l'écran. Le débord arrière disparaît
           dans le mur contre lequel le meuble est adossé — c'est ce qui permet
           de ne pas avoir à savoir de quel côté est la façade. */
        part(
          alongW ? 0.026 : profondeur + 0.055,
          bras,
          alongW ? profondeur + 0.055 : 0.026,
          alongW ? shift + cote * marge : 0,
          hauteur,
          alongW ? 0 : shift + cote * marge,
          'laiton',
        );
      }
    } else if (item.shape === 'plafonnier') {
      /*
       * Un plafonnier qui éclaire vraiment.
       *
       * Le dégagement n'a pas de fenêtre. La décroissance du jour l'amène donc
       * à son plancher, et c'est juste : un couloir intérieur *est* sombre. Mais
       * la visite y passe deux fois, et c'est par là qu'on va de la chambre à la
       * salle d'eau — le moment le moins lisible de tout le parcours se trouvait
       * être aussi celui où le visiteur a le plus besoin de comprendre où il
       * est.
       *
       * Un couloir aveugle a une lumière, et elle est allumée. C'est le même
       * remède que sur le palier, appliqué à l'autre pièce sans jour, et il ne
       * coûte qu'une lampe : pas d'ombre portée — une seconde carte d'ombres
       * pour un couloir coûterait celle du soleil — et un disque de verre pour
       * que la lumière ait une source visible plutôt que de sortir du plâtre.
       */
      const rayon = Math.min(item.w, item.d) / 2;
      const galette = new THREE.CylinderGeometry(rayon, rayon * 0.88, item.h, 20);
      position.set(item.x - origin.x, base + item.h / 2, item.y - origin.y);
      quaternion.setFromAxisAngle(AXE_Y, 0);
      batch.add(galette, material, matrix.compose(position, quaternion, echelle), () => 1);

      if (!verre) {
        verre = new THREE.MeshBasicMaterial({ color: 0xfff2dc });
        disposables.push(verre);
      }
      const globe = new THREE.SphereGeometry(rayon * 0.72, 14, 8);
      disposables.push(globe);
      const source = new THREE.Mesh(globe, verre);
      source.position.set(item.x - origin.x, base - rayon * 0.2, item.y - origin.y);
      group.add(source);

      const lampe = new THREE.PointLight(0xffdfb4, 9, 7, 2);
      lampe.position.set(item.x - origin.x, base - rayon * 0.2, item.y - origin.y);
      group.add(lampe);
    } else if (item.shape === 'vitrage') {
      /*
       * Une paroi de douche, en verre.
       *
       * Elle était rendue opaque, dans le grège des placards : deux panneaux
       * de trois centimètres et demi montant à un mètre quatre-vingt-dix, donc
       * une dalle beige de deux mètres carrés en plein milieu d'une pièce qui
       * en fait trois et demi. À l'image, la salle d'eau n'était plus une
       * salle d'eau mais un mur — on n'y voyait ni la douche, ni la vasque,
       * ni la fenêtre que la légende annonce.
       *
       * Le verre est ce qui distingue une douche d'un placard, et c'est aussi
       * ce qui rend une petite pièce montrable : une paroi transparente laisse
       * voir le carrelage derrière elle, donc la profondeur de la pièce.
       * Le même verre que les fenêtres — assez pour dire qu'il y en a, pas
       * assez pour éteindre ce qu'il y a derrière — et comme elles, il ne
       * porte pas d'ombre : la carte d'ombres est un tampon de profondeur, elle
       * ignore la transparence, et une paroi qui projette une ombre pleine
       * plonge la douche dans le noir.
       */
      if (!vitre) {
        vitre = new THREE.MeshStandardMaterial({
          vertexColors: true,
          color: 0xdce9f2,
          roughness: ROUGHNESS.verre,
          metalness: 0,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
          userData: { sansOmbre: true },
        });
        disposables.push(vitre);
      }
      const geometry = box(item.w, item.h, item.d, CHANFREIN_BATI);
      position.set(item.x - origin.x, base + item.h / 2, item.y - origin.y);
      quaternion.setFromAxisAngle(AXE_Y, spin);
      batch.add(geometry, vitre, matrix.compose(position, quaternion, echelle), (x, y, z) =>
        daylightAt(jour, x, y, z),
      );
      /*
       * Le montant : une paroi de verre sans profilé flotte, et c'est le
       * profilé qui donne son épaisseur au vitrage.
       *
       * Deux teintes ont été essayées avant celle-ci. En laiton, il devenait
       * la première chose qu'on regardait dans la pièce. En sombre, il se
       * détachait pire encore : le montant qui ferme la paroi de la douche
       * tombe devant la fenêtre, et une barre noire à contre-jour est ce qui
       * se voit le plus dans une image. Dans le grège du bac, il disparaît
       * contre le ciel et se lit quand même contre le carrelage, parce qu'il
       * ne reçoit pas la lumière sous le même angle que lui.
       */
      const montant = 0.018;
      const alongW = item.w >= item.d;
      part(
        alongW ? montant : item.w + 0.004,
        item.h,
        alongW ? item.d + 0.004 : montant,
        alongW ? (item.w - montant) / 2 : 0,
        base + item.h / 2,
        alongW ? 0 : (item.d - montant) / 2,
        item.tone,
      );
    } else if (item.shape === 'rideau') {
      /*
       * Un rideau, en plis alternés.
       *
       * Le tissu est le seul matériau de la scène qui n'ait pas de face plane,
       * et c'est précisément ce qui le rend impossible à rendre en un volume :
       * un rideau lisse est une colonne. Ce qu'on voit d'un rideau tiré sur le
       * côté d'une fenêtre, ce sont des rouleaux verticaux dont l'un avance
       * quand l'autre recule, et c'est cette alternance qui accroche la lumière
       * rasante — un pli sur deux est dans son ombre.
       *
       * Sept centimètres et demi de pas : c'est la largeur d'un pli sur une
       * étoffe d'ameublement froncée à deux fois sa largeur. En dessous, les
       * rouleaux se confondent à deux mètres ; au-dessus, on lit des planches.
       */
      const alongW = item.w >= item.d;
      const portee = alongW ? item.w : item.d;
      const epaisseur = alongW ? item.d : item.w;
      const plis = Math.max(3, Math.round(portee / 0.075));
      const pas = portee / plis;
      for (let index = 0; index < plis; index += 1) {
        const shift = (index - (plis - 1) / 2) * pas;
        // Un pli sur deux avance ; le creux est ce qui fait l'ombre.
        const saillie = epaisseur * (index % 2 === 0 ? 1 : 0.6);
        part(
          alongW ? pas * 0.99 : saillie,
          item.h,
          alongW ? saillie : pas * 0.99,
          alongW ? shift : (epaisseur - saillie) / 2,
          base + item.h / 2,
          alongW ? (epaisseur - saillie) / 2 : shift,
        );
      }
    } else if (item.shape === 'plante') {
      /*
       * Une plante en pot.
       *
       * C'est le seul objet de la scène qui ne soit ni bâti ni menuisé, et
       * c'est pour cela qu'il compte : tout le reste du logement est fait de
       * plans et d'angles droits, y compris les textiles. Une masse irrégulière
       * dans un coin est ce qui fait passer une image d'« intérieur modélisé »
       * à « intérieur habité », et aucune quantité de moulures ne la remplace.
       *
       * Le pot est en terre cuite — la contre-note du nuancier, déjà portée par
       * les coussins — et le feuillage en pétrole, qui est un vert rompu : la
       * scène n'a pas de vert franc et n'en veut pas, un feuillage saturé
       * tirerait l'œil hors de la pièce.
       */
      const potHaut = item.h * 0.28;
      const rayon = Math.min(item.w, item.d) / 2;
      const pot = new THREE.CylinderGeometry(rayon, rayon * 0.72, potHaut, 16);
      position.set(item.x - origin.x, base + potHaut / 2, item.y - origin.y);
      quaternion.setFromAxisAngle(AXE_Y, spin);
      batch.add(pot, material, matrix.compose(position, quaternion, echelle), (x, y, z) =>
        daylightAt(jour, x, y, z),
      );

      /*
       * Cinq masses décalées plutôt qu'une.
       *
       * Une sphère unique se lit comme une boule, et une boule sur un pot est
       * un buis taillé, pas une plante d'intérieur. Ce qui distingue les deux
       * est la silhouette : celle d'un feuillage est dissymétrique, et il en
       * faut au moins quatre ou cinq pour qu'elle cesse d'avoir un axe. Les
       * décalages sont fixes, pas tirés au hasard — une scène doit se
       * reconstruire à l'identique d'un chargement à l'autre.
       */
      const feuillage = matiere('petrole');
      const hautFeuillage = item.h - potHaut;
      for (const [dx, dz, dh, facteur] of [
        [0, 0, 0.4, 1],
        [-0.3, 0.18, 0.62, 0.78],
        [0.32, -0.12, 0.7, 0.7],
        [0.1, 0.34, 0.86, 0.56],
        [-0.16, -0.26, 0.9, 0.48],
      ] as const) {
        const r = rayon * 1.55 * facteur;
        const masse = new THREE.SphereGeometry(r, 12, 9);
        position.set(
          item.x - origin.x + (dx * Math.cos(spin) + dz * Math.sin(spin)) * rayon,
          base + potHaut + hautFeuillage * dh,
          item.y - origin.y + (-dx * Math.sin(spin) + dz * Math.cos(spin)) * rayon,
        );
        batch.add(masse, feuillage, matrix.compose(position, quaternion, echelle), (x, y, z) =>
          daylightAt(jour, x, y, z),
        );
      }
    } else if (item.shape === 'suspension') {
      /*
       * L'abat-jour du luminaire, en tronc de cône.
       *
       * La suspension était une petite boîte au bout d'une tige : à trois
       * mètres de la caméra elle se lisait comme un colis suspendu. Un tronc
       * de cône ouvert vers le bas ne coûte qu'une géométrie et fait tout le
       * travail, parce que la silhouette d'un abat-jour est reconnue avant sa
       * matière.
       *
       * `DoubleSide` n'entre pas en jeu : on ferme le cône par un disque au
       * sommet, ce qui évite un second matériau et un second appel de rendu
       * pour une face qu'on ne voit que d'en dessous.
       */
      const haut = item.w / 2;
      const bas = Math.max(haut * 1.55, item.d / 2);
      const cone = new THREE.CylinderGeometry(haut, bas, item.h, 20, 1, false);
      position.set(item.x - origin.x, base + item.h / 2, item.y - origin.y);
      quaternion.setFromAxisAngle(AXE_Y, spin);
      batch.add(cone, material, matrix.compose(position, quaternion, echelle), (x, y, z) =>
        daylightAt(jour, x, y, z),
      );
    } else if (item.shape === 'radiateur') {
      /*
       * Un radiateur en fonte à colonnes.
       *
       * C'est, avec la rosace, l'objet qui fait reconnaître un appartement
       * haussmannien en une image — plus sûrement que la hauteur sous plafond,
       * qu'on ne peut pas juger sur un écran. Et il est toujours au même
       * endroit : sous la fenêtre, parce que c'est là que le froid entre.
       *
       * Des colonnes rondes plutôt qu'un panneau plat : ce sont elles qui
       * portent l'objet. Un panneau lisse de la même taille se lit comme un
       * radiateur moderne, ce qui est exactement le contraire de ce qu'on veut
       * montrer, et coûte le même nombre de triangles.
       */
      const colonnes = Math.max(4, Math.round(item.w / 0.055));
      const rayon = Math.min(0.026, item.d / 2);
      const ecart = item.w / colonnes;
      const rail = 0.035;
      const hauteurColonnes = item.h - rail;
      for (let index = 0; index < colonnes; index += 1) {
        const geometry = new THREE.CylinderGeometry(rayon, rayon, hauteurColonnes, 8);
        position.set(
          item.x - origin.x + ((index + 0.5) * ecart - item.w / 2) * Math.cos(spin),
          base + rail / 2 + hauteurColonnes / 2,
          item.y - origin.y - ((index + 0.5) * ecart - item.w / 2) * Math.sin(spin),
        );
        quaternion.setFromAxisAngle(AXE_Y, spin);
        batch.add(geometry, material!, matrix.compose(position, quaternion, echelle), (x, y, z) =>
          daylightAt(jour, x, y, z),
        );
      }
      // Les collecteurs haut et bas, qui tiennent les colonnes ensemble.
      part(item.w, rail, item.d * 0.7, 0, base + rail / 2, 0);
      part(item.w, rail, item.d * 0.7, 0, base + item.h - rail / 2, 0);
      // Les deux pieds.
      for (const side of [-1, 1]) {
        part(0.03, 0.06, item.d * 0.8, (side * item.w) / 2.6, base + 0.03, 0);
      }
    } else if (item.shape === 'rosace') {
      /*
       * La rosace de plafond, en deux gradins.
       *
       * Le luminaire pendait du vide. Une rosace, même réduite à deux disques,
       * rattache la suspension au plafond et donne à celui-ci le seul relief
       * qu'il ait — un plafond parfaitement lisse est ce qui trahit le plus
       * vite un rendu.
       */
      const rayon = item.w / 2;
      /* Deux gradins, montés depuis `base` comme tout le reste : le plus large
         contre le plafond, le plus petit en dessous. C'est le sens de lecture
         d'une moulure — chaque gradin porte le suivant. */
      let niveau = base;
      for (const [facteur, epaisseur] of [
        [0.68, 0.018],
        [1, 0.022],
      ] as const) {
        const geometry = new THREE.CylinderGeometry(rayon * facteur, rayon * facteur, epaisseur, 24);
        position.set(item.x - origin.x, niveau + epaisseur / 2, item.y - origin.y);
        quaternion.setFromAxisAngle(AXE_Y, 0);
        batch.add(geometry, material!, matrix.compose(position, quaternion, echelle), (x, y, z) =>
          daylightAt(jour, x, y, z),
        );
        niveau += epaisseur;
      }
    } else {
      part(item.w, item.h, item.d, 0, base + item.h / 2, 0);
    }

    /* L'ombre de contact est le détail qui pose un meuble au sol. Sans elle, un
       volume mat sur un sol mat flotte, et l'œil le voit tout de suite même
       s'il ne sait pas dire pourquoi. */
    if (item.tone === 'tapis' || base > 0.4) continue;
    const patch = new THREE.PlaneGeometry(item.w * 1.7, item.d * 1.7);
    patch.rotateX(-Math.PI / 2);
    patch.rotateY(((item.yaw ?? 0) * Math.PI) / 180);
    batch.add(patch, shadow, matrix.makeTranslation(item.x - origin.x, base + 0.004, item.y - origin.y));
  }

  batch.flush(group, disposables);
  return group;
}

function contactShadow(disposables: { dispose(): void }[]): THREE.Material {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(24,20,16,0.42)');
  gradient.addColorStop(0.55, 'rgba(24,20,16,0.16)');
  gradient.addColorStop(1, 'rgba(24,20,16,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    // Une tache peinte au sol n'a pas d'épaisseur : elle ne doit rien projeter.
    userData: { sansOmbre: true },
  });
  disposables.push(texture, material);
  return material;
}

/**
 * Le palier, devant la porte.
 *
 * Sans lui, la première image du site montre une porte et un pan de mur seuls
 * dans le ciel : on ne comprend pas d'où l'on regarde, et une porte qu'on ne
 * situe pas cesse d'être une porte. Trois murs, un sol et un plafond suffisent
 * à poser un palier d'immeuble — et la scène y gagne bien plus que le décor :
 * on part d'un endroit sombre et fermé pour entrer dans un logement clair. Le
 * contraste fait la moitié de l'effet.
 *
 * Le côté façade reste ouvert. Le fermer reviendrait à poser une paroi juste
 * derrière la porte, et l'ouverture donnerait sur un mur.
 */
function landing(
  entrance: Entrance,
  rooms: PlanRoom[],
  origin: PlanPoint,
  disposables: { dispose(): void }[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'palier';
  const room = rooms.find((candidate) => candidate.id === entrance.roomId);
  if (!room) return group;

  const { a, b } = entrance.door;
  const door = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  // La normale sortante : celle des deux perpendiculaires qui ne ramène pas
  // dans la pièce.
  let out = { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };
  if (containsPoint(room, { x: door.x + out.x * 0.05, y: door.y + out.y * 0.05 })) {
    out = { x: -out.x, y: -out.y };
  }

  const WIDTH = 4.6;
  const DEPTH = 3.4;
  const HEIGHT = 2.7;
  const stone = new THREE.MeshStandardMaterial({ color: OUTSIDE.palier, roughness: 0.9 });
  const tiling = new THREE.MeshStandardMaterial({ color: OUTSIDE.palier_sol, roughness: 0.6 });
  disposables.push(stone, tiling);

  /** Un point du palier, repéré en (le long du mur, vers l'extérieur, hauteur). */
  const at = (alongWall: number, outward: number, lift: number) =>
    new THREE.Vector3(
      door.x - origin.x + Math.cos(angle) * alongWall + out.x * outward,
      lift,
      door.y - origin.y + Math.sin(angle) * alongWall + out.y * outward,
    );

  /** Pose une paroi, repérée par son centre exprimé en (le long du mur, vers l'extérieur). */
  const slab = (
    alongWall: number,
    outward: number,
    lift: number,
    size: [number, number, number],
    material: THREE.Material,
  ) => {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    disposables.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(at(alongWall, outward, lift));
    mesh.rotation.y = -angle;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Le fond, les deux côtés, le plafond, le sol.
  slab(0, DEPTH, HEIGHT / 2, [WIDTH, HEIGHT, 0.2], stone);
  slab(-WIDTH / 2, DEPTH / 2, HEIGHT / 2, [0.2, HEIGHT, DEPTH], stone);
  slab(WIDTH / 2, DEPTH / 2, HEIGHT / 2, [0.2, HEIGHT, DEPTH], stone);
  slab(0, DEPTH / 2, HEIGHT, [WIDTH, 0.14, DEPTH], stone);
  slab(0, DEPTH / 2, -0.03, [WIDTH, 0.06, DEPTH], tiling);

  /* Le palier ferme lui-même sa façade, de part et d'autre de la porte et
     au-dessus.

     Première version : on comptait sur le mur du logement pour boucher ce
     côté-là. Mais ce mur ne fait que la longueur de la pièce, et la porte n'est
     pas en son milieu — il restait donc, à droite, un mètre d'ouverture par
     lequel on voyait le ciel et le sol extérieur depuis le palier. Fermer soi-
     même ne dépend d'aucune hypothèse sur le plan. */
  const opening = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  const jamb = (WIDTH / 2 - opening) / 2;
  const lintel = entrance.door.height;
  if (jamb > 0.05) {
    slab(-(opening + jamb), 0.03, HEIGHT / 2, [jamb * 2, HEIGHT, 0.06], stone);
    slab(opening + jamb, 0.03, HEIGHT / 2, [jamb * 2, HEIGHT, 0.06], stone);
  }
  if (lintel < HEIGHT) {
    slab(0, 0.03, (lintel + HEIGHT) / 2, [opening * 2, HEIGHT - lintel, 0.06], stone);
  }

  /* Un filet de lumière sous la porte.
     Deux centimètres de rectangle chaud, et le palier cesse d'être un décor :
     il y a quelqu'un derrière, la pièce est éclairée, on a envie d'entrer.
     C'est le détail le moins cher et le plus efficace de toute la scène. */
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  disposables.push(glow);
  const strip = new THREE.BoxGeometry(opening * 1.9, 0.022, 0.02);
  disposables.push(strip);
  const light = new THREE.Mesh(strip, glow);
  light.position.copy(at(0, 0.02, 0.012));
  light.rotation.y = -angle;
  group.add(light);

  /*
   * Le hublot du palier.
   *
   * Le parti était bon et allait trop loin : on part d'un endroit sombre et
   * fermé pour entrer dans un logement clair, et le contraste fait la moitié de
   * l'effet. Mais le palier n'avait aucune source à lui — seulement l'ambiante
   * et le soleil qui entrait de biais par le côté ouvert. Résultat en image :
   * la toute première vue du site, celle qui décide si l'on fait défiler ou
   * non, était une porte presque noire dans un brun boueux, avec une tache de
   * soleil brûlée sur un mur. Ce n'est pas une pénombre, c'est une image ratée
   * — et la différence entre les deux tient à ce qu'on distingue quelque chose
   * dans les ombres.
   *
   * Un hublot au plafond suffit, et il n'est pas là pour le décor : c'est ce
   * qu'on trouve dans toutes les cages d'escalier parisiennes, allumé par une
   * minuterie. Il donne à la porte ses panneaux, à la pierre son grain, et il
   * chauffe l'image juste assez pour que le blanc du logement, ensuite, paraisse
   * franchement plus clair qu'elle.
   *
   * Sans ombre portée : une seconde carte d'ombres pour éclairer trois murs
   * coûterait autant que celle du soleil, et un hublot diffusant n'en fait de
   * toute façon pas de nettes.
   */
  const hublot = new THREE.PointLight(0xffdcae, 11, 9, 2);
  hublot.position.copy(at(-WIDTH * 0.22, DEPTH * 0.5, HEIGHT - 0.22));
  group.add(hublot);

  const verre = new THREE.MeshBasicMaterial({ color: 0xfff0d6 });
  const globe = new THREE.SphereGeometry(0.085, 14, 9);
  disposables.push(verre, globe);
  const source = new THREE.Mesh(globe, verre);
  source.position.copy(hublot.position);
  group.add(source);

  return group;
}

/**
 * Le battant de la porte d'entrée.
 *
 * Il pivote sur son gond, et le sens d'ouverture n'est pas décidé à la main :
 * on essaie les deux, et on garde celui qui range la porte **à l'intérieur** du
 * logement. Une porte palière qui s'ouvrirait sur le palier serait la première
 * chose que verrait un propriétaire, et la première qu'il ne pardonnerait pas.
 */
function doorLeaf(
  entrance: Entrance,
  rooms: PlanRoom[],
  origin: PlanPoint,
  disposables: { dispose(): void }[],
): { group: THREE.Group; closed: number; sweep: number } | null {
  const room = rooms.find((candidate) => candidate.id === entrance.roomId);
  if (!room) return null;

  const { height } = entrance.door;
  const ends = [entrance.door.a, entrance.door.b];
  const width = distance(ends[0], ends[1]);
  if (width < 0.2) return null;

  /*
   * De quel côté se trouve le gond.
   *
   * On le place à l'extrémité la plus éloignée du centre de la pièce, de sorte
   * que le battant ouvert se range du côté opposé au chemin. C'est ainsi qu'on
   * pose une porte dans un logement réel — on n'ouvre pas dans le passage — et
   * ici ça se voit immédiatement : avec le gond du mauvais côté, le battant
   * ouvert venait barrer le séjour en travers de la caméra qui entre.
   */
  const centre = roomCenter(room);
  const flip = distance(ends[1], centre) > distance(ends[0], centre);
  const a = flip ? ends[1] : ends[0];
  const b = flip ? ends[0] : ends[1];

  const rotate = (point: PlanPoint, theta: number): PlanPoint => {
    const dx = point.x - a.x;
    const dy = point.y - a.y;
    return {
      x: a.x + dx * Math.cos(theta) - dy * Math.sin(theta),
      y: a.y + dx * Math.sin(theta) + dy * Math.cos(theta),
    };
  };
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const quarter = Math.PI / 2;
  const inward = containsPoint(room, rotate(middle, quarter)) ? 1 : -1;

  const group = new THREE.Group();
  group.position.set(a.x - origin.x, 0, a.y - origin.y);

  /*
   * Les deux faces du battant n'ont pas la même couleur, et il le faut.
   *
   * Côté palier, une porte parisienne est peinte foncé : sur la pierre claire
   * de la cage d'escalier, c'est ce qui la fait lire comme une porte — une
   * première version en blanc cassé, à deux points du mur, donnait un mur avec
   * une poignée posée dessus. Côté logement, elle est claire comme les murs :
   * peinte foncé des deux côtés, la porte ouverte devenait un pan noir en
   * travers du séjour, et on aurait juré un trou dans la géométrie.
   */
  const leaf = new THREE.BoxGeometry(width, height, 0.055);
  const outside = new THREE.MeshStandardMaterial({ color: OUTSIDE.porte, roughness: 0.45 });
  const inside = new THREE.MeshStandardMaterial({
    color: SHELL.menuiserie,
    roughness: ROUGHNESS.menuiserie,
  });
  const edge = new THREE.MeshStandardMaterial({ color: FURNITURE.cabinet, roughness: 0.5 });
  disposables.push(leaf, outside, inside, edge);
  /* Faces d'une BoxGeometry : +x, −x, +y, −y, +z, −z. L'épaisseur est portée
     par Z, donc ce sont les deux dernières qui comptent. Le +Z local pointe
     vers le plan d'angle α+90° : reste à savoir si cette direction rentre dans
     la pièce ou en sort. */
  const plusZ = { x: Math.cos(alphaOf(a, b) + Math.PI / 2), y: Math.sin(alphaOf(a, b) + Math.PI / 2) };
  const plusZIsInside = containsPoint(room, {
    x: middle.x + plusZ.x * 0.05,
    y: middle.y + plusZ.y * 0.05,
  });
  const panel = new THREE.Mesh(leaf, [
    edge,
    edge,
    edge,
    edge,
    plusZIsInside ? inside : outside,
    plusZIsInside ? outside : inside,
  ]);
  panel.position.set(width / 2, height / 2, 0);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  // La poignée : deux centimètres de laiton qui font toute la différence entre
  // « un panneau qui tourne » et « une porte ».
  const knob = new THREE.BoxGeometry(0.11, 0.03, 0.03);
  const brass = new THREE.MeshStandardMaterial({
    color: FURNITURE.laiton,
    roughness: FURNITURE_ROUGHNESS.laiton,
    metalness: FURNITURE_METAL.laiton ?? 0,
  });
  disposables.push(knob, brass);
  const handle = new THREE.Mesh(knob, brass);
  handle.position.set(width - 0.14, 1.05, plusZIsInside ? -0.045 : 0.045);
  handle.castShadow = true;
  group.add(handle);

  // Deux panneaux moulurés, à peine en relief : ce qui distingue une porte
  // d'immeuble d'une plaque de contreplaqué.
  const moulding = new THREE.MeshStandardMaterial({ color: 0x2b3833, roughness: 0.45 });
  disposables.push(moulding);
  const face = plusZIsInside ? -0.032 : 0.032;
  for (const [centre, tall] of [
    [height * 0.68, height * 0.34],
    [height * 0.29, height * 0.28],
  ] as const) {
    const inset = new THREE.BoxGeometry(width * 0.62, tall, 0.012);
    disposables.push(inset);
    const mesh = new THREE.Mesh(inset, moulding);
    mesh.position.set(width / 2, centre, face);
    group.add(mesh);
  }

  /* Une rotation de φ autour de Y envoie l'axe local +X sur la direction du
     plan d'angle −φ. Le battant fermé doit longer l'ouverture, d'où φ = −α. */
  return { group, closed: -alphaOf(a, b), sweep: -inward * (Math.PI * 0.52) };
}
