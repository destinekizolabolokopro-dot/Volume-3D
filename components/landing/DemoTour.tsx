'use client';

import { useEffect, useState } from 'react';
import { PanoViewer } from '@/components/PanoViewer';
import { DEMO_HOTSPOTS, DEMO_SCENES } from '@/lib/demo';

/**
 * La visite de démonstration du premier écran.
 *
 * C'est le viewer de production, avec les mêmes commandes et les mêmes points
 * de passage : le propriétaire manipule l'outil réel, pas une capture.
 *
 * Le montage attend un temps mort du fil principal. L'initialisation WebGL —
 * compilation des nuanceurs, envoi de la texture, première image — est de loin
 * l'opération la plus lourde de la page ; la reporter laisse le titre et les
 * boutons s'afficher d'abord, ce qui est l'ordre dans lequel on veut être lu.
 */
export function DemoTour() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (!cancelled) setMounted(true);
    };
    const idle = window.requestIdleCallback?.(start, { timeout: 800 });
    const timer = idle === undefined ? window.setTimeout(start, 150) : undefined;
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  if (!mounted) {
    // Un aplat sombre, de la taille exacte du viewer : aucun décalage de mise
    // en page quand la visite prend sa place.
    return <div style={{ background: 'var(--dark)' }} aria-hidden="true" />;
  }

  return <PanoViewer scenes={DEMO_SCENES} hotspots={DEMO_HOTSPOTS} showHint={false} />;
}
