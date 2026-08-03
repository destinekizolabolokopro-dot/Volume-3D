'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  exitsFrom,
  pointAt,
  planBounds,
  projectOnWall,
  reachableToward,
  roomCenter,
  roomWalls,
  slideMove,
  solidSpans,
  type Interval,
} from '@/lib/plan';
import type { FloorPlan, PlanDoor, PlanPoint, PlanRoom, Photo } from '@/lib/types';
import styles from './PlanViewer.module.css';

/** Hauteur de l'œil au-dessus du sol, en mètres. */
const EYE = 1.6;
/** Épaisseur des cloisons, en mètres. */
const WALL_THICKNESS = 0.09;
const MIN_FOV = 45;
const MAX_FOV = 95;
const DEFAULT_FOV = 72;
/** Degrés parcourus par pixel de glissement, à 72° de champ. */
const DRAG_SENSITIVITY = 0.13;
/** Vitesse de marche, en mètres par seconde. Un pas de promenade, pas une course. */
const WALK_SPEED = 1.5;

export interface PlanViewerProps {
  plan: FloorPlan;
  doors: PlanDoor[];
  photos: Photo[];
  initialRoomId?: string;
  showRoomBar?: boolean;
}

interface ScreenExit {
  targetId: string;
  targetName: string;
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Visite d'un logement reconstruit à partir de son plan.
 *
 * Le volume vient du plan — des dimensions relevées, pas devinées — et les
 * photos du propriétaire sont accrochées sur les murs qu'elles montrent. Rien
 * n'est inventé : ce que le visiteur mesure du regard correspond au logement.
 *
 * C'est la seule façon de produire une visite parcourable sans capture 360°
 * sur place. Ce n'est pas une photo à 360°, et la page de visite le dit.
 */
export function PlanViewer({ plan, doors, photos, initialRoomId, showRoomBar = true }: PlanViewerProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const rooms = plan.rooms;
  const [roomId, setRoomId] = useState(() => initialRoomId ?? rooms[0]?.id ?? '');
  const [exits, setExits] = useState<ScreenExit[]>([]);
  const [dragging, setDragging] = useState(false);
  /** Pièce dans laquelle la caméra a déjà été posée. */
  const placedIn = useRef('');

  const room = useMemo(() => rooms.find((r) => r.id === roomId) ?? rooms[0], [rooms, roomId]);

  /* Le repère du plan est recentré une fois pour toutes : les coordonnées 3D
     restent petites, ce qui évite les pertes de précision loin de l'origine. */
  const origin = useMemo(() => {
    const box = planBounds(rooms);
    return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  }, [rooms]);

  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    view: { yaw: number; pitch: number; fov: number };
    walk: { to: { x: number; y: number } | null; keys: Set<string> };
    /** Pièce courante, relue par la boucle de rendu pour borner la marche. */
    room: PlanRoom | null;
  } | null>(null);

  /* ------------------------------------------------------------ la scène --- */

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    holder.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1418);
    const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.05, 200);
    /* `walk` porte la marche : `to` est la destination visée par une tape au
       sol, `keys` les touches maintenues. La position réelle reste celle de la
       caméra — c'est elle qui fait foi. */
    const view = { yaw: 0, pitch: -11, fov: DEFAULT_FOV };
    const walk = { to: null as { x: number; y: number } | null, keys: new Set<string>() };
    three.current = { renderer, scene, camera, view, walk, room: null };

    // Lumière douce et sans direction marquée : on éclaire pour lire le volume,
    // pas pour simuler un ensoleillement qu'on ne connaît pas.
    // Le ciel éclaire par le haut, le sol renvoie par le bas ; l'ambiante
    // relève les murs, dont la normale est horizontale et qui, sans elle,
    // restent à mi-chemin entre les deux et paraissent gris.
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0xcfc8bd, 2.2));
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e2, 0.75);
    key.position.set(6, 9, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8f5, 0.35);
    fill.position.set(-5, 4, -4);
    scene.add(fill);

    /* Dôme de ciel, très au large du bâti. Sans lui, une fenêtre s'ouvre sur le
       fond de la scène — un trou noir, exactement l'inverse de l'effet voulu :
       ce qu'on veut montrer d'un logement, c'est qu'il est clair. */
    const skyGeometry = new THREE.SphereGeometry(120, 32, 16);
    skyGeometry.scale(-1, 1, 1);
    const sky = new THREE.Mesh(
      skyGeometry,
      new THREE.ShaderMaterial({
        uniforms: {
          haut: { value: new THREE.Color(0x8fb6e8) },
          bas: { value: new THREE.Color(0xeef2f6) },
        },
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
          void main() {
            gl_FragColor = vec4(mix(bas, haut, smoothstep(-0.1, 0.55, h)), 1.0);
          }
        `,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    );
    sky.renderOrder = -1;
    scene.add(sky);

    const resize = () => {
      const { clientWidth, clientHeight } = holder;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(holder);

    /**
     * Avance d'un pas, en restant dans la pièce.
     *
     * Deux commandes cohabitent : les touches, pour l'ordinateur, et la
     * destination posée par une tape au sol, pour le téléphone — c'est là que
     * le clavier n'existe pas. La position est bornée par `slideMove`, donc on
     * longe les murs au lieu de les traverser.
     */
    const step = (elapsed: number) => {
      const current = three.current?.room;
      if (!current) return;
      const here = { x: camera.position.x + origin.x, y: camera.position.z + origin.y };

      let direction = { x: 0, y: 0 };
      if (walk.keys.size > 0) {
        // Le repère de marche suit le regard : « avancer » veut dire « vers ce
        // que je regarde », pas « vers le nord du plan ».
        const yaw = view.yaw * (Math.PI / 180);
        const forward = { x: Math.sin(yaw), y: -Math.cos(yaw) };
        const right = { x: Math.cos(yaw), y: Math.sin(yaw) };
        if (walk.keys.has('avant')) direction = { x: direction.x + forward.x, y: direction.y + forward.y };
        if (walk.keys.has('arriere')) direction = { x: direction.x - forward.x, y: direction.y - forward.y };
        if (walk.keys.has('droite')) direction = { x: direction.x + right.x, y: direction.y + right.y };
        if (walk.keys.has('gauche')) direction = { x: direction.x - right.x, y: direction.y - right.y };
        walk.to = null;
      } else if (walk.to) {
        const dx = walk.to.x - here.x;
        const dy = walk.to.y - here.y;
        const remaining = Math.hypot(dx, dy);
        // Arrivé : on relâche la destination pour ne pas osciller autour.
        if (remaining < 0.12) walk.to = null;
        else direction = { x: dx / remaining, y: dy / remaining };
      }

      const length = Math.hypot(direction.x, direction.y);
      if (length < 0.001) return;

      const distance = WALK_SPEED * elapsed;
      const target = {
        x: here.x + (direction.x / length) * distance,
        y: here.y + (direction.y / length) * distance,
      };
      const allowed = slideMove(current, here, target);
      camera.position.x = allowed.x - origin.x;
      camera.position.z = allowed.y - origin.y;
    };

    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) {
        previous = now;
        return;
      }
      // Le pas dépend du temps écoulé, jamais du nombre d'images : la vitesse
      // de marche doit être la même sur un téléphone à 30 img/s et un écran
      // à 120 Hz.
      const elapsed = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      step(elapsed);

      const yaw = view.yaw * (Math.PI / 180);
      const pitch = view.pitch * (Math.PI / 180);
      camera.lookAt(
        camera.position.x + Math.cos(pitch) * Math.sin(yaw),
        camera.position.y + Math.sin(pitch),
        camera.position.z - Math.cos(pitch) * Math.cos(yaw),
      );
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material as THREE.Material & { map?: THREE.Texture };
          material.map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  /* ------------------------------------------------- construction du bâti --- */

  useEffect(() => {
    const context = three.current;
    if (!context) return;
    const { scene } = context;

    const built = new THREE.Group();
    built.name = 'bati';
    const toWorld = (p: PlanPoint) => new THREE.Vector2(p.x - origin.x, p.y - origin.y);

    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xf2efe9 });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xc0a37f });
    // Vu de dessous depuis l'intérieur, vu de dessus depuis les pièces voisines
    // quand le regard passe par une porte : les deux faces doivent exister.
    const ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0xfbfbfa, side: THREE.DoubleSide });

    for (const current of rooms) {
      /* --------------------------------------------------- sol et plafond --- */
      const shape = new THREE.Shape(current.points.map(toWorld));
      const slab = new THREE.ShapeGeometry(shape);
      slab.rotateX(Math.PI / 2);

      const floor = new THREE.Mesh(slab, floorMaterial);
      built.add(floor);

      const ceiling = new THREE.Mesh(slab.clone(), ceilingMaterial);
      ceiling.position.y = current.height;
      built.add(ceiling);

      /* ------------------------------------------------------------ murs --- */
      for (const wall of roomWalls(current)) {
        // Toutes les ouvertures qui tombent sur ce mur, quelle que soit la
        // pièce qui les déclare : une porte est partagée par deux pièces.
        const openings: { span: Interval; door: PlanDoor }[] = [];
        for (const door of doors) {
          const span = projectOnWall(wall, { a: door.a, b: door.b });
          if (span) openings.push({ span, door });
        }

        const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
        const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);

        /** Pose un pan de mur entre deux fractions du mur, à une hauteur donnée. */
        const addPanel = (from: number, to: number, bottom: number, top: number) => {
          const width = (to - from) * length;
          const height = top - bottom;
          if (width < 0.01 || height < 0.01) return;
          const centre = pointAt(wall, (from + to) / 2);
          const box = new THREE.BoxGeometry(width, height, WALL_THICKNESS);
          const panel = new THREE.Mesh(box, wallMaterial);
          panel.position.set(centre.x - origin.x, bottom + height / 2, centre.y - origin.y);
          panel.rotation.y = -angle;
          built.add(panel);
        };

        // Les pleins entre les ouvertures, sur toute la hauteur.
        for (const span of solidSpans(openings.map((entry) => entry.span))) {
          addPanel(span.from, span.to, 0, current.height);
        }
        // Puis, au-dessus et au-dessous de chaque ouverture, l'allège et le linteau.
        for (const { span, door } of openings) {
          if (door.sill > 0.01) addPanel(span.from, span.to, 0, door.sill);
          if (door.height < current.height) addPanel(span.from, span.to, door.height, current.height);
        }
      }
    }

    scene.add(built);
    return () => {
      scene.remove(built);
      built.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      wallMaterial.dispose();
      floorMaterial.dispose();
      ceilingMaterial.dispose();
    };
  }, [rooms, doors, origin]);

  /* ------------------------------------------------ photos sur les murs --- */

  useEffect(() => {
    const context = three.current;
    if (!context) return;
    const { scene } = context;

    const group = new THREE.Group();
    group.name = 'photos';
    scene.add(group);
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    for (const photo of photos) {
      const host = rooms.find((r) => r.id === photo.roomId);
      if (!host) continue;
      const walls = roomWalls(host);
      const wall = walls[photo.wallIndex % walls.length];
      if (!wall) continue;

      loader.load(photo.url, (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        const ratio = texture.image.height / texture.image.width || 0.66;

        const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
        // Le cadre occupe au plus les deux tiers du mur, et jamais plus de 1,7 m :
        // au-delà, une photo posée sur un mur cesse d'être lisible comme telle.
        const width = Math.min(1.7, wallLength * 0.66);
        const height = width * ratio;

        const plane = new THREE.PlaneGeometry(width, height);
        const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: texture }));

        const centre = pointAt(wall, 0.5);
        const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
        // Décollé du mur de deux centimètres, sinon les deux surfaces
        // scintillent l'une sur l'autre.
        const inward = angle + Math.PI / 2;
        const offset = WALL_THICKNESS / 2 + 0.02;
        mesh.position.set(
          centre.x - origin.x + Math.cos(inward) * offset,
          Math.max(height / 2 + 0.2, 1.55),
          centre.y - origin.y + Math.sin(inward) * offset,
        );
        /* Une rotation de θ autour de Y envoie la normale du plan (+Z local)
           sur (sin θ, 0, cos θ). On la veut sur la normale intérieure du mur,
           soit (−sin a, 0, cos a) : d'où θ = −a. */
        mesh.rotation.y = -angle;
        group.add(mesh);
      });
    }

    return () => {
      cancelled = true;
      scene.remove(group);
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material as THREE.MeshBasicMaterial;
          material.map?.dispose();
          material.dispose();
        }
      });
    };
  }, [photos, rooms, origin]);

  /* ------------------------------------------------------- point de vue --- */

  useEffect(() => {
    const context = three.current;
    if (!context || !room) return;
    context.room = room;
    /* La caméra n'est replacée qu'au changement de pièce. Cet effet dépend
       aussi des ouvertures et des photos — deux tableaux dont l'identité change
       à chaque rendu du parent — et sans ce garde-fou, le visiteur serait
       ramené au centre de la pièce dès qu'il commence à marcher. */
    if (placedIn.current === room.id) return;
    placedIn.current = room.id;

    context.walk.to = null;
    context.walk.keys.clear();
    const centre = roomCenter(room);
    context.camera.position.set(centre.x - origin.x, EYE, centre.y - origin.y);

    /* On s'oriente vers ce que la pièce a de plus parlant : une photo du
       propriétaire d'abord — c'est la seule chose qui montre le logement tel
       qu'il est —, une fenêtre ensuite, le mur le plus long à défaut. */
    const walls = roomWalls(room);
    const score = (index: number) => {
      const wall = walls[index];
      const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
      const hasWindow = doors.some(
        (door) => door.kind === 'window' && projectOnWall(wall, { a: door.a, b: door.b }),
      );
      const hasPhoto = photos.some((photo) => photo.roomId === room.id && photo.wallIndex % walls.length === index);
      return length + (hasPhoto ? 120 : 0) + (hasWindow ? 60 : 0);
    };
    let best = 0;
    for (let i = 1; i < walls.length; i += 1) if (score(i) > score(best)) best = i;
    const target = pointAt(walls[best], 0.5);
    context.view.yaw = (Math.atan2(target.x - centre.x, -(target.y - centre.y)) * 180) / Math.PI;
    // Légère plongée : le sol entre dans le cadre, et la pièce se lit comme
    // un volume au lieu d'un pan de mur.
    context.view.pitch = -11;
  }, [room, origin, doors, photos]);

  /* ------------------------------------ projection des passages à l'écran --- */

  const refreshExits = useCallback(() => {
    const context = three.current;
    const holder = holderRef.current;
    if (!context || !holder || !room) return;

    const { camera } = context;
    const width = holder.clientWidth;
    const height = holder.clientHeight;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const next: ScreenExit[] = [];
    for (const { door, targetId } of exitsFrom(room.id, doors)) {
      const target = rooms.find((r) => r.id === targetId);
      if (!target) continue;

      const middle = { x: (door.a.x + door.b.x) / 2, y: (door.a.y + door.b.y) / 2 };
      const world = new THREE.Vector3(middle.x - origin.x, 1.15, middle.y - origin.y);
      const toDoor = world.clone().sub(camera.position);
      // Derrière la caméra : le repère ne doit pas apparaître, la projection
      // le renverrait du mauvais côté de l'écran.
      const ahead = toDoor.dot(forward) > 0;

      const projected = world.clone().project(camera);
      next.push({
        targetId,
        targetName: target.name,
        x: ((projected.x + 1) / 2) * width,
        y: ((1 - projected.y) / 2) * height,
        visible: ahead && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1,
      });
    }
    setExits(next);
  }, [room, doors, rooms, origin]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      refreshExits();
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [refreshExits]);

  /* --------------------------------------------------------- commandes --- */

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const pointers = new Map<number, { x: number; y: number }>();

    /* Une tape courte pose une destination, un glissement fait tourner la tête.
       On distingue les deux à la levée du doigt, sur la distance parcourue :
       c'est le geste attendu sur téléphone, où il n'y a pas de clavier. */
    let pressedAt = { x: 0, y: 0, time: 0 };

    const onDown = (event: PointerEvent) => {
      holder.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pressedAt = { x: event.clientX, y: event.clientY, time: performance.now() };
      setDragging(true);
    };
    const onMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      const context = three.current;
      if (!previous || !context) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const scale = context.view.fov / DEFAULT_FOV;
      context.view.yaw -= (event.clientX - previous.x) * DRAG_SENSITIVITY * scale;
      context.view.pitch = Math.max(
        -70,
        Math.min(70, context.view.pitch + (event.clientY - previous.y) * DRAG_SENSITIVITY * scale),
      );
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) setDragging(false);

      const travelled = Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y);
      const held = performance.now() - pressedAt.time;
      if (travelled > 8 || held > 500) return;

      const context = three.current;
      const current = context?.room;
      if (!context || !current) return;

      // Où le doigt a-t-il touché le sol ? On lance un rayon depuis la caméra
      // et on cherche son intersection avec le plan du sol.
      const box = holder.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        -((event.clientY - box.top) / box.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, context.camera);
      const ground = new THREE.Vector3();
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ground)) return;

      const target = { x: ground.x + origin.x, y: ground.z + origin.y };
      const here = {
        x: context.camera.position.x + origin.x,
        y: context.camera.position.z + origin.y,
      };
      // Une tape tombe souvent derrière un mur : on avance alors aussi loin
      // que possible dans cette direction, au lieu de ne rien faire.
      context.walk.to = reachableToward(current, here, target);
    };

    /* Clavier : flèches et ZQSD / WASD, pour l'ordinateur. */
    const KEYS: Record<string, string> = {
      ArrowUp: 'avant',
      ArrowDown: 'arriere',
      ArrowLeft: 'gauche',
      ArrowRight: 'droite',
      KeyW: 'avant',
      KeyZ: 'avant',
      KeyS: 'arriere',
      KeyA: 'gauche',
      KeyQ: 'gauche',
      KeyD: 'droite',
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const move = KEYS[event.code];
      if (!move || !three.current) return;
      event.preventDefault();
      three.current.walk.keys.add(move);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const move = KEYS[event.code];
      if (move) three.current?.walk.keys.delete(move);
    };
    const onWheel = (event: WheelEvent) => {
      const context = three.current;
      if (!context) return;
      event.preventDefault();
      context.view.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, context.view.fov + Math.sign(event.deltaY) * 3));
    };

    holder.addEventListener('pointerdown', onDown);
    holder.addEventListener('pointermove', onMove);
    holder.addEventListener('pointerup', onUp);
    holder.addEventListener('pointercancel', onUp);
    holder.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      holder.removeEventListener('pointerdown', onDown);
      holder.removeEventListener('pointermove', onMove);
      holder.removeEventListener('pointerup', onUp);
      holder.removeEventListener('pointercancel', onUp);
      holder.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [origin]);

  if (!room) return <div className={styles.empty}>Ce plan ne contient aucune pièce.</div>;

  return (
    <div ref={rootRef} className={styles.root}>
      <div
        ref={holderRef}
        className={`${styles.canvas} ${dragging ? styles.grabbing : ''}`.trim()}
        role="application"
        aria-label={`Vue du logement depuis : ${room.name}`}
      />

      {exits.map((exit) =>
        exit.visible ? (
          <button
            key={exit.targetId}
            type="button"
            className={styles.exit}
            style={{ left: exit.x, top: exit.y }}
            title={`Aller dans : ${exit.targetName}`}
            onClick={() => setRoomId(exit.targetId)}
          >
            <span className={styles.exitRing} aria-hidden="true">
              ↗
            </span>
            <span className={styles.exitLabel}>{exit.targetName}</span>
          </button>
        ) : null,
      )}

      <div className={styles.topBar}>
        <span className={styles.roomName}>{room.name}</span>
      </div>

      <p className={styles.hint}>Touchez le sol pour avancer · glissez pour regarder</p>

      {showRoomBar && rooms.length > 1 ? (
        <div className={styles.roomBar}>
          {rooms.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`${styles.roomChip} ${entry.id === room.id ? styles.roomChipActive : ''}`.trim()}
              aria-current={entry.id === room.id}
              onClick={() => setRoomId(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Pièces du plan, dans l'ordre d'affichage du sélecteur. */
export type { PlanRoom };
