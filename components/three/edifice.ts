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
import { masseFeuillue, subdiviser } from '@/components/three/maillage';
import { creerMatieres, type Matiere } from '@/components/three/matieres';
import { poserAppartement, type Palette } from '@/components/three/appartement';
import {
  ETAGE,
  NEZ,
  NIVEAU_APPARTEMENT,
  NIVEAUX,
  RETRAIT,
  SOCLE,
  TRAME,
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
  /* L'allège — le panneau plein sous chaque bandeau vitré. Elle était à
     0x2e3439, soit trois pour cent de réflectance : sur un tiers de la
     hauteur de chaque étage, cela fait un immeuble noir. Un panneau
     d'allège réel est sombre, pas éteint. */
  allege: 0x3d4750,
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

/* ======================================================== le rez, en option === */

/**
 * Les cotes du hall et de son atrium.
 *
 * Elles vivaient dans `lib/residence.ts`, avec celles du bâtiment, du temps où
 * la page descendait au rez. Elles sont redescendues ici le jour où la visite
 * s'est réduite à un appartement : plus rien dans la page ne les affiche, plus
 * rien ne les teste, et une constante exportée que personne n'importe est une
 * invitation à croire qu'elle sert encore.
 */
const HALL_COTES = {
  hx: 9 * 1.8 - 0.9,
  hz: 6 * 1.8 - 0.9,
  haut: 3.55 * 1.6 - 0.25,
  porte: 4,
} as const;

/** L'emprise du puits, dans le repère du bâtiment. */
const PUITS = { x0: -13, x1: -5, z0: -3.6, z1: 5.4, coursive: 1.6 } as const;

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

/*
 * L'amplitude moyenne des cartes de rugosité, pour la compensation.
 *
 * Elle n'est pas déduite des cartes — elle est leur moyenne à la main, et
 * c'est assumé : les amplitudes réelles vont de 0,07 pour le marbre à 0,30
 * pour le métal brossé, et compenser chacune exactement ferait dépendre le
 * nuancier de neuf nombres au lieu d'un. Ce qui compte est que la rugosité
 * moyenne ne dérive pas d'un facteur, pas qu'elle soit juste au centième.
 */
const MAT_MOYEN = 0.075;

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

  /**
   * @param maille Longueur d'arête maximale avant cuisson. Sans subdivision,
   *   une couleur portée par les sommets ne varie qu'aux quatre coins d'un mur.
   * @param paint Facteur d'éclairement en un point du **monde**, entre 0 et 1.
   */
  add(
    source: THREE.BufferGeometry,
    material: THREE.Material,
    matrix: THREE.Matrix4,
    paint?: (x: number, y: number, z: number) => number,
    maille = 0.6,
  ): void {
    let geometry = source;
    geometry.applyMatrix4(matrix);
    if (!geometry.index) {
      const indexed = mergeVertices(geometry);
      if (indexed !== geometry) geometry.dispose();
      geometry = indexed;
    }
    if (paint) {
      const fin = subdiviser(geometry, maille);
      if (fin !== geometry) geometry.dispose();
      geometry = fin;
    }
    /*
     * Les coordonnées de texture, projetées depuis le monde.
     *
     * C'est la condition d'existence de toute matière ici, et elle n'est pas
     * évidente. Les géométries arrivent avec les coordonnées que three leur a
     * données : zéro à un sur chaque face, quelle que soit sa taille. Une
     * texture posée dessus se répète donc **une fois par face** — un pavage de
     * parquet identique sur une lame de dix centimètres et sur un îlot de
     * soixante mètres. Aucun réglage ne rattrape cela : le défaut est dans les
     * coordonnées, pas dans l'image.
     *
     * On les recalcule donc à partir de la position dans le monde, en
     * projetant sur le plan que la normale désigne — la projection triplanaire,
     * dans sa forme la plus économe : décidée par sommet, une seule fois, à la
     * construction. Rien à payer au rendu.
     *
     * Elle est sûre ici pour une raison précise : `mergeVertices` compare tous
     * les attributs, normale comprise, donc les coins d'un pavé gardent trois
     * sommets distincts — un par face. Chacun reçoit la projection de sa
     * propre face, et il n'y a pas de couture. Sur une géométrie lissée, où
     * les sommets sont partagés entre orientations, il faudrait projeter dans
     * le nuanceur.
     *
     * `tuile` est en **répétitions par mètre** et vit dans le matériau : c'est
     * lui qui sait s'il est un parquet à lames de vingt centimètres ou un
     * enduit dont le grain se compte en mètres.
     */
    const tuile = (material.userData?.tuile as number | undefined) ?? 0;
    if (tuile > 0) {
      const position = geometry.getAttribute('position');
      const normale = geometry.getAttribute('normal');
      const n = position.count;
      const uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i += 1) {
        const px = position.getX(i);
        const py = position.getY(i);
        const pz = position.getZ(i);
        const nx = Math.abs(normale ? normale.getX(i) : 0);
        const ny = Math.abs(normale ? normale.getY(i) : 1);
        const nz = Math.abs(normale ? normale.getZ(i) : 0);
        let u: number;
        let v: number;
        if (ny >= nx && ny >= nz) {
          // Une face horizontale — sol, plafond, dessus de meuble : plan xz.
          u = px;
          v = pz;
        } else if (nx >= nz) {
          // Une face tournée vers l'est ou l'ouest : plan zy.
          u = pz;
          v = py;
        } else {
          // Une face tournée vers le nord ou le sud : plan xy.
          u = px;
          v = py;
        }
        uv[i * 2] = u * tuile;
        uv[i * 2 + 1] = v * tuile;
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    } else if (!geometry.getAttribute('uv')) {
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    /*
     * La couleur des sommets, cuite après la transformation.
     *
     * Après, et c'est tout l'intérêt : la fonction reçoit des coordonnées du
     * monde, donc elle peut dire « ce point est à douze centimètres d'un mur »
     * sans rien savoir de la géométrie qu'on est en train de poser.
     *
     * Et l'attribut est écrit en **blanc** quand rien n'est cuit : une fusion
     * qui mêle des géométries avec et sans `color` ne peut pas deviner la
     * valeur manquante, et three la remplit de zéros — c'est-à-dire de noir.
     */
    const count = geometry.getAttribute('position').count;
    const teintes = new Float32Array(count * 3);
    if (paint) {
      const position = geometry.getAttribute('position');
      for (let i = 0; i < count; i += 1) {
        const k = paint(position.getX(i), position.getY(i), position.getZ(i));
        teintes[i * 3] = k;
        teintes[i * 3 + 1] = k;
        teintes[i * 3 + 2] = k;
      }
    } else {
      teintes.fill(1);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(teintes, 3));
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
  /**
   * Monter le hall et son atrium.
   *
   * Faux par défaut, et c'est le sens de la page depuis qu'elle ne visite plus
   * qu'un appartement : la caméra ne descend plus au rez, donc le hall, ses
   * silhouettes, le puits et ses douze coursives ne sont plus jamais dans le
   * champ. Les garder coûterait un tiers des triangles de la scène pour des
   * pièces que personne ne verra. Le code reste — c'est du travail juste, et
   * une autre page pourra le rallumer — mais il ne se paie plus.
   */
  hall?: boolean;
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
  /* La voûte est bien plus fine qu'avant — soixante-douze méridiens contre
     trente-deux. C'est le prix des nuages : une couleur portée par les sommets
     ne peut varier qu'aux sommets, et une bande de nuages peinte sur une
     sphère de trente-deux segments donne trente-deux facettes, pas des nuages.
     Cinq mille triangles pour tout le ciel, dessinés en un appel : c'est le
     poste le moins cher de la scène et le plus visible par une baie. */
  const geometry = new THREE.SphereGeometry(600, leger ? 40 : 72, leger ? 24 : 44);
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
  const nue = new THREE.Color(0xe8ded0);
  const nueOmbre = new THREE.Color(0x8f95a0);
  const nueFeu = new THREE.Color(0xffd7a4);
  const teinteNue = new THREE.Color();

  /**
   * La couverture nuageuse, en un point du ciel.
   *
   * Trois sinusoïdes d'échelles différentes, prises en azimut et en site : la
   * première dessine les grands paquets, la deuxième les découpe, la troisième
   * casse la régularité des deux autres. C'est le plus vieux truc du bruit
   * procédural et il suffit ici, parce qu'on ne demande pas des nuages
   * photographiques — on demande que le ciel cesse d'être un dégradé.
   *
   * Elles sont **rassemblées en bande** autour de douze degrés de hauteur. Un
   * ciel d'heure dorée n'a pas de nuages au zénith : il en a une couche basse,
   * qui prend la lumière par en dessous, et c'est précisément cette couche que
   * l'on voit depuis une baie du cinquième étage — on regarde à l'horizontale,
   * pas vers le haut.
   */
  const couverture = (azimut: number, site: number): number => {
    /* Deux couches, et c'est ce qui fait la profondeur d'un ciel : une couche
       basse, large et molle, vers dix degrés — celle qu'on voit par une baie —
       et une couche haute, plus serrée et plus contrastée, vers trente. Une
       seule couche donne un bandeau ; deux donnent une distance. */
    const basse =
      Math.sin(azimut * 3.1 + site * 8.5) * 0.46 +
      Math.sin(azimut * 7.7 - site * 3.6 + 1.3) * 0.3 +
      Math.sin(azimut * 1.6 + site * 15 + 2.4) * 0.24;
    const haute =
      Math.sin(azimut * 5.4 - site * 6.2 + 0.7) * 0.5 +
      Math.sin(azimut * 11.3 + site * 9.1 + 2.9) * 0.28 +
      Math.sin(azimut * 2.2 - site * 21 + 4.1) * 0.22;
    const a =
      Math.max(0, (basse * 0.5 + 0.5 - 0.44) / 0.56) *
      Math.exp(-Math.pow((site - 0.17) / 0.2, 2));
    const b =
      Math.max(0, (haute * 0.5 + 0.5 - 0.56) / 0.44) *
      Math.exp(-Math.pow((site - 0.52) / 0.26, 2));
    return Math.min(1, a + b * 0.8);
  };

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

    /*
     * Les nuages, posés par-dessus le dégradé.
     *
     * Leur couleur n'est pas une : elle va de l'ombre bleutée au feu, selon
     * l'angle au soleil. C'est ce qui fait un ciel de fin de journée — un
     * nuage éclairé par en dessous a une face allumée et une face froide, et
     * un ciel dont tous les nuages ont le même gris est un ciel de midi
     * couvert, quelle que soit la couleur du fond.
     */
    const site = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    const dense = couverture(Math.atan2(dir.z, dir.x), site);
    if (dense > 0) {
      teinteNue.copy(nueOmbre).lerp(nue, 0.35 + 0.4 * proche);
      teinteNue.lerp(nueFeu, Math.pow(Math.max(0, proche), 2.2));
      teinte.lerp(teinteNue, Math.min(0.88, dense));
    }

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

/** Altitude du plancher brut du niveau `n`. */
function altitudeDe(n: number): number {
  return SOCLE + 0.25 + n * ETAGE;
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
  const avecHall = options.hall === true;
  const bin: Bin[] = [];
  const scene = new THREE.Scene();

  /*
   * La brume, et pourquoi elle change tout.
   *
   * Sans elle, la scène est faite de deux aplats qui se touchent : un sol et
   * un ciel, séparés par une arête nette. Aucun paysage ne ressemble à cela —
   * l'air est un matériau, il blanchit ce qui est loin, et c'est cette
   * dégradation-là qui donne à un bâtiment son échelle. Cent quatre-vingt-cinq
   * mètres de franchise, mille cinquante de portée. Les valeurs ont doublé le
   * jour où la page est passée à l'intérieur : ce qu'on regarde n'est plus une
   * façade à cent mètres mais **une ville par une baie**, entre cent cinquante
   * et quatre cents mètres. Une brume réglée pour détacher un bâtiment de son
   * parvis effaçait exactement ce qu'on venait de construire pour meubler
   * l'horizon.
   *
   * La couleur est **exactement** celle de l'horizon du ciel. Un ton de brume
   * qui s'en écarte de deux points recrée la ligne qu'on cherchait à effacer.
   */
  scene.fog = new THREE.Fog(TON.horizon, 240, 1050);

  const voute = ciel(bin, leger);

  /* Tous les matériaux acceptent la couleur des sommets. C'est sans effet sur
     ceux qui ne portent rien — l'attribut y vaut blanc — et cela évite d'avoir
     deux familles de matériaux qui ne peuvent pas fusionner ensemble. */
  /*
   * Les matières, calculées une fois au démarrage.
   *
   * Elles sont montées avant les matériaux parce que chaque matériau en reçoit
   * trois cartes et sa densité de répétition. Voir `matieres.ts` pour le
   * pourquoi de chaque réglage.
   */
  const matieres = creerMatieres(leger);
  bin.push(matieres);

  /*
   * Le matériau physique, réservé à deux comportements que le standard ne sait
   * pas rendre.
   *
   * `MeshPhysicalMaterial` coûte plus cher par pixel que `MeshStandardMaterial`
   * — il déroule des lobes de réflexion supplémentaires — et on ne le donne
   * donc qu'aux matières dont l'aplat trahit vraiment la synthèse :
   *
   * **Le lustre des tissus.** Un tissu n'est pas un plastique mat : ses fibres
   * renvoient la lumière en rasant, et c'est ce liseré clair sur le bord des
   * coussins qui fait « du lin » plutôt que « du plâtre peint ». Sans lui, le
   * canapé — le plus gros objet de la page — se lisait comme un bloc de mousse
   * sculptée, et aucune texture ne le rattrapait : le défaut n'est pas dans la
   * couleur, il est dans la façon dont la matière renvoie.
   *
   * **Le vernis du parquet et le poli du marbre.** Une couche transparente
   * par-dessus la matière, avec sa propre rugosité : c'est exactement ce
   * qu'est un vernis. Elle donne au sol le reflet allongé de la baie que la
   * seule rugosité ne sait pas produire — baisser la rugosité aurait rendu le
   * bois lui-même brillant, ce qui est un autre matériau.
   */
  const mat = (
    color: number,
    roughness: number,
    extra: THREE.MeshStandardMaterialParameters = {},
    matiere?: Matiere,
    physique?: THREE.MeshPhysicalMaterialParameters,
  ) => {
    /*
     * Le matériau physique est réservé aux machines qui peuvent le payer.
     *
     * Mesuré : lustre et vernis ensemble coûtent près de vingt pour cent de
     * temps par image sous rendu logiciel, parce qu'ils ajoutent des lobes de
     * réflexion évalués **à chaque pixel** couvert par ces matières — et le
     * canapé, le sol et les plans de travail en couvrent beaucoup.
     *
     * Sur un téléphone, ils sont donc remplacés par le matériau standard, qui
     * garde la couleur, la texture et la rugosité. On y perd le liseré des
     * tissus et le reflet allongé du parquet ; on n'y perd ni la matière, ni
     * la lumière, ni le plan. C'est le même arbitrage que pour la carte de
     * relief : ce qui se voit le moins sur six pouces part en premier.
     */
    const enPhysique = physique && !leger;
    const Classe = enPhysique ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const material = new Classe({
      color,
      /*
       * La rugosité est **relevée** quand une carte l'accompagne.
       *
       * three multiplie la rugosité du matériau par le canal vert de la carte,
       * et une carte huit bits ne dépasse pas un : elle ne sait donc que
       * baisser. Posée telle quelle sur un parquet à 0,42, elle l'aurait rendu
       * uniformément plus brillant — pas plus varié, plus brillant, ce qui est
       * exactement le contraire du but. On relève donc la valeur de base de la
       * moitié de l'amplitude de la carte, pour que la **moyenne** reste celle
       * qui a été mesurée et validée par `npm run palette`.
       */
      roughness: matiere ? Math.min(1, roughness / (1 - MAT_MOYEN)) : roughness,
      ...(matiere
        ? {
            map: matiere.map,
            roughnessMap: matiere.roughnessMap,
            /*
             * La carte de relief saute sur les petites machines.
             *
             * C'est la plus chère des trois, et de loin : elle ajoute un
             * échantillonnage, mais surtout elle oblige le nuanceur à
             * reconstruire un repère tangent par dérivées d'écran. Mesuré, les
             * trois cartes ensemble coûtent dix-huit pour cent de temps par
             * image sous rendu logiciel ; la carte de relief en est les deux
             * tiers.
             *
             * Un téléphone garde donc la couleur et la brillance — le parquet
             * y a ses lames, le lin sa trame — et perd le relief, qui est
             * précisément ce qui se voit le moins sur six pouces.
             */
            ...(leger ? {} : { normalMap: matiere.normalMap, normalScale: new THREE.Vector2(1, 1) }),
          }
        : {}),
      vertexColors: true,
      /* Le grain de quantification, pour le chemin sans profondeur de champ.
         Les petites machines rendent en direct, sans passe de composition :
         c'est donc au matériau de disperser les paliers de huit bits, faute de
         quoi un mur en dégradé lent y sort en marches d'escalier colorées.
         Sur le chemin avec profondeur de champ, le grain est appliqué une
         seule fois à la composition — ce qui vaut mieux, un tramage appliqué
         deux fois se voyant — mais les deux chemins doivent être couverts. */
      dithering: true,
      ...extra,
      ...(enPhysique ? physique : {}),
    });
    if (matiere) material.userData.tuile = matiere.tuile;
    bin.push(material);
    return material;
  };
  const beton = mat(TON.beton, 0.92, {}, matieres.beton);
  const soffite = mat(TON.soffite, 0.94, {}, matieres.beton);
  const refend = mat(TON.refend, 0.93, {}, matieres.beton);
  const meneau = mat(TON.meneau, 0.62, { metalness: 0.25 });
  const parvis = mat(TON.parvis, 0.95, {}, matieres.beton);
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
  const allege = mat(TON.allege, 0.42, { metalness: 0.5 }, matieres.metal);
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
  /* Seize pour cent, et non trente : c'est la seule vitre de la scène qu'on
     regarde du dedans, et une vitre qu'on regarde du dedans doit disparaître.
     Le reste — le reflet du ciel, la teinte froide — vient de la carte
     d'environnement, pas de l'opacité. */
  const vitrine = mat(0x8fa2ad, 0.06, {
    metalness: 0.2,
    opacity: 0.16,
    transparent: true,
    userData: { sansOmbre: true },
  });
  const pierre = mat(TON.pierre, 0.15, { metalness: 0.05 }, matieres.pierre);
  /* Un chêne verni, pas un chêne brut. Quarante-deux centièmes de rugosité :
     à ce niveau, le sol renvoie une trace du vitrage et des lampes, et c'est
     ce reflet allongé sur les lames qui distingue une photographie d'intérieur
     d'un rendu. Toutes les matières de l'appartement ont été relevées d'un
     cran pour la même raison — un intérieur entièrement mat n'existe pas. */
  /* Le parquet est verni : une couche claire par-dessus, assez mate pour
     rester un sol qu'on habite. À 0,25 de rugosité de vernis, la baie s'y
     reflète en une bande allongée ; en dessous, on obtient un miroir de hall
     d'hôtel. */
  const parquet = mat(TON.parquet, 0.42, {}, matieres.parquet, {
    clearcoat: 0.34,
    clearcoatRoughness: 0.25,
  });
  const lin = mat(TON.lin, 0.76, {}, matieres.lin, {
    sheen: 1,
    /* Le lustre est **plus clair** que le tissu, pas de sa couleur : les
       fibres qui l'accrochent sont celles qui reçoivent le jour de biais, et
       elles renvoient la lumière de la pièce, pas leur propre teinte. */
    sheenColor: new THREE.Color(0xe8e2d6),
    sheenRoughness: 0.7,
  });
  /* L'unique accent de l'appartement : un olive profond, sur trois coussins et
     rien d'autre. Le nuancier du dépôt est neutre par principe, et il a raison
     — mais un séjour entièrement beige n'est pas neutre, il est éteint. Une
     seule couleur, à une seule place, réchauffe la pièce sans la décorer. */
  const accent = mat(0x4d5340, 0.72, {}, matieres.lin, {
    sheen: 1,
    sheenColor: new THREE.Color(0x9aa08c),
    sheenRoughness: 0.62,
  });
  const lointain = mat(TON.lointain, 0.95);
  /* Les silhouettes du hall sont mates et sombres, et c'est un choix, pas un
     raccourci. Le dépôt a déjà appris cette leçon sur les intérieurs : une
     figure humaine à laquelle on essaie de donner un visage tombe dans la
     vallée dérangeante à la première image. Une silhouette d'à-plat, elle, est
     la convention de tous les rendus d'architecture depuis cinquante ans — on
     y lit une personne, une échelle, une vie, et rien de faux. */
  const gens = mat(TON.gens, 0.88);
  const puits = mat(TON.puits, 0.72, { metalness: 0.03 });
  /* Les peintures de l'appartement, et le métal de ses menuiseries : deux
     matières qu'on ne voit qu'à deux mètres, donc deux matières que l'immeuble
     n'avait pas besoin d'avoir. */
  /*
   * Une peinture à 72 % de réflectance, et non 87.
   *
   * La différence n'est pas décorative : à 87 %, un tableau de cloison qui
   * prend le soleil rasant à travers la façade nord sature à blanc pur. La
   * mesure de contraste l'a désigné au pixel près — 1,08:1, pire pixel en
   * 1234,332, #ffffff — et un blanc pur dans une image est un endroit où
   * l'information a été perdue, quelle que soit la suite. Les peintures
   * mates du commerce tournent autour de 70 à 75 % ; on n'a rien inventé, on a
   * arrêté d'exagérer.
   */
  const enduit = mat(0xc9c5bd, 0.94, {}, matieres.enduit);
  const metal = mat(0x6f7377, 0.24, { metalness: 0.72 }, matieres.metal);
  /*
   * Le miroir, et pourquoi ce n'est pas du métal.
   *
   * Il était fait du même matériau que la robinetterie : métal à 0,72, rugueux
   * à 0,24. Cela donne un panneau gris — un vrai miroir renvoie **tout** ce
   * qu'il reçoit, sans rien absorber et sans rien diffuser. Métal pur, rugosité
   * quasi nulle, couleur presque blanche : il ne reflète ici que la carte
   * d'environnement, faute d'un rendu des réflexions de la pièce, mais cela
   * suffit à le distinguer d'une plaque de tôle — il attrape le ciel par la
   * porte, et la réglette qui est juste au-dessus de lui.
   */
  const miroir = mat(0xf2f2f0, 0.03, { metalness: 1, envMapIntensity: 1.4 });
  /* Le marbre était descendu à 0,12 — un miroir. Un plateau de table basse
     posé devant une baie y renvoyait le ciel en aplat blanc et se lisait comme
     une source lumineuse, pas comme une pierre. Un marbre poli réel rend
     autour de 0,25 : assez pour attraper un reflet allongé, pas assez pour
     recopier la fenêtre. */
  const marbre = mat(TON.marbre, 0.24, { metalness: 0.04 }, matieres.marbre, {
    clearcoat: 0.55,
    clearcoatRoughness: 0.1,
  });
  const bois = mat(TON.bois, 0.44, {}, matieres.bois);
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

  /* Ce que l'appartement emprunte à l'immeuble. Une seule liste, explicite :
     un module qui pioche dans les matériaux de son hôte finit par en créer un
     de son côté « juste pour cette pièce », et la scène gagne un appel de
     dessin par pièce. */
  const palette: Palette = {
    parquet,
    pierre,
    marbre,
    enduit,
    soffite,
    bois,
    lin,
    accent,
    meneau,
    vitrine,
    garde,
    lueur,
    miroir,
    fut,
    vegetal,
    tronc,
    metal,
  };

  /* Les cotes du puits, à portée de tout le fichier : la géométrie les emploie
     dans un bloc conditionnel, l'éclairage dans un autre. */
  const AX = (PUITS.x0 + PUITS.x1) / 2;
  const AZ = (PUITS.z0 + PUITS.z1) / 2;
  const CIME = altitudeDe(NIVEAUX - 1) + ETAGE - NEZ;
  const CORPS = CIME - HALL_COTES.haut;

  const lot = new Lot();
  const groupe = new THREE.Group();
  const M = new THREE.Matrix4();
  const pose = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    paint?: (px: number, py: number, pz: number) => number,
    maille?: number,
  ) => lot.add(geometry, material, M.makeTranslation(x, y, z), paint, maille);

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
    const dehors =
      !avecHall || x1 <= PUITS.x0 || x0 >= PUITS.x1 || z1 <= PUITS.z0 || z0 >= PUITS.z1;
    if (dehors) {
      pose(new THREE.BoxGeometry(largeur, epaisseur, profondeur), materiau, cx, cy, cz);
      return;
    }
    const morceau = (a: number, b: number, c: number, d: number) => {
      if (b - a < 0.01 || d - c < 0.01) return;
      pose(new THREE.BoxGeometry(b - a, epaisseur, d - c), materiau, (a + b) / 2, cy, (c + d) / 2);
    };
    const mx0 = Math.max(x0, PUITS.x0);
    const mx1 = Math.min(x1, PUITS.x1);
    morceau(x0, mx0, z0, z1);
    morceau(mx1, x1, z0, z1);
    morceau(mx0, mx1, z0, Math.max(z0, PUITS.z0));
    morceau(mx0, mx1, Math.min(z1, PUITS.z1), z1);
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
   * Le hall et l’atrium ne sont montés que si on les demande.
   *
   * La page ne visite plus qu’un appartement : la caméra n’est jamais
   * descendue au rez ni engagée dans le puits, et tout ce bloc — sol de
   * pierre, colonnes, comptoir, silhouettes, douze coursives, verrière —
   * ne serait dessiné pour personne. Il représentait un tiers des
   * triangles de la scène. On le garde, on ne le paie plus.
   */
  const IX = HALL_COTES.hx;
  const IZ = HALL_COTES.hz;
  const HALL = HALL_COTES.haut;
  if (avecHall) {
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
    /** Hauteur du vitrage ; au-dessus, une retombée pleine. */
    const VITRE = 4.9;
    /** Demi-largeur de la porte, sur la face +x. C'est par là qu'on entre. */
    const PORTE = HALL_COTES.porte;
    /** Hauteur du linteau de la porte. */
    const LINTEAU = 3.9;

    // Le sol, débordant légèrement pour couvrir le seuil.
    pose(new THREE.BoxGeometry(IX * 2 + 0.6, 0.44, IZ * 2 + 0.6), pierre, 0, 0, 0);
    /* Le plafond, **percé**. Le vide de l'atrium le traverse, et c'est par là
       que le vol quitte le hall : on ne peut pas monter à travers une dalle.
       Quatre morceaux autour du trou plutôt qu'un panneau entier. */
    const trou = { x0: PUITS.x0, x1: PUITS.x1, z0: PUITS.z0, z1: PUITS.z1 };
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
    const signe = enseigne(bin, 'ORIEL');
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
    /*
     * Au niveau de l'appartement, les deux faces qu'il occupe ne sont **pas**
     * posées ici : c'est lui qui les monte, avec son ouvrant coulissant, ses
     * montants et son seuil.
     *
     * Elles l'étaient, et les deux vitrages se superposaient exactement. Deux
     * panneaux translucides à trente pour cent l'un derrière l'autre laissent
     * passer moins de la moitié de ce qu'un seul laisse passer : la ville
     * qu'on venait de construire pour la regarder par cette baie s'y voyait à
     * travers un voile laiteux, et le coupable n'était ni la brume, ni la
     * profondeur de champ, ni le nuancier — c'était une vitre en trop.
     */
    const baie = niveau === NIVEAU_APPARTEMENT;
    for (const [i, z] of [-(e.hz - 0.2), e.hz - 0.2].entries()) {
      if (baie && i === 1) continue;
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
      if (baie && i === 1) continue;
      pose(
        new THREE.BoxGeometry(EP, ETAGE - NEZ, e.hz * 2 - 0.4 - EP * 2),
        teinte(i + 2),
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
    /*
     * À l'étage de l'appartement, la sous-face remonte **dans** la dalle.
     *
     * Ailleurs elle pend seize centimètres sous le plancher haut, et c'est très
     * bien : de dehors, cette ombre-là donne son épaisseur à chaque niveau.
     * Mais au cinquième, elle pendait à l'intérieur du séjour, quinze
     * centimètres sous le plafond peint — donc devant lui. Une sonde tirée
     * depuis la caméra a répondu « #8e908f à 3,31 m » là où l'on avait peint
     * du #c9c5bd : on regardait un béton gris de sous-face de dalle en croyant
     * regarder un plafond, et toute la pièce était tirée vers le gris par la
     * plus grande surface du cadre. La hauteur annoncée par la page était
     * fausse du même coup — deux mètres quatre-vingt-cinq pour trois mètres
     * écrits en gros. On la recale au ras du plancher haut : le plafond de
     * l'appartement redevient la surface la plus basse, et les trois mètres
     * sont vrais.
     */
    percee(
      soffite,
      e.hx * 2 + 0.1,
      0.16,
      e.hz * 2 + 0.1,
      e.dx,
      niveau === NIVEAU_APPARTEMENT ? dalle + 0.08 : dalle - 0.08,
      0,
    );

    /* La résille : un meneau toutes les trames sur les deux longs côtés.
       C'est la seule répétition assumée de la façade, et elle est
       indispensable — sans verticales, un bandeau vitré n'a pas d'échelle. */
    const colonnes = Math.round((e.hx * 2) / TRAME);
    for (let i = 0; i <= colonnes; i += 1) {
      const x = e.dx - e.hx + i * ((e.hx * 2) / colonnes);
      for (const z of [-e.hz - 0.02, e.hz + 0.02]) {
        if (baie && z > 0) continue;
        pose(new THREE.BoxGeometry(0.16, ETAGE - NEZ, 0.3), meneau, x, bas + (ETAGE - NEZ) / 2, z);
      }
    }
    const rangs = leger ? 0 : Math.round((e.hz * 2) / TRAME);
    for (let i = 1; i < rangs; i += 1) {
      const z = -e.hz + i * ((e.hz * 2) / rangs);
      for (const [k, x] of [e.dx - e.hx - 0.02, e.dx + e.hx + 0.02].entries()) {
        if (baie && k === 1) continue;
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

  if (avecHall) {
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
    const AL = PUITS.x1 - PUITS.x0;
    const AP = PUITS.z1 - PUITS.z0;

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
    for (const z of [PUITS.z0 - 0.12, PUITS.z1 + 0.12]) {
      pose(new THREE.BoxGeometry(AL + 0.48, CORPS, 0.24), puits, AX, HALL + CORPS / 2, z);
    }
    for (const x of [PUITS.x0 - 0.12, PUITS.x1 + 0.12]) {
      pose(new THREE.BoxGeometry(0.24, CORPS, AP), puits, x, HALL + CORPS / 2, AZ);
    }
    /* Les nervures, **claires sur fond sombre**. Une nervure de la couleur de
       son mur ne se voit pas dans un volume sans ombre : c'est le contraste
       d'albédo qui la dessine, pas son relief. */
    for (let i = -4; i <= 4; i += 1) {
      for (const z of [PUITS.z0 + 0.07, PUITS.z1 - 0.07]) {
        pose(new THREE.BoxGeometry(0.14, CORPS, 0.14), marbre, AX + i * 0.9, HALL + CORPS / 2, z);
      }
      for (const x of [PUITS.x0 + 0.07, PUITS.x1 - 0.07]) {
        pose(new THREE.BoxGeometry(0.14, CORPS, 0.14), marbre, x, HALL + CORPS / 2, AZ + i * 0.9);
      }
    }
    /* Et un bandeau à chaque plancher, sur les deux joues sans coursive : c'est
       ce qui compte les étages quand on lève les yeux. */
    for (let n = 1; n < NIVEAUX; n += 1) {
      const sol = altitudeDe(n);
      for (const x of [PUITS.x0 + 0.16, PUITS.x1 - 0.16]) {
        pose(new THREE.BoxGeometry(0.3, 0.44, AP - 0.5), marbre, x, sol - 0.22, AZ);
      }
    }

    /* Les coursives, une paire par niveau. Ce sont elles qui donnent l'échelle
       du puits : sans elles, un vide de quarante-trois mètres n'a pas de
       graduation et pourrait aussi bien en faire dix. */
    for (let n = 0; n < NIVEAUX; n += 1) {
      const sol = altitudeDe(n);
      if (sol < HALL + 1) continue;
      for (const sens of [-1, 1]) {
        const bord = sens < 0 ? PUITS.z0 : PUITS.z1;
        const centre = bord - sens * (PUITS.coursive / 2);
        const nez = bord - sens * PUITS.coursive;
        pose(new THREE.BoxGeometry(AL, 0.24, PUITS.coursive), pierre, AX, sol - 0.12, centre);
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

  }

  /* ------------------------------------------------------- appartement --- */
  /*
   * L'appartement du cinquième, monté par `components/three/appartement.ts`.
   *
   * Il tenait ici, en quatre-vingts lignes, du temps où il n'était qu'un des
   * neuf plans du vol. C'est désormais le sujet entier de la page — cinq
   * pièces cloisonnées, meublées et éclairées une par une — et il a sa place
   * à lui : ce fichier construit un immeuble, l'autre aménage un logement, et
   * les deux métiers n'ont ni les mêmes cotes ni la même échelle de détail.
   */
  for (const lampe of poserAppartement({ pose, materiaux: palette, leger })) {
    scene.add(lampe);
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

  /*
   * Le sol de la ville : des îlots et des rues, et non une dalle.
   *
   * Depuis un cinquième étage, on ne regarde pas l'horizon — on regarde
   * quarante-cinq degrés en dessous. Ce qui remplit la moitié basse d'une baie
   * n'est donc pas le ciel ni la silhouette des tours, c'est **le sol**, et il
   * était uniformément gris sur neuf cents mètres. Une trame de rues sombres
   * tous les soixante mètres, des îlots un ton plus clair entre elles, et
   * quelques carrés plantés : trois matières, une centaine de pavés plats, et
   * la vue cesse d'être un désert.
   */
  const RUE = 12;
  const ILOT = 62;
  const bitume = mat(0x5d5b57, 0.96);
  const pave = mat(0x9d9a93, 0.95);
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const cx = i * (ILOT + RUE);
      const cz = j * (ILOT + RUE);
      /* On ne pose rien sur la parcelle du projet : elle a déjà son parvis. */
      if (Math.abs(cx) < ILOT && Math.abs(cz) < ILOT) continue;
      const vert = tirage() < 0.16;
      /*
       * Chaque îlot a **sa** valeur, et son bord est plus sombre que son
       * milieu.
       *
       * Sans cela, le sol de la ville est un aplat : cent pavés de la même
       * couleur mis bord à bord ne font pas une trame, ils font une dalle, et
       * le dernier plan de la page — celui qui recule sur l'immeuble — sortait
       * avec un plateau gris uniforme sur les deux tiers de sa surface. Ce
       * qu'on lit d'une ville vue de haut n'est pas la forme des îlots, c'est
       * qu'ils ne sont pas de la même couleur : un toit de zinc, un toit de
       * tuile, une cour, un parking. Une valeur tirée par îlot dans la même
       * suite déterministe suffit à le dire, et elle ne coûte rien puisqu'elle
       * est portée par les sommets d'un pavé qu'on posait déjà.
       *
       * Le bord assombri, lui, fait le travail des rues : à trois cents
       * mètres, une rue de douze mètres tient dans deux pixels, et c'est
       * l'ombre à son droit — pas son asphalte — qui la fait exister.
       */
      const ton = 0.82 + tirage() * 0.36;
      /* Une nappe à cinq divisions, et non un pavé subdivisé. Le pavé donnait
         la même image pour soixante-quatre fois plus de triangles : on ne voit
         que sa face supérieure, et la subdivision travaillait aussi sur les
         cinq autres. Cinq divisions suffisent à porter un dégradé de bord —
         on regarde cet îlot de trois cents mètres, pas de trois. */
      const parcelle = new THREE.PlaneGeometry(ILOT, ILOT, 5, 5);
      parcelle.rotateX(-Math.PI / 2);
      pose(
        parcelle,
        vert ? vegetal : pave,
        cx,
        0.18,
        cz,
        (px, _py, pz) => {
          const bord = Math.max(Math.abs(px - cx), Math.abs(pz - cz)) / (ILOT / 2);
          return ton * (1 - 0.3 * Math.pow(bord, 3));
        },
        99,
      );
    }
  }
  // Les rues, un rien en creux : elles passent entre les îlots.
  for (let i = -6; i <= 6; i += 1) {
    const c = i * (ILOT + RUE) + (ILOT + RUE) / 2;
    pose(new THREE.BoxGeometry(RUE, 0.1, 13 * (ILOT + RUE)), bitume, c, 0.05, 0);
    pose(new THREE.BoxGeometry(13 * (ILOT + RUE), 0.1, RUE), bitume, 0, 0.05, c);
  }

  /*
   * Le lointain.
   *
   * C'est la correction qui a le plus changé l'image pour le moins de
   * géométrie. Le bâtiment se dressait sur une dalle vide : quelle que soit la
   * qualité de sa façade, il ressemblait à une maquette posée sur une table,
   * parce qu'une maquette est précisément un bâtiment sans voisins.
   *
   * Les masses sont maintenant **bandées** : un nez de plancher tous les trois
   * mètres et demi, un ton plus clair que la façade. C'est ce qui distingue un
   * immeuble d'un parallélépipède, et à trois cents mètres c'est la seule
   * chose qui les distingue — on ne voit ni fenêtres, ni matières, on voit
   * seulement que quelque chose compte ses étages.
   *
   * Elles sont posées par une suite déterministe et non par un tirage : une
   * ville qui change à chaque rechargement n'est pas un lieu. La règle laisse
   * un vide devant la façade est — celle que l'appartement regarde — pour que
   * la vue porte, et fait monter les hauteurs vers le fond.
   */
  /*
   * Les voisins sont **sombres**, et les bandeaux clairs.
   *
   * La première ville était peinte dans les mêmes gris moyens que le ciel : à
   * trois cents mètres, sous une brume et un éclairage d'environnement, tout
   * tombait dans la même bande de valeurs et la vue par la baie ressemblait à
   * du brouillard. Ce qui fait lire une silhouette n'est pas sa forme, c'est
   * son écart au fond — et le fond, ici, est un ciel pâle d'heure dorée.
   */
  const voisin = mat(0x74716c, 0.95);
  const bandeau = mat(0xc8c3ba, 0.93);
  /*
   * Le vide devant la baie était un vide **total**, et c'était une erreur.
   *
   * La règle disait : on ne bâtit pas dans le cône que l'appartement regarde,
   * pour que la vue porte. Le rendu a répondu autrement. Le plan « La baie »
   * — celui dont le seul sujet est la vue — sortait en aplat crème d'un bord
   * à l'autre du cadre : pas de ciel, pas de ville, un mur de brume. On avait
   * dégagé la vue de tout ce qu'il y avait à voir.
   *
   * Ce que l'on voit d'un cinquième étage n'est pas l'horizon : c'est une
   * **mer de toitures**, deux ou trois niveaux plus bas que soi, et le ciel
   * au-dessus. Le cône reste donc dégagé de tout ce qui monterait plus haut
   * que le plancher de l'appartement — vingt-trois mètres quatre-vingts — et
   * se remplit d'immeubles de rapport de huit à vingt mètres. La vue porte
   * toujours, et elle porte maintenant sur quelque chose.
   */
  const DEVANT = (x: number, z: number, loin: number) => x > 40 && Math.abs(z) < loin * 0.3;
  const COMBIEN = leger ? 34 : 54;
  for (let i = 0; i < COMBIEN; i += 1) {
    const angle = (i / COMBIEN) * Math.PI * 2 + tirage() * 0.16;
    const loin = 150 + tirage() * 260;
    const x = Math.cos(angle) * loin;
    const z = Math.sin(angle) * loin;
    const devant = DEVANT(x, z, loin);
    const haut = devant
      ? 8 + tirage() * 12
      : 16 + tirage() * 40 + (loin - 150) * 0.08;
    const large = 15 + tirage() * 24;
    const profond = 15 + tirage() * 24;
    pose(new THREE.BoxGeometry(large, haut, profond), voisin, x, haut / 2, z);
    // Les nez de plancher, sur les deux faces tournées vers le projet.
    const versX = x > 0 ? -1 : 1;
    const versZ = z > 0 ? -1 : 1;
    for (let y = 3.4; y < haut - 1.2; y += 3.4) {
      pose(new THREE.BoxGeometry(large + 0.5, 0.34, 0.3), bandeau, x, y, z + versZ * (profond / 2));
      pose(new THREE.BoxGeometry(0.3, 0.34, profond + 0.5), bandeau, x + versX * (large / 2), y, z);
    }
    // Un acrotère, et une machinerie sur le toit une fois sur trois.
    pose(new THREE.BoxGeometry(large + 0.8, 0.9, profond + 0.8), bandeau, x, haut + 0.45, z);
    if (tirage() < 0.34) {
      pose(new THREE.BoxGeometry(large * 0.3, 2.2, profond * 0.3), voisin, x, haut + 2, z);
    }
  }

  /*
   * L'arrière-plan lointain : des masses nues entre cinq cents et neuf cents
   * mètres, sans nez de plancher ni acrotère.
   *
   * À cette distance-là, la brume a déjà mangé les deux tiers du contraste et
   * un bandeau de trente-quatre centimètres ne fait plus un pixel : les poser
   * serait payer deux mille triangles pour rien. Ce qui compte est le
   * **profil**, et seulement lui — une ligne de toitures qui décroît vers le
   * fond, derrière la mer de toits proches. C'est ce qui distingue une ville
   * d'un quartier posé sur un plateau : à un moment, ça continue.
   *
   * Ils montent plus haut que les proches — trente à cent mètres — parce que
   * c'est ainsi qu'on lit une distance sans stéréoscopie : ce qui est loin
   * doit être grand pour paraître aussi petit.
   */
  for (let i = 0; i < (leger ? 16 : 30); i += 1) {
    const angle = (i / (leger ? 16 : 30)) * Math.PI * 2 + tirage() * 0.2;
    const loin = 520 + tirage() * 380;
    const x = Math.cos(angle) * loin;
    const z = Math.sin(angle) * loin;
    const haut = 30 + tirage() * 70;
    pose(
      new THREE.BoxGeometry(26 + tirage() * 40, haut, 26 + tirage() * 40),
      voisin,
      x,
      haut / 2,
      z,
    );
  }

  /* Les arbres d'alignement, le long des rues les plus proches. Ils donnent au
     sol l'échelle que les îlots seuls ne donnent pas : un carré de soixante
     mètres pourrait en faire six ou six cents. */
  for (let i = 0; i < (leger ? 14 : 30); i += 1) {
    const long = tirage() < 0.5;
    const c = (Math.floor(tirage() * 3) - 1) * (ILOT + RUE) + (ILOT + RUE) / 2;
    const t = (tirage() - 0.5) * 260;
    const x = long ? c : t;
    const z = long ? t : c;
    if (Math.hypot(x, z) < 46) continue;
    pose(new THREE.CylinderGeometry(0.14, 0.2, 3.4, 6), tronc, x, 1.7, z);
    for (const [j, [dx, dy, dz, r]] of ([
      [0, 0, 0, 2.2],
      [0.9, 0.6, 0.5, 1.5],
      [-0.7, 0.5, -0.8, 1.3],
    ] as const).entries()) {
      /* Une seule subdivision suffit à trente mètres : ce qu'on lit là-bas est
         le contour, pas les paquets. Quatre-vingts faces par masse. */
      pose(masseFeuillue(r, leger ? 0 : 1, i * 91 + j * 13, 0.8), vegetal, x + dx, 4.4 + dy, z + dz);
    }
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
    for (const [j, [dx, dy, dz, k]] of ([
      [0, 0, 0, 1],
      [r * 0.52, r * 0.34, -r * 0.28, 0.72],
      [-r * 0.46, r * 0.2, r * 0.4, 0.66],
      [r * 0.16, -r * 0.32, r * 0.5, 0.58],
    ] as const).entries()) {
      /* Ceux-là sont au pied de l'immeuble, donc dans le cadre du dernier
         écran : ils ont droit à une subdivision de plus. */
      pose(
        masseFeuillue(r * k, leger ? 1 : 2, Math.round(x * 7 + z * 3) + j * 17, 0.76),
        vegetal,
        x + dx,
        pied + dy,
        z + dz,
      );
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
  /*
   * Le ciel d'ambiance descend, le soleil monte : c'est le réglage qui
   * rapproche le plus une image de synthèse d'une prise de vue.
   *
   * Une scène éclairée surtout par une ambiance uniforme n'a pas de faute
   * repérable — elle a seulement un défaut, et c'est le plus tenace : rien
   * n'y a de face éclairée et de face à l'ombre. Tout est du même côté de la
   * lumière. On peut y poser toutes les matières du monde, elle continue de
   * se lire comme un rendu, parce que ce que l'œil vérifie d'abord n'est pas
   * la matière : c'est **d'où vient la lumière**.
   *
   * On déplace donc la même quantité de lumière de l'ambiance vers le soleil.
   * L'exposition moyenne bouge à peine ; l'écart entre le mur qui reçoit et
   * le mur qui ne reçoit pas double. C'est ce qui fait entrer de vraies taches
   * de soleil par la baie est, au lieu d'un dégradé.
   */
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x9d9890, 0.85));
  /* Le soleil monte à 3,4 pendant que l'environnement descend à 0,92. La
     somme est presque inchangée ; la **répartition** ne l'est pas. Une scène
     éclairée surtout par le ciel est une scène sans direction : rien n'y a de
     face claire et de face sombre. En rendant au soleil la part qui lui
     revient, chaque volume retrouve deux faces, et une pièce retrouve un
     modelé. */
  const soleil = new THREE.DirectionalLight(0xffe9c9, 4.8);
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
  /*
   * Le cadre de l'ombre est resserré sur le bâtiment.
   *
   * Il couvrait cent quarante mètres sur cent dix — le parvis, les arbres, le
   * bassin — pour une carte de deux mille pixels, soit quinze texels par
   * mètre. C'était juste tant qu'on regardait l'immeuble de loin. Vu depuis un
   * séjour, ce même réglage transforme l'ombre d'un meneau de quatorze
   * centimètres en une bande crénelée sur le parquet.
   *
   * Quatre-vingts mètres sur soixante-dix : trente texels par mètre, et les
   * ombres portées des menuiseries redeviennent des lignes. Ce qui sort du
   * cadre — le lointain — n'a de toute façon aucune ombre à recevoir qu'on
   * puisse voir depuis le cinquième étage.
   */
  const cam = soleil.shadow.camera;
  cam.left = -40;
  cam.right = 40;
  cam.top = 62;
  cam.bottom = -8;
  cam.near = 60;
  cam.far = 260;
  cam.updateProjectionMatrix();
  /* Le biais est négatif et minuscule : une façade de verre presque tangente
     au soleil produit sinon des bandes d'ombre en escalier sur elle-même. */
  soleil.shadow.bias = -0.0006;
  soleil.shadow.normalBias = 0.06;
  scene.add(soleil);
  scene.add(soleil.target);

  /* La lumière de renvoi a été retirée. Elle rattrapait les sous-faces du
     bâtiment vues du parvis ; depuis que la page ne quitte plus un appartement,
     ces sous-faces ne sont plus dans le champ, et la carte d'environnement
     — montée à 1,05 pour l'intérieur — fait déjà ce travail. Une source
     directionnelle de moins, c'est une boucle de moins par fragment, sur un
     écran désormais entièrement couvert de matière. */

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

  if (avecHall) {
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
    /*
     * Un peu plus d'un, et non zéro virgule sept.
     *
     * Le réglage a changé de contexte : il servait à faire refléter le ciel
     * dans une façade de verre vue du dehors, il sert maintenant à éclairer
     * cinq pièces vues du dedans. Une carte d'environnement est la seule
     * lumière indirecte de cette scène — il n'y a ni radiosité, ni occlusion
     * cuite — donc c'est elle qui tient les murs, les plafonds et tout ce que
     * le soleil ne touche pas. À 0,7, l'appartement rendait un séjour du soir
     * en plein après-midi.
     */
    scene.environmentIntensity = 0.74;
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
