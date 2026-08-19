'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  exitsFrom,
  pointAt,
  planBounds,
  reachableToward,
  roomCenter,
  roomWalls,
  slideMove,
  wallThickness,
  WALL_FACADE,
  WALL_SKIN,
} from '@/lib/plan';
import type { FloorPlan, PlanDoor, PlanPoint, PlanRoom, Photo } from '@/lib/types';
import { lookTarget, verticalFov } from '@/lib/journey-path';
import { buildInterior, configure } from '@/components/three/interior';
import { adaptQuality } from '@/components/three/quality';
import styles from './PlanViewer.module.css';

/** Hauteur de l'œil au-dessus du sol, en mètres. */
const EYE = 1.6;
/* L'épaisseur des murs vient de `lib/plan.ts` : elle n'est pas la même pour une
   cloison et pour une façade, et c'est le moteur commun qui la pose. */
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
  /** Averti à chaque changement de pièce. Sert à la mesure de l'attention. */
  onRoomChange?: (roomId: string) => void;
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
 *
 * Le volume lui-même est construit par `components/three/interior.ts`, celui de
 * la démonstration. Il ne l'était pas : cette page avait son propre moteur, en
 * Lambert, sans plinthe ni corniche, sans soleil, avec deux couleurs écrites en
 * dur qui ne venaient même pas du nuancier étudié. La démonstration promettait
 * donc ce que le produit livré ne tenait pas — ce qui est le pire endroit où
 * mettre un écart. Ce module garde ce qui lui appartient vraiment : les photos
 * du propriétaire accrochées aux murs, la marche, les repères de passage, la
 * mesure de l'attention.
 */
export function PlanViewer({
  plan,
  doors,
  photos,
  initialRoomId,
  showRoomBar = true,
  onRoomChange,
}: PlanViewerProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const rooms = plan.rooms;
  const [roomId, setRoomId] = useState(() => initialRoomId ?? rooms[0]?.id ?? '');
  const [exits, setExits] = useState<ScreenExit[]>([]);
  const [dragging, setDragging] = useState(false);
  /** Pièce dans laquelle la caméra a déjà été posée. */
  const placedIn = useRef('');

  const room = useMemo(() => rooms.find((r) => r.id === roomId) ?? rooms[0], [rooms, roomId]);

  // On annonce la pièce affichée, la première comprise : sans cet effet, le
  // temps passé dans la pièce d'arrivée ne serait jamais compté.
  useEffect(() => {
    if (room?.id) onRoomChange?.(room.id);
  }, [room?.id, onRoomChange]);

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
    configure(renderer);
    holder.appendChild(renderer.domElement);

    /* La scène vient du moteur commun : mêmes murs, mêmes moulures, même
       soleil que la démonstration. Ce qui suit — la marche, les photos, les
       repères — est ce qui appartient à cette page. */
    const interior = buildInterior({ rooms, doors, renderer });
    const { scene } = interior;
    const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.05, 200);
    /* `walk` porte la marche : `to` est la destination visée par une tape au
       sol, `keys` les touches maintenues. La position réelle reste celle de la
       caméra — c'est elle qui fait foi. */
    const view = { yaw: 0, pitch: -11, fov: DEFAULT_FOV };
    const walk = { to: null as { x: number; y: number } | null, keys: new Set<string>() };
    three.current = { renderer, scene, camera, view, walk, room: null };
    /* La pose initiale se fait ici, avec le contexte qui vient de naître.
       Laissée au seul effet de changement de pièce, elle manquait tout contexte
       recréé — et un contexte est recréé au moindre remontage, ne serait-ce
       qu'en passant de l'onglet « Vidéo » à l'onglet « Plan 3D ». */
    if (room) {
      placedIn.current = room.id;
      placeRef.current(room);
    }



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
    const quality = adaptQuality(renderer, Math.min(window.devicePixelRatio, 2));
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      quality.tick(now);
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
      /* Le champ demandé est un champ vertical, mais ce qu'on veut tenir dans
         l'image c'est une pièce — donc de la largeur. `verticalFov` maintient
         la largeur vue constante quel que soit le format de la scène : elle
         resserre sur un cadre très large, elle ouvre sur un téléphone debout. */
      camera.fov = verticalFov(view.fov, camera.aspect);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      quality.dispose();
      observer.disconnect();
      /* Le bâti appartient au moteur commun, qui sait ce qu'il a alloué. Les
         photos et les repères, eux, sont posés par cette page et défaits par
         leurs propres effets. */
      interior.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
    /*
     * Construit une fois, et une seule.
     *
     * Ce tableau de dépendances a été vide dès l'origine, et le remplir a
     * suffi à casser la visite : l'effet se rejouait, un second contexte
     * naissait, et la caméra du second n'était jamais posée — l'effet de
     * placement, lui, ne se rejouait pas puisque la pièce n'avait pas changé.
     * On se retrouvait au centre du plan, au ras du sol, à regarder le
     * logement par en dessous.
     *
     * Le plan d'une visite publiée ne change pas pendant qu'on la parcourt.
     * S'il devait changer, c'est un remontage du composant qu'il faudrait, pas
     * une reconstruction en place.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        /*
         * Un mètre vingt de large, pas un mètre soixante-dix.
         *
         * La photo du propriétaire est là pour montrer la pièce telle qu'elle
         * est : elle doit être lisible, donc grande. Mais à un mètre soixante-dix
         * elle cesse d'être un cadre accroché et devient une fresque — et, vue
         * depuis le milieu de la pièce, elle occupe la moitié de l'image. Un
         * mètre vingt reste un très grand tirage encadré, et le mur existe
         * encore autour.
         */
        const width = Math.min(1.2, wallLength * 0.5);
        const height = width * ratio;

        const plane = new THREE.PlaneGeometry(width, height);
        /* Non éclairée, et c'est voulu : c'est une photographie, pas une
           surface de la pièce. Éclairée, elle s'assombrirait dans un angle et
           deviendrait illisible — l'inverse de ce qu'elle vient faire. */
        const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: texture }));

        const centre = pointAt(wall, 0.5);
        const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
        /*
         * Le cadre est décollé de la *face* du mur, pas de la ligne du plan.
         *
         * L'ancien moteur centrait les murs sur la ligne du plan et cette page
         * décollait donc d'une demi-épaisseur de cloison. Le moteur commun, lui,
         * fait partir le mur de la ligne vers l'intérieur — et une façade fait
         * trente centimètres, pas neuf. Une photo posée sur un mur de façade se
         * serait retrouvée quinze centimètres dans la maçonnerie.
         *
         * Deux centimètres de dégagement au-delà de la face, sinon les deux
         * surfaces scintillent l'une sur l'autre.
         */
        const inward = angle + Math.PI / 2;
        const offset = wallThickness(host, wall, rooms, WALL_SKIN, WALL_FACADE) + 0.02;
        /* Accrochée à hauteur de regard, comme on accroche : le milieu du cadre
           à un mètre cinquante-cinq du sol, sauf si le tirage est si haut qu'il
           toucherait la plinthe. */
        const height3d = Math.max(height / 2 + 0.2, 1.55);
        mesh.position.set(
          centre.x - origin.x + Math.cos(inward) * offset,
          height3d,
          centre.y - origin.y + Math.sin(inward) * offset,
        );

        /* La baguette du cadre, elle, reçoit la lumière de la pièce : c'est ce
           qui pose la photographie sur le mur au lieu de la laisser flotter
           dessus comme une découpe. */
        const baguette = 0.035;
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(width + baguette * 2, height + baguette * 2, 0.022),
          new THREE.MeshStandardMaterial({ color: 0x2f2a24, roughness: 0.5 }),
        );
        frame.position.set(
          centre.x - origin.x + Math.cos(inward) * (offset - 0.012),
          height3d,
          centre.y - origin.y + Math.sin(inward) * (offset - 0.012),
        );
        frame.rotation.y = -angle;
        frame.castShadow = true;
        frame.receiveShadow = true;
        group.add(frame);

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
          const material = object.material as THREE.Material & { map?: THREE.Texture };
          material.map?.dispose();
          material.dispose();
        }
      });
    };
  }, [photos, rooms, origin]);

  /* ------------------------------------------------------- point de vue --- */

  /**
   * Pose la caméra dans une pièce.
   *
   * Sortie des effets parce que deux endroits en ont besoin : le changement de
   * pièce, et la création du contexte de rendu. Laissée au seul changement de
   * pièce, elle manquait tout contexte recréé — et il l'était au moindre
   * remontage, ne serait-ce qu'en revenant de l'onglet « Vidéo ». Le second
   * contexte gardait alors la caméra à son origine : au centre du plan, au ras
   * du sol, à regarder le logement par en dessous.
   */
  const place = useCallback(
    (target: PlanRoom) => {
      const context = three.current;
      if (!context) return;
      context.room = target;
      context.walk.to = null;
      context.walk.keys.clear();

      const centre = roomCenter(target);
      context.camera.position.set(centre.x - origin.x, EYE, centre.y - origin.y);

      /*
       * On s'oriente vers ce que la pièce a de plus parlant.
       *
       * La décision est celle de la visite guidée, appelée depuis
       * `lib/journey-path.ts` : une photo du propriétaire d'abord — c'est la
       * seule chose qui montre le logement tel qu'il est —, une fenêtre
       * ensuite, et le mur qui *tient dans le cadre* à défaut. Cette page avait
       * sa propre version, restée sur l'ancienne règle du mur le plus long :
       * dans un couloir, le mur le plus long est celui qu'on longe, et l'image
       * devenait un pan de peinture.
       */
      const aim = lookTarget(rooms, doors, photos, target, centre);
      context.view.yaw = (Math.atan2(aim.x - centre.x, -(aim.y - centre.y)) * 180) / Math.PI;
      /* Légère plongée, mais légère : à onze degrés le sol prenait la moitié du
         cadre et la pièce se lisait comme un plancher. Quatre suffisent à ce
         qu'elle se lise comme un volume. */
      context.view.pitch = -4;
    },
    [rooms, doors, photos, origin],
  );

  /** La dernière version de `place`, lisible depuis l'effet de construction,
   *  qui ne se rejoue pas. */
  const placeRef = useRef(place);
  placeRef.current = place;

  useEffect(() => {
    if (!room) return;
    /* La caméra n'est replacée qu'au changement de pièce : sans ce garde-fou,
       le visiteur serait ramené au centre dès qu'il commence à marcher, parce
       que cet effet dépend de tableaux dont l'identité change à chaque rendu du
       parent. */
    if (placedIn.current === room.id) return;
    placedIn.current = room.id;
    place(room);
  }, [room, place]);

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
