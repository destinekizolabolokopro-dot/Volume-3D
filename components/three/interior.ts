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
import { containsPoint, distance, planBounds, pointAt, projectOnWall, roomCenter, roomWalls, solidSpans, type Interval } from '@/lib/plan';
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

/** Épaisseur d'une paroi intérieure, en mètres. Deux pièces mitoyennes en ont chacune une. */
const SKIN = 0.09;
/** Un mur de façade parisien est épais, et son embrasure se voit. */
const FACADE = 0.3;
/** Hauteur des plinthes. Un détail minuscule qui fait « pièce » plutôt que « boîte ». */
const SKIRTING = 0.09;

/*
 * Les teintes du mobilier.
 *
 * Volontairement sourdes et proches les unes des autres. Première version :
 * un bois franchement orangé à côté d'un gris presque noir — chaque meuble
 * criait pour son compte et l'ensemble ressemblait à un jeu de cubes. Un
 * intérieur réel tient dans une plage étroite, et c'est la lumière qui fait
 * les écarts, pas la peinture.
 */
const TONES: Record<Massing['tone'], number> = {
  bois: 0x8e7860,
  tissu: 0xaba393,
  clair: 0xdcd7cd,
  sombre: 0x635a4e,
  accent: 0x2f6f66,
  tapis: 0x8b8271,
};

export interface InteriorOptions {
  rooms: PlanRoom[];
  doors: PlanDoor[];
  massing?: Massing[];
  /** Renseignée pour que la scène porte un palier et une porte qui s'ouvre. */
  entrance?: Entrance | null;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x101614, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/** Monte la scène complète. Un seul appel, un seul `dispose`. */
export function buildInterior({ rooms, doors, massing = [], entrance = null }: InteriorOptions): Interior {
  const box = planBounds(rooms);
  const origin = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const bin: Bin[] = [];

  const scene = new THREE.Scene();
  scene.add(sky(bin));
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
  scene.add(new THREE.HemisphereLight(0xfff4e4, 0xbfb7aa, 1.15));
  scene.add(new THREE.AmbientLight(0xfff8ef, 0.35));

  const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
  sun.position.set(-4, 7, -11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
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
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const bounce = new THREE.DirectionalLight(0xd8e4f2, 0.45);
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
  const material = new THREE.MeshLambertMaterial({ color: 0x6b675e });
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
  const stone = new THREE.MeshLambertMaterial({ color: 0xb2a898 });
  // Plus loin, plus clair : c'est ce que fait l'atmosphère, et c'est ce qui
  // donne la profondeur sans coûter un seul calcul de plus.
  const far = new THREE.MeshLambertMaterial({ color: 0xc6bfb2 });
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
    for (const [reach, tall, lift, tone] of [
      [19, 11, -1.5, stone],
      [29, 16, -0.5, far],
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

  const wall = new THREE.MeshLambertMaterial({ color: 0xe6e1d6 });
  const skirting = new THREE.MeshLambertMaterial({ color: 0xf2eee6 });
  const parquet = new THREE.MeshLambertMaterial({ color: 0xbd9569 });
  const carrelage = new THREE.MeshLambertMaterial({ color: 0xc6c2b9 });
  const ceiling = new THREE.MeshLambertMaterial({ color: 0xf4f1ea, side: THREE.DoubleSide });
  disposables.push(wall, skirting, parquet, carrelage, ceiling);

  const toLocal = (p: PlanPoint) => new THREE.Vector2(p.x - origin.x, p.y - origin.y);

  for (const room of rooms) {
    const shape = new THREE.Shape(room.points.map(toLocal));
    const slab = new THREE.ShapeGeometry(shape);
    slab.rotateX(Math.PI / 2);
    disposables.push(slab);
    const floor = new THREE.Mesh(slab, /eau|bain|wc/i.test(room.id + room.name) ? carrelage : parquet);
    floor.receiveShadow = true;
    group.add(floor);

    const top = slab.clone();
    disposables.push(top);
    const lid = new THREE.Mesh(top, ceiling);
    lid.position.y = room.height;
    group.add(lid);

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

      /* Un mur qui n'a aucune pièce de l'autre côté est une façade : on lui
         donne son épaisseur réelle, et les embrasures deviennent profondes. */
      const middle = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
      const outside = { x: middle.x - normal.x * 0.2, y: middle.y - normal.y * 0.2 };
      const facade = !rooms.some((other) => other.id !== room.id && containsPoint(other, outside));
      const thickness = facade ? FACADE : SKIN;

      const panel = (from: number, to: number, bottom: number, height: number, material: THREE.Material, depth = thickness) => {
        const width = (to - from) * length;
        if (width < 0.008 || height < 0.008) return;
        const centre = pointAt(segment, (from + to) / 2);
        const geometry = new THREE.BoxGeometry(width, height, depth);
        disposables.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          centre.x - origin.x + normal.x * (depth / 2),
          bottom + height / 2,
          centre.y - origin.y + normal.y * (depth / 2),
        );
        mesh.rotation.y = -angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      };

      for (const span of solidSpans(openings)) {
        panel(span.from, span.to, 0, room.height, wall);
        // La plinthe déborde légèrement de la peau du mur, sinon elle ne se
        // détache pas et ne sert à rien.
        panel(span.from, span.to, 0, SKIRTING, skirting, thickness + 0.018);
      }
      for (const { span, door } of framed) {
        if (door.sill > 0.01) panel(span.from, span.to, 0, door.sill, wall);
        if (door.height < room.height) {
          panel(span.from, span.to, door.height, room.height - door.height, wall);
        }
      }
    }
  }
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

  for (const item of items) {
    const key = item.tone;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color: TONES[item.tone] });
      materials.set(key, material);
      disposables.push(material);
    }
    const base = item.base ?? 0;
    const spin = -((item.yaw ?? 0) * Math.PI) / 180;

    /** Pose une boîte, exprimée dans le repère local du meuble. */
    const part = (w: number, h: number, d: number, dx: number, y: number, dz: number) => {
      const geometry = new THREE.BoxGeometry(w, h, d);
      disposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        item.x - origin.x + dx * Math.cos(spin) + dz * Math.sin(spin),
        y,
        item.y - origin.y - dx * Math.sin(spin) + dz * Math.cos(spin),
      );
      mesh.rotation.y = spin;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
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
    } else {
      part(item.w, item.h, item.d, 0, base + item.h / 2, 0);
    }

    /* L'ombre de contact est le détail qui pose un meuble au sol. Sans elle, un
       volume mat sur un sol mat flotte, et l'œil le voit tout de suite même
       s'il ne sait pas dire pourquoi. */
    if (item.tone === 'tapis' || base > 0.4) continue;
    const patch = new THREE.PlaneGeometry(item.w * 1.7, item.d * 1.7);
    disposables.push(patch);
    const mark = new THREE.Mesh(patch, shadow);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = -((item.yaw ?? 0) * Math.PI) / 180;
    mark.position.set(item.x - origin.x, base + 0.004, item.y - origin.y);
    group.add(mark);
  }
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
  const stone = new THREE.MeshLambertMaterial({ color: 0x8f8577 });
  const tiling = new THREE.MeshLambertMaterial({ color: 0x655d53 });
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
  const outside = new THREE.MeshLambertMaterial({ color: 0x33413b });
  const inside = new THREE.MeshLambertMaterial({ color: 0xded8ca });
  const edge = new THREE.MeshLambertMaterial({ color: 0xc7c0b2 });
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
  const brass = new THREE.MeshLambertMaterial({ color: 0xb08d4a });
  disposables.push(knob, brass);
  const handle = new THREE.Mesh(knob, brass);
  handle.position.set(width - 0.14, 1.05, plusZIsInside ? -0.045 : 0.045);
  handle.castShadow = true;
  group.add(handle);

  // Deux panneaux moulurés, à peine en relief : ce qui distingue une porte
  // d'immeuble d'une plaque de contreplaqué.
  const moulding = new THREE.MeshLambertMaterial({ color: 0x2b3833 });
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
