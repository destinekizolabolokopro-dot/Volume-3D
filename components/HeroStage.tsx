'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clampPitch, normalizeYaw, sphericalToVector } from '@/lib/sphere';
import styles from './HeroStage.module.css';

/**
 * Le héros de la page d'accueil n'est pas l'image d'une visite : c'en est une.
 *
 * Le panorama dérive lentement, comme une caméra sur rail, et le visiteur peut
 * le saisir. C'est l'argument du service, démontré avant d'être expliqué — et
 * cela évite d'avoir deux contextes WebGL sur la même page.
 *
 * `imageUrl` pointe vers le panorama d'un logement publié. Sans logement en
 * ligne, une scène est dessinée par le navigateur : abstraite et assumée comme
 * telle, plutôt qu'une fausse photo.
 */
export function HeroStage({ imageUrl }: { imageUrl?: string }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Construit la scène et rend la fonction de démontage.
   *
   * `useCallback` la fige : l'effet ci-dessous ne se rejoue que si le panorama
   * change, jamais parce que le composant s'est simplement redessiné.
   */
  const mount = useCallback(
    (holder: HTMLDivElement) => {
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'low-power',
        });
      } catch {
        setFailed(true);
        return () => {};
      }
      // Au-delà de 1,75 le gain est invisible sur un fond flouté par le voile,
      // mais le coût de remplissage, lui, croît au carré.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      holder.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 100);
      const geometry = new THREE.SphereGeometry(50, 64, 40);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0x1a1613 });
      scene.add(new THREE.Mesh(geometry, material));

      const view = { yaw: 0, pitch: -3 };
      const drift = { speed: 0.0075, paused: 0 };
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* ------------------------------------------------------ dimensions --- */
      const resize = () => {
        const { clientWidth, clientHeight } = holder;
        if (!clientWidth || !clientHeight) return;
        renderer.setSize(clientWidth, clientHeight, false);
        camera.aspect = clientWidth / clientHeight;
        // Sur un écran étroit, un champ plus large évite l'effet « longue-vue ».
        camera.fov = clientWidth < 760 ? 86 : 72;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(holder);

      /* --------------------------------------------------------- texture --- */
      const apply = (source: HTMLImageElement | HTMLCanvasElement) => {
        const texture = new THREE.Texture(source);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        setReady(true);
      };

      if (imageUrl) {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => apply(image);
        image.onerror = () => apply(drawScene());
        image.src = imageUrl;
      } else {
        apply(drawScene());
      }

      /* -------------------------------------------------------- contrôle --- */
      const pointers = new Map<number, { x: number; y: number }>();

      const onDown = (event: PointerEvent) => {
        holder.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        holder.dataset.grabbing = '1';
      };
      const onMove = (event: PointerEvent) => {
        const previous = pointers.get(event.pointerId);
        if (!previous) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        view.yaw = normalizeYaw(view.yaw - (event.clientX - previous.x) * 0.12);
        view.pitch = clampPitch(view.pitch + (event.clientY - previous.y) * 0.12);
        // La dérive reprend la main quelques secondes après le dernier geste.
        drift.paused = performance.now() + 3200;
      };
      const onUp = (event: PointerEvent) => {
        pointers.delete(event.pointerId);
        if (pointers.size === 0) delete holder.dataset.grabbing;
      };

      holder.addEventListener('pointerdown', onDown);
      holder.addEventListener('pointermove', onMove);
      holder.addEventListener('pointerup', onUp);
      holder.addEventListener('pointercancel', onUp);

      /* ----------------------------------------------------------- rendu --- */
      let frame = 0;
      let visible = true;
      const inView = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      inView.observe(holder);

      const tick = (time: number) => {
        frame = requestAnimationFrame(tick);
        // Hors champ ou onglet en arrière-plan : rien à dessiner.
        if (!visible || document.hidden) return;
        if (!calm && time > drift.paused) view.yaw = normalizeYaw(view.yaw + drift.speed);
        const target = sphericalToVector(view.yaw, view.pitch, 10);
        camera.lookAt(target.x, target.y, target.z);
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        inView.disconnect();
        holder.removeEventListener('pointerdown', onDown);
        holder.removeEventListener('pointermove', onMove);
        holder.removeEventListener('pointerup', onUp);
        holder.removeEventListener('pointercancel', onUp);
        material.map?.dispose();
        material.dispose();
        geometry.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    },
    [imageUrl],
  );

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    // L'initialisation WebGL — compilation des nuanceurs, envoi de la texture,
    // première image — est la seule opération lourde de la page. On la place
    // dans un temps mort du fil principal : l'hydratation et le premier rendu
    // du texte passent devant, et le panorama arrive juste après, porté par son
    // fondu d'apparition. Personne ne voit la différence, la machine si.
    let cancelled = false;
    let teardown = () => {};

    const start = () => {
      if (cancelled) return;
      teardown = mount(holder);
    };

    const idle = window.requestIdleCallback?.(start, { timeout: 700 });
    const timer = idle === undefined ? window.setTimeout(start, 120) : undefined;

    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
      teardown();
    };
  }, [imageUrl, mount]);

  return (
    <div className={styles.stage} aria-hidden="true">
      <div ref={holderRef} className={styles.canvas} data-ready={ready ? '1' : undefined} />
      {failed && <div className={styles.fallback} />}
      <div className={styles.veil} />
      <div className={styles.grain} />
    </div>
  );
}

/**
 * Scène de repli, dessinée par le navigateur.
 *
 * Volontairement graphique — arches, lumière rasante, sol réfléchissant — et
 * non photoréaliste : une fausse photo se remarque, une composition assumée non.
 */
function drawScene(): HTMLCanvasElement {
  // 2048 × 1024 plutôt que 4096 × 2048 : la scène est abstraite, elle passe
  // sous un voile et un grain, et diviser par quatre le nombre de pixels retire
  // autant de temps de calcul au fil principal au premier rendu.
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return canvas;

  const horizon = H * 0.58;

  const wall = g.createLinearGradient(0, 0, 0, horizon);
  wall.addColorStop(0, '#2b211a');
  wall.addColorStop(0.42, '#6b4f38');
  wall.addColorStop(1, '#b98d61');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, horizon);

  const floor = g.createLinearGradient(0, horizon, 0, H);
  floor.addColorStop(0, '#8d6642');
  floor.addColorStop(0.35, '#5c4130');
  floor.addColorStop(1, '#241a14');
  g.fillStyle = floor;
  g.fillRect(0, horizon, W, H - horizon);

  // Arcade : huit arches régulières, l'ossature de la composition.
  const bays = 8;
  const bayWidth = W / bays;
  for (let i = 0; i < bays; i += 1) {
    const cx = bayWidth * (i + 0.5);
    const width = bayWidth * 0.46;
    const top = horizon - H * 0.34;

    g.save();
    g.beginPath();
    g.moveTo(cx - width / 2, horizon);
    g.lineTo(cx - width / 2, top + width * 0.5);
    g.quadraticCurveTo(cx - width / 2, top, cx, top);
    g.quadraticCurveTo(cx + width / 2, top, cx + width / 2, top + width * 0.5);
    g.lineTo(cx + width / 2, horizon);
    g.closePath();

    const depth = g.createLinearGradient(0, top, 0, horizon);
    // Une baie sur deux s'ouvre sur la lumière : le rythme naît du contraste.
    if (i % 2 === 0) {
      depth.addColorStop(0, '#f2e2c6');
      depth.addColorStop(1, '#c9a77c');
    } else {
      depth.addColorStop(0, '#1d1611');
      depth.addColorStop(1, '#3a2b20');
    }
    g.fillStyle = depth;
    g.fill();
    g.restore();
  }

  // Lumière rasante venue de la gauche.
  const light = g.createRadialGradient(W * 0.18, horizon * 0.45, 0, W * 0.18, horizon * 0.45, W * 0.4);
  light.addColorStop(0, 'rgba(255, 236, 200, 0.4)');
  light.addColorStop(1, 'rgba(255, 236, 200, 0)');
  g.fillStyle = light;
  g.fillRect(0, 0, W, H);

  // Reflet au sol, décroissant.
  for (let i = 0; i < bays; i += 1) {
    if (i % 2 !== 0) continue;
    const cx = bayWidth * (i + 0.5);
    const reflection = g.createLinearGradient(0, horizon, 0, horizon + H * 0.16);
    reflection.addColorStop(0, 'rgba(242, 226, 198, 0.3)');
    reflection.addColorStop(1, 'rgba(242, 226, 198, 0)');
    g.fillStyle = reflection;
    g.fillRect(cx - bayWidth * 0.23, horizon, bayWidth * 0.46, H * 0.16);
  }

  // Assombrissement du nadir et du zénith : le regard reste sur l'horizon.
  const nadir = g.createLinearGradient(0, H * 0.82, 0, H);
  nadir.addColorStop(0, 'rgba(20, 14, 10, 0)');
  nadir.addColorStop(1, 'rgba(20, 14, 10, 0.92)');
  g.fillStyle = nadir;
  g.fillRect(0, H * 0.82, W, H * 0.18);

  const zenith = g.createLinearGradient(0, 0, 0, H * 0.16);
  zenith.addColorStop(0, 'rgba(18, 13, 10, 0.9)');
  zenith.addColorStop(1, 'rgba(18, 13, 10, 0)');
  g.fillStyle = zenith;
  g.fillRect(0, 0, W, H * 0.16);

  return canvas;
}
