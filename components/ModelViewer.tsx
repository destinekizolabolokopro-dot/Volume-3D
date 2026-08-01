'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import styles from './PanoViewer.module.css';

/**
 * Visionneuse de modèle 3D (.glb), pour les logements capturés en
 * photogrammétrie via Polycam ou Luma. Orbite autour du modèle, recadré
 * automatiquement sur sa boîte englobante.
 */
export function ModelViewer({ url, watermark }: { url: string; watermark?: string }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setStatus('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    holder.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14100d);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x40352a, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 6, 4);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    const target = new THREE.Vector3();
    /** Orbite : distance, azimut, élévation. */
    const orbit = { radius: 4, yaw: 0.6, pitch: 0.3 };
    let disposed = false;

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

    new GLTFLoader().load(
      url,
      (gltf) => {
        if (disposed) return;
        scene.add(gltf.scene);
        // Recentre le modèle et règle la distance de caméra sur sa taille réelle.
        const box = new THREE.Box3().setFromObject(gltf.scene);
        box.getCenter(target);
        const size = box.getSize(new THREE.Vector3()).length();
        orbit.radius = Math.max(size * 0.9, 0.5);
        camera.far = Math.max(size * 12, 100);
        camera.updateProjectionMatrix();
        setStatus('ready');
      },
      (event) => {
        if (event.total > 0) setProgress(Math.round((event.loaded / event.total) * 100));
      },
      () => {
        if (!disposed) setStatus('error');
      },
    );

    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;

    const onPointerDown = (event: PointerEvent) => {
      holder.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) orbit.radius = Math.max(0.3, orbit.radius * (pinch / distance));
        pinch = distance;
        return;
      }
      orbit.yaw -= (event.clientX - previous.x) * 0.006;
      orbit.pitch = Math.max(-1.4, Math.min(1.4, orbit.pitch + (event.clientY - previous.y) * 0.006));
    };
    const endPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbit.radius = Math.max(0.3, orbit.radius * (1 + event.deltaY * 0.001));
    };

    holder.addEventListener('pointerdown', onPointerDown);
    holder.addEventListener('pointermove', onPointerMove);
    holder.addEventListener('pointerup', endPointer);
    holder.addEventListener('pointercancel', endPointer);
    holder.addEventListener('wheel', onWheel, { passive: false });

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const cosPitch = Math.cos(orbit.pitch);
      camera.position.set(
        target.x + orbit.radius * cosPitch * Math.sin(orbit.yaw),
        target.y + orbit.radius * Math.sin(orbit.pitch),
        target.z + orbit.radius * cosPitch * Math.cos(orbit.yaw),
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      holder.removeEventListener('pointerdown', onPointerDown);
      holder.removeEventListener('pointermove', onPointerMove);
      holder.removeEventListener('pointerup', endPointer);
      holder.removeEventListener('pointercancel', endPointer);
      holder.removeEventListener('wheel', onWheel);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);

  return (
    <div className={styles.root} ref={rootRef}>
      <div ref={holderRef} className={styles.canvasHolder} role="application" aria-label="Modèle 3D du logement" />
      {watermark && (
        <div className={styles.watermark} aria-hidden="true">
          <div className={styles.watermarkText}>{watermark}</div>
        </div>
      )}
      {status === 'loading' && (
        <div className={styles.overlay}>Chargement du modèle 3D… {progress > 0 ? `${progress}%` : ''}</div>
      )}
      {status === 'error' && (
        <div className={styles.overlay}>
          <strong>Impossible d’afficher ce modèle.</strong>
          <span>Le fichier .glb n’a pas pu être chargé.</span>
        </div>
      )}
    </div>
  );
}
