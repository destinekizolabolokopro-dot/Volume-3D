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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
/** Hauteur des plinthes. Un détail minuscule qui fait « pièce » plutôt que « boîte ». */
const SKIRTING = 0.09;

/** Réutilisés à chaque pièce plutôt que réalloués : la construction en pose
 *  quelques milliers. */
const AXE_Y = new THREE.Vector3(0, 1, 0);
const IDENTITE = new THREE.Matrix4();
/** Hauteur de la corniche, au raccord du mur et du plafond. */
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

  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix: THREE.Matrix4): void {
    geometry.applyMatrix4(matrix);
    if (!geometry.getAttribute('color')) {
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
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
      const merged = lot.length === 1 ? lot[0] : mergeGeometries(lot, false);
      if (!merged) {
        // La fusion refuse des attributs incompatibles : on retombe sur des
        // objets séparés plutôt que de perdre la géométrie.
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
      mesh.castShadow = true;
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
 * Écrit l'occlusion dans l'attribut `color` d'une boîte.
 *
 * `bottom` est l'altitude du bas de la boîte dans la scène et `height` sa
 * hauteur : la géométrie est centrée sur son origine, donc son y local va de
 * `-height / 2` à `+height / 2`.
 */
function bakeContact(
  geometry: THREE.BufferGeometry,
  bottom: number,
  height: number,
  ceiling: number,
): void {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const k = occlusionAt(bottom + height / 2 + position.getY(i), ceiling);
    colors[i * 3] = k;
    colors[i * 3 + 1] = k;
    colors[i * 3 + 2] = k;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
}

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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    scene.environmentIntensity = 1.05;
  }
  lights(scene, Math.max(box.maxX - box.minX, box.maxY - box.minY));
  scene.add(ground(bin));
  scene.add(surroundings(rooms, doors, origin, bin));
  scene.add(shell(rooms, doors, origin, bin));
  scene.add(furniture(massing, origin, bin));

  const leaf = entrance ? doorLeaf(entrance, rooms, origin, bin) : null;
  if (leaf) scene.add(leaf.group);
  if (entrance) scene.add(landing(entrance, rooms, origin, bin));

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
function lights(scene: THREE.Scene, extent: number): void {
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
  scene.add(new THREE.HemisphereLight(0xfff4e4, 0xd9d2c6, 0.6));

  const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
  sun.position.set(-4, 7, -11);
  sun.castShadow = true;
  /* Mille vingt-quatre pixels pour un logement entier donnaient une ombre en
     escalier sur le nez des marches et le bord des tablettes. Le coût d'une
     carte deux fois plus fine se paie une fois par image, et la scène ne compte
     plus qu'une cinquantaine d'appels : elle peut se le permettre. */
  sun.shadow.mapSize.set(2048, 2048);
  const reach = extent / 2 + 2;
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
function ground(disposables: { dispose(): void }[]): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(220, 220);
  const material = new THREE.MeshStandardMaterial({ color: OUTSIDE.rue, roughness: ROUGHNESS.dehors });
  disposables.push(geometry, material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  /* Sept mètres plus bas : le logement est à un étage, comme la quasi-totalité
     des locations de ville. Au niveau du sol, chaque fenêtre donnait sur un
     aplat de terre à hauteur d'œil — la vue la plus déprimante possible pour un
     bien qu'on essaie de montrer sous son meilleur jour. */
  mesh.position.y = -7;
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
function surroundings(
  rooms: PlanRoom[],
  doors: PlanDoor[],
  origin: PlanPoint,
  disposables: { dispose(): void }[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'vis-a-vis';
  const stone = new THREE.MeshStandardMaterial({ color: OUTSIDE.vis_a_vis, roughness: ROUGHNESS.dehors });
  // Plus loin, plus clair : c'est ce que fait l'atmosphère, et c'est ce qui
  // donne la profondeur sans coûter un seul calcul de plus.
  const far = new THREE.MeshStandardMaterial({ color: OUTSIDE.vis_a_vis_loin, roughness: ROUGHNESS.dehors });
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
function plankTexture(disposables: Bin[]): THREE.Texture {
  const SIZE = 512;
  const PLANKS = 10;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d')!;

  const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
  context.fillStyle = hex(SHELL.chene);
  context.fillRect(0, 0, SIZE, SIZE);

  const band = SIZE / PLANKS;
  for (let row = 0; row < PLANKS; row += 1) {
    /* Chaque lame prend son propre écart de teinte, très faible et déterministe :
       un vrai parquet n'a pas deux lames identiques, mais l'écart entre elles se
       compte en unités, pas en dizaines. */
    const shade = 1 + (((row * 7) % 5) - 2) * 0.05;
    const base = SHELL.chene;
    const tint =
      (Math.min(255, Math.round(((base >> 16) & 255) * shade)) << 16) |
      (Math.min(255, Math.round(((base >> 8) & 255) * shade)) << 8) |
      Math.min(255, Math.round((base & 255) * shade));
    context.fillStyle = hex(tint);
    context.fillRect(0, row * band, SIZE, band);

    /* Le joint fait trois pixels, soit un peu plus d'un centimètre à l'échelle.
       Une première version en dessinait un et demi : six millimètres, c'est-à-dire
       moins d'un pixel à l'écran dès qu'on s'éloigne d'un mètre. Le parquet
       existait dans la texture et n'existait nulle part ailleurs. */
    context.fillStyle = hex(SHELL.chene_joint);
    context.fillRect(0, row * band, SIZE, 3);

    // Un joint en bout, décalé d'une rangée à l'autre.
    const cut = ((row * 173) % SIZE) | 0;
    context.fillRect(cut, row * band, 3, band);
  }

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
  const batch = new Batch();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3(1, 1, 1);

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
    const shape = new THREE.Shape(room.points.map(toSlab));
    const slab = new THREE.ShapeGeometry(shape);
    slab.rotateX(-Math.PI / 2);
    batch.add(slab, /eau|bain|wc/i.test(room.id + room.name) ? carrelage : parquet, IDENTITE);

    // Le plafond regarde vers le bas. Il reste en double face : depuis la pièce
    // voisine, le regard passe par une porte et le prend par-dessus.
    const top = slab.clone();
    batch.add(top, ceiling, matrix.makeTranslation(0, room.height, 0));

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
        const geometry = new THREE.BoxGeometry(width, height, depth);
        bakeContact(geometry, bottom, height, room.height);
        position.set(
          centre.x - origin.x + normal.x * (depth / 2),
          bottom + height / 2,
          centre.y - origin.y + normal.y * (depth / 2),
        );
        quaternion.setFromAxisAngle(AXE_Y, -angle);
        batch.add(geometry, material, matrix.compose(position, quaternion, echelle));
      };

      for (const span of solidSpans(openings)) {
        panel(span.from, span.to, 0, shellTop, wall);
        // La plinthe déborde légèrement de la peau du mur, sinon elle ne se
        // détache pas et ne sert à rien.
        panel(span.from, span.to, 0, SKIRTING, joinery, thickness + 0.018);
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
        panel(span.from, span.to, room.height - CORNICE, CORNICE, joinery, thickness + 0.05);
      }
    }
  }

  batch.flush(group, disposables);
  return group;
}

/** Le mobilier, ramené à ses masses, posé sur son ombre de contact. */
function furniture(
  items: Massing[],
  origin: PlanPoint,
  disposables: { dispose(): void }[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'mobilier';
  if (items.length === 0) return group;

  const materials = new Map<string, THREE.Material>();
  const shadow = contactShadow(disposables);
  const batch = new Batch();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const echelle = new THREE.Vector3(1, 1, 1);

  for (const item of items) {
    const key = item.tone;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: TONES[item.tone],
        roughness: FURNITURE_ROUGHNESS[item.tone],
        metalness: FURNITURE_METAL[item.tone] ?? 0,
        vertexColors: true,
      });
      materials.set(key, material);
      disposables.push(material);
    }
    const base = item.base ?? 0;
    const spin = -((item.yaw ?? 0) * Math.PI) / 180;

    /** Pose une boîte, exprimée dans le repère local du meuble. */
    const part = (w: number, h: number, d: number, dx: number, y: number, dz: number) => {
      const geometry = new THREE.BoxGeometry(w, h, d);
      position.set(
        item.x - origin.x + dx * Math.cos(spin) + dz * Math.sin(spin),
        y,
        item.y - origin.y - dx * Math.sin(spin) + dz * Math.cos(spin),
      );
      quaternion.setFromAxisAngle(AXE_Y, spin);
      batch.add(geometry, material!, matrix.compose(position, quaternion, echelle));
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
      const leaf = (front - reveal) / 2;
      // La plinthe est en retrait : c'est le retrait qui se voit, pas la plinthe.
      part(item.w - 0.04, plinth, item.d - 0.04, 0, base + plinth / 2, 0);
      for (const side of [-1, 1]) {
        const shift = (side * (leaf + reveal)) / 2;
        part(
          alongW ? leaf : item.w,
          item.h - plinth,
          alongW ? item.d : leaf,
          alongW ? shift : 0,
          base + plinth + (item.h - plinth) / 2,
          alongW ? 0 : shift,
        );
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
    mesh.position.set(
      door.x - origin.x + Math.cos(angle) * alongWall + out.x * outward,
      lift,
      door.y - origin.y + Math.sin(angle) * alongWall + out.y * outward,
    );
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
  light.position.set(door.x - origin.x + out.x * 0.02, 0.012, door.y - origin.y + out.y * 0.02);
  light.rotation.y = -angle;
  group.add(light);
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
