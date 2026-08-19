'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildInterior, configure } from '@/components/three/interior';
import { adaptQuality } from '@/components/three/quality';
import { EYE, verticalFov } from '@/lib/journey-path';
import { reachableAnywhere, roomAt, roomCenter, slideAnywhere, standableAnywhere } from '@/lib/plan';
import type { Massing } from '@/lib/showcase';
import type { PlanDoor, PlanPoint, PlanRoom } from '@/lib/types';
import styles from './FreeTour.module.css';

/**
 * La visite libre : le même logement, conduit par le visiteur.
 *
 * C'est le produit livré. La page d'accueil raconte le logement dans un ordre
 * choisi ; ici on ouvre la porte et on laisse regarder. Les deux vues partagent
 * exactement la même scène (`components/three/interior.ts`), ce qui est le
 * point : ce qu'on montre en démonstration est ce qu'on livre.
 *
 * Deux commandes, parce qu'il y a deux appareils. Sur un ordinateur, on glisse
 * pour regarder et on marche aux touches. Sur un téléphone, il n'y a pas de
 * clavier : on glisse pour regarder, et on **tape le sol** pour s'y rendre. La
 * deuxième est la plus importante des deux — c'est celle que la majorité des
 * voyageurs utilisera.
 */

/** Vitesse de marche, en mètres par seconde. Un pas de promenade. */
const WALK = 1.55;
/** Degrés parcourus par pixel de glissement, ramenés au champ courant. */
const DRAG = 0.13;
const FOV = 74;
/**
 * Recul gardé par rapport au point le plus avancé atteignable, en mètres.
 *
 * On peut **passer** à quarante-cinq centimètres d'une cloison — sinon aucune
 * porte ne se franchit — mais on ne doit pas **s'y arrêter** : à cette distance,
 * l'image n'est plus qu'un aplat. Et c'est le cas le plus courant, parce qu'une
 * tape au milieu bas de l'écran vise le sol bien au-delà du mur d'en face.
 */
const BACK_OFF = 0.55;
const MIN_PITCH = -62;
const MAX_PITCH = 58;

export interface FreeTourProps {
  rooms: PlanRoom[];
  doors: PlanDoor[];
  massing?: Massing[];
  /** Pièce où l'on est déposé. Par défaut, la plus grande. */
  startRoomId?: string;
}

export function FreeTour({ rooms, doors, massing = [], startRoomId }: FreeTourProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState('');
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const resetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return undefined;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return undefined;
    }
    configure(renderer);
    holder.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('role', 'application');
    renderer.domElement.setAttribute(
      'aria-label',
      'Visite en trois dimensions. Flèches ou Z Q S D pour avancer, glisser pour regarder autour.',
    );

    const interior = buildInterior({ rooms, doors, massing, renderer });
    const { scene, origin } = interior;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.04, 300);

    const start = rooms.find((candidate) => candidate.id === startRoomId) ?? rooms[0];
    const home = start ? roomCenter(start) : { x: 0, y: 0 };

    /*
     * On démarre face à l'angle le plus éloigné.
     *
     * Une première version partait cap au nord, ce qui plaçait la caméra en face
     * du mur de façade à deux mètres : sur un téléphone, la fenêtre remplissait
     * tout le cadre et on ne voyait pas la pièce. Regarder vers un angle donne
     * deux murs, la plus grande profondeur disponible, et un volume qui se lit
     * immédiatement — c'est le cadrage que prend n'importe quel photographe
     * d'intérieur, et pour la même raison.
     */
    const corner = (start?.points ?? []).reduce<{ point: PlanPoint; span: number }>(
      (best, point) => {
        const span = Math.hypot(point.x - home.x, point.y - home.y);
        return span > best.span ? { point, span } : best;
      },
      { point: home, span: -1 },
    ).point;
    const opening =
      corner === home ? 0 : (Math.atan2(corner.x - home.x, -(corner.y - home.y)) * 180) / Math.PI;

    const view = { yaw: opening, pitch: -8 };
    const here: PlanPoint = { ...home };
    const held = new Set<string>();
    /** Destination posée par une tape au sol, sur téléphone. */
    let goal: PlanPoint | null = null;
    let announced = '';

    const place = () => {
      here.x = home.x;
      here.y = home.y;
      goal = null;
      held.clear();
      view.yaw = opening;
      view.pitch = -8;
    };
    place();
    resetRef.current = place;

    const resize = () => {
      const { clientWidth, clientHeight } = holder;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.fov = verticalFov(FOV, camera.aspect);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(holder);

    /* ------------------------------------------------------------ regard --- */

    let pointer: { id: number; x: number; y: number; moved: number } | null = null;
    const canvas = renderer.domElement;

    const onDown = (event: PointerEvent) => {
      if (pointer) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
      canvas.setPointerCapture(event.pointerId);
      setDragging(true);
    };
    const onMove = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      const scale = DRAG * (camera.fov / 74);
      view.yaw += dx * scale;
      view.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, view.pitch + dy * scale));
    };
    const onUp = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const tapped = pointer.moved < 6;
      pointer = null;
      setDragging(false);
      if (tapped) aimAt(event);
    };

    /* -------------------------------------------------- tape sur le sol --- */

    const ray = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();

    /**
     * Où l'on va quand on tape.
     *
     * On croise le regard avec le plan du sol : c'est exact, et ça ne demande
     * aucun maillage de collision. Une tape au-delà d'un mur ne renvoie rien de
     * valable — on avance alors aussi loin que le trajet le permet, ce qui est
     * exactement ce qu'on attend en tapant un peu trop loin.
     */
    const aimAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        ),
        camera,
      );
      if (!ray.ray.intersectPlane(floor, hit)) return;
      const aim = { x: hit.x + origin.x, y: hit.z + origin.y };
      const furthest = reachableAnywhere(rooms, doors, here, aim);
      if (!furthest) return;

      // On s'arrête un demi-pas avant le point extrême, sans jamais reculer.
      const dx = furthest.x - here.x;
      const dy = furthest.y - here.y;
      const reach = Math.hypot(dx, dy);
      const kept = Math.max(0, reach - BACK_OFF);
      if (kept < 0.12) return;
      goal = { x: here.x + (dx / reach) * kept, y: here.y + (dy / reach) * kept };
      held.clear();
    };

    /* ------------------------------------------------------------ clavier --- */

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
      const action = KEYS[event.code];
      if (!action) return;
      // Les flèches font défiler la page : tant qu'on marche, elles marchent.
      event.preventDefault();
      held.add(action);
      goal = null;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = KEYS[event.code];
      if (action) held.delete(action);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('keyup', onKeyUp);
    canvas.tabIndex = 0;

    /* -------------------------------------------------------------- pas --- */

    const step = (elapsed: number) => {
      let dx = 0;
      let dy = 0;
      if (held.size > 0) {
        // Le repère suit le regard : « avancer », c'est vers ce qu'on regarde.
        const yaw = (view.yaw * Math.PI) / 180;
        const forward = { x: Math.sin(yaw), y: -Math.cos(yaw) };
        const right = { x: Math.cos(yaw), y: Math.sin(yaw) };
        if (held.has('avant')) (dx += forward.x), (dy += forward.y);
        if (held.has('arriere')) (dx -= forward.x), (dy -= forward.y);
        if (held.has('droite')) (dx += right.x), (dy += right.y);
        if (held.has('gauche')) (dx -= right.x), (dy -= right.y);
      } else if (goal) {
        dx = goal.x - here.x;
        dy = goal.y - here.y;
        if (Math.hypot(dx, dy) < 0.14) goal = null;
      }

      const length = Math.hypot(dx, dy);
      if (length < 0.001) return;
      const distance = WALK * elapsed;
      const wanted = { x: here.x + (dx / length) * distance, y: here.y + (dy / length) * distance };
      const allowed = slideAnywhere(rooms, doors, here, wanted);
      // Bloqué net contre un mur : la destination n'est plus atteignable.
      if (allowed.x === here.x && allowed.y === here.y) goal = null;
      here.x = allowed.x;
      here.y = allowed.y;
    };

    let frame = 0;
    let previous = performance.now();
    const quality = adaptQuality(renderer, Math.min(window.devicePixelRatio, 2));
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      quality.tick(performance.now());
      if (document.hidden) {
        previous = now;
        return;
      }
      const elapsed = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      step(elapsed);

      camera.position.set(here.x - origin.x, EYE, here.y - origin.y);
      const yaw = (view.yaw * Math.PI) / 180;
      const pitch = (view.pitch * Math.PI) / 180;
      camera.lookAt(
        camera.position.x + Math.cos(pitch) * Math.sin(yaw),
        camera.position.y + Math.sin(pitch),
        camera.position.z - Math.cos(pitch) * Math.cos(yaw),
      );
      renderer.render(scene, camera);

      const current = roomAt(rooms, here);
      if (current && current.name !== announced) {
        announced = current.name;
        setRoom(current.name);
      }
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      quality.dispose();
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('keyup', onKeyUp);
      interior.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      resetRef.current = null;
    };
  }, [rooms, doors, massing, startRoomId]);

  if (failed) {
    return (
      <div className={styles.fallback} role="status">
        <p>
          Votre navigateur n’arrive pas à afficher la visite en trois dimensions. Elle demande WebGL,
          que la plupart des navigateurs récents savent faire — vérifiez que l’accélération
          matérielle est activée.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tour}>
      <div
        className={styles.canvas}
        data-dragging={dragging ? '1' : undefined}
        ref={holderRef}
      />
      <div className={styles.hud}>
        <p className={styles.room} aria-live="polite">
          {room || '…'}
        </p>
        <p className={styles.help}>
          <span className={styles.desktop}>Glissez pour regarder · flèches pour avancer</span>
          <span className={styles.touch}>Glissez pour regarder · tapez le sol pour avancer</span>
        </p>
        <button type="button" className={styles.reset} onClick={() => resetRef.current?.()}>
          Revenir au départ
        </button>
      </div>
    </div>
  );
}

/** Vrai si le point de départ tient debout — utile aux appelants qui composent un plan. */
export const canStart = (rooms: PlanRoom[], doors: PlanDoor[], point: PlanPoint): boolean =>
  standableAnywhere(rooms, doors, point);
