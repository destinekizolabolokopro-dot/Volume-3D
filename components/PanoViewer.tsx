'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clampPitch, normalizeYaw, sphericalToVector, vectorToSpherical } from '@/lib/sphere';
import type { Hotspot, Scene } from '@/lib/types';
import styles from './PanoViewer.module.css';

const MIN_FOV = 35;
const MAX_FOV = 100;
const DEFAULT_FOV = 75;
/** Sensibilité de rotation : degrés parcourus par pixel de glissement, à 75° de champ. */
const DRAG_SENSITIVITY = 0.13;

export interface PanoViewerProps {
  scenes: Scene[];
  hotspots: Hotspot[];
  initialSceneId?: string;
  /** Mode édition : un clic dans l'image renvoie la direction visée au lieu de naviguer. */
  picking?: boolean;
  onPick?: (yaw: number, pitch: number) => void;
  /** Notifie l'orientation courante, pour enregistrer la vue de départ d'une pièce. */
  onViewChange?: (yaw: number, pitch: number) => void;
  onSceneChange?: (sceneId: string) => void;
  /** Texte incrusté en filigrane, utilisé par les aperçus simulés. */
  watermark?: string;
  showRoomBar?: boolean;
  showHint?: boolean;
}

interface ScreenHotspot {
  hotspot: Hotspot;
  x: number;
  y: number;
  visible: boolean;
}

export function PanoViewer({
  scenes,
  hotspots,
  initialSceneId,
  picking = false,
  onPick,
  onViewChange,
  onSceneChange,
  watermark,
  showRoomBar = true,
  showHint = true,
}: PanoViewerProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => [...scenes].sort((a, b) => a.position - b.position), [scenes]);
  const [sceneId, setSceneId] = useState(() => initialSceneId ?? ordered[0]?.id ?? '');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fading, setFading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [screenHotspots, setScreenHotspots] = useState<ScreenHotspot[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const current = ordered.find((scene) => scene.id === sceneId) ?? ordered[0] ?? null;
  const currentHotspots = useMemo(
    () => hotspots.filter((hotspot) => hotspot.sceneId === current?.id),
    [hotspots, current?.id],
  );

  // --- refs de rendu : volontairement hors du state React, ils changent à 60 fps ---
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    sphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  } | null>(null);
  const view = useRef({ yaw: 0, pitch: 0, fov: DEFAULT_FOV });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef(0);
  const dragMoved = useRef(0);
  const textureCache = useRef(new Map<string, THREE.Texture>());
  const hotspotsRef = useRef<Hotspot[]>([]);
  const callbacks = useRef({ onViewChange, onPick, picking });

  hotspotsRef.current = currentHotspots;
  callbacks.current = { onViewChange, onPick, picking };

  /* ------------------------------------------------------- initialisation --- */

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setStatus('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    holder.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 100);

    // Sphère retournée vers l'intérieur : le spectateur est au centre.
    const geometry = new THREE.SphereGeometry(50, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x14100d });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    three.current = { renderer, scene, camera, sphere };

    const resize = () => {
      const { clientWidth, clientHeight } = holder;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(holder);

    let frame = 0;
    let lastReport = 0;
    const projected = new THREE.Vector3();

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const { yaw, pitch, fov } = view.current;

      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const target = sphericalToVector(yaw, pitch, 10);
      camera.lookAt(target.x, target.y, target.z);
      renderer.render(scene, camera);

      // Projection des points de passage vers des coordonnées écran, pour les
      // afficher en HTML plutôt qu'en sprites — plus simple à styler et accessible.
      const { clientWidth: w, clientHeight: h } = holder;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);

      const next: ScreenHotspot[] = hotspotsRef.current.map((hotspot) => {
        const position = sphericalToVector(hotspot.yaw, hotspot.pitch, 10);
        projected.set(position.x, position.y, position.z);
        const inFront = projected.clone().normalize().dot(forward) > 0.12;
        projected.project(camera);
        return {
          hotspot,
          x: (projected.x * 0.5 + 0.5) * w,
          y: (-projected.y * 0.5 + 0.5) * h,
          visible: inFront,
        };
      });
      setScreenHotspots(next);

      if (callbacks.current.onViewChange && time - lastReport > 200) {
        lastReport = time;
        callbacks.current.onViewChange(Math.round(yaw), Math.round(pitch));
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      for (const texture of textureCache.current.values()) texture.dispose();
      textureCache.current.clear();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  /* ------------------------------------------------- chargement des images --- */

  useEffect(() => {
    const context = three.current;
    if (!context || !current) return;
    let cancelled = false;

    const apply = (texture: THREE.Texture) => {
      if (cancelled) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      const previous = context.sphere.material.map;
      context.sphere.material.map = texture;
      context.sphere.material.color.set(0xffffff);
      context.sphere.material.needsUpdate = true;
      // La texture précédente reste en cache pour les allers-retours entre pièces.
      if (previous && previous !== texture && !textureCache.current.has(previous.userData.key)) {
        previous.dispose();
      }
      view.current.yaw = current.initialYaw ?? 0;
      view.current.pitch = clampPitch(current.initialPitch ?? 0);
      setStatus('ready');
      setFading(false);
    };

    const cached = textureCache.current.get(current.imageUrl);
    if (cached) {
      apply(cached);
      return () => {
        cancelled = true;
      };
    }

    setStatus('loading');
    new THREE.TextureLoader().load(
      current.imageUrl,
      (texture) => {
        texture.userData.key = current.imageUrl;
        textureCache.current.set(current.imageUrl, texture);
        apply(texture);
      },
      undefined,
      () => {
        if (!cancelled) setStatus('error');
      },
    );

    return () => {
      cancelled = true;
    };
  }, [current]);

  /* ------------------------------------------------------------ contrôles --- */

  const goToScene = useCallback(
    (targetId: string) => {
      if (targetId === sceneId) return;
      setFading(true);
      setScreenHotspots([]);
      // Laisse le fondu au noir se jouer avant de changer de panorama.
      window.setTimeout(() => setSceneId(targetId), 220);
    },
    [sceneId],
  );

  /* Un seul point d'annonce, sur l'état plutôt que sur chaque geste : la pièce
     d'arrivée et les clics du bandeau étaient jusqu'ici muets, alors que la
     navigation par point de passage prévenait. */
  useEffect(() => {
    if (sceneId) onSceneChange?.(sceneId);
  }, [sceneId, onSceneChange]);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    const onPointerDown = (event: PointerEvent) => {
      holder.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      dragMoved.current = 0;
      if (pointers.current.size === 1) setDragging(true);
    };

    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.current.size >= 2) {
        // Pincement à deux doigts : zoom.
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance.current > 0) {
          const ratio = pinchDistance.current / distance;
          view.current.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, view.current.fov * ratio));
        }
        pinchDistance.current = distance;
        return;
      }

      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      dragMoved.current += Math.abs(dx) + Math.abs(dy);
      // La sensibilité suit le champ de vision : zoomé, on tourne plus lentement.
      const speed = (DRAG_SENSITIVITY * view.current.fov) / DEFAULT_FOV;
      view.current.yaw = normalizeYaw(view.current.yaw - dx * speed);
      view.current.pitch = clampPitch(view.current.pitch + dy * speed);
    };

    const endPointer = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinchDistance.current = 0;
      if (pointers.current.size === 0) setDragging(false);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      view.current.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, view.current.fov + event.deltaY * 0.05));
    };

    const onClick = (event: MouseEvent) => {
      // Un glissement n'est pas un clic : seuil de tolérance de quelques pixels.
      if (dragMoved.current > 6) return;
      const context = three.current;
      const { picking: isPicking, onPick: pick } = callbacks.current;
      if (!context || !isPicking || !pick) return;

      const rect = holder.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, context.camera);
      const [hit] = raycaster.intersectObject(context.sphere);
      if (!hit) return;
      const { yaw, pitch } = vectorToSpherical(hit.point);
      pick(Math.round(yaw), Math.round(pitch));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 15 : 5;
      if (event.key === 'ArrowLeft') view.current.yaw = normalizeYaw(view.current.yaw - step);
      else if (event.key === 'ArrowRight') view.current.yaw = normalizeYaw(view.current.yaw + step);
      else if (event.key === 'ArrowUp') view.current.pitch = clampPitch(view.current.pitch + step);
      else if (event.key === 'ArrowDown') view.current.pitch = clampPitch(view.current.pitch - step);
      else return;
      event.preventDefault();
    };

    holder.addEventListener('pointerdown', onPointerDown);
    holder.addEventListener('pointermove', onPointerMove);
    holder.addEventListener('pointerup', endPointer);
    holder.addEventListener('pointercancel', endPointer);
    holder.addEventListener('wheel', onWheel, { passive: false });
    holder.addEventListener('click', onClick);
    holder.addEventListener('keydown', onKeyDown);

    return () => {
      holder.removeEventListener('pointerdown', onPointerDown);
      holder.removeEventListener('pointermove', onPointerMove);
      holder.removeEventListener('pointerup', endPointer);
      holder.removeEventListener('pointercancel', endPointer);
      holder.removeEventListener('wheel', onWheel);
      holder.removeEventListener('click', onClick);
      holder.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  /* ---------------------------------------------------------- plein écran --- */

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen?.().catch(() => undefined);
  }, []);

  /* ----------------------------------------------------------------- vue --- */

  if (ordered.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.overlay}>Aucune pièce n’a encore été ajoutée à cette visite.</div>
      </div>
    );
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <div
        ref={holderRef}
        className={`${styles.canvasHolder} ${dragging ? styles.grabbing : ''} ${picking ? styles.picking : ''}`}
        role="application"
        aria-label={`Visite 360° — ${current?.name ?? ''}. Utilisez les flèches du clavier pour regarder autour de vous.`}
        tabIndex={0}
      />

      {screenHotspots.map(
        ({ hotspot, x, y, visible }) =>
          visible && (
            <button
              key={hotspot.id}
              type="button"
              className={styles.hotspot}
              style={{ left: x, top: y }}
              onClick={() => goToScene(hotspot.targetSceneId)}
              title={`Aller vers ${hotspot.label}`}
            >
              <span className={styles.hotspotRing} aria-hidden="true">
                ↗
              </span>
              <span className={styles.hotspotLabel}>{hotspot.label}</span>
            </button>
          ),
      )}

      <div className={styles.topBar}>
        <div className={styles.sceneName}>{current?.name}</div>
        <button type="button" className={styles.iconBtn} onClick={toggleFullscreen} title="Plein écran" aria-label="Plein écran">
          {isFullscreen ? '⤡' : '⤢'}
        </button>
      </div>

      {watermark && (
        <div className={styles.watermark} aria-hidden="true">
          <div className={styles.watermarkText}>{watermark}</div>
        </div>
      )}

      {showHint && status === 'ready' && <div className={styles.hint}>Faites glisser pour regarder autour de vous</div>}

      {showRoomBar && ordered.length > 1 && (
        <div className={styles.roomBar}>
          {ordered.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={`${styles.roomChip} ${scene.id === current?.id ? styles.roomChipActive : ''}`}
              onClick={() => goToScene(scene.id)}
            >
              {scene.name}
            </button>
          ))}
        </div>
      )}

      <div className={`${styles.fadeMask} ${fading || status === 'loading' ? styles.fadeMaskOn : ''}`} />

      {status === 'loading' && <div className={styles.overlay}>Chargement de la visite…</div>}
      {status === 'error' && (
        <div className={styles.overlay}>
          <strong>Impossible d’afficher cette pièce.</strong>
          <span>L’image du panorama n’a pas pu être chargée.</span>
        </div>
      )}
    </div>
  );
}
