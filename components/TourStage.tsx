'use client';

import { useState } from 'react';
import { ModelViewer } from './ModelViewer';
import { PanoViewer } from './PanoViewer';
import type { Hotspot, Scene, TourMode } from '@/lib/types';
import styles from './TourStage.module.css';

export interface TourStageProps {
  formats: TourMode[];
  defaultFormat: TourMode;
  name: string;
  scenes: Scene[];
  hotspots: Hotspot[];
  videoUrl: string;
  modelUrl: string;
  embedUrl: string;
}

const LABELS: Record<TourMode, string> = {
  pano: 'Visite 360°',
  video: 'Vidéo',
  model: 'Modèle 3D',
  embed: 'Visite 3D',
};

const HINTS: Record<TourMode, string> = {
  pano: 'Vous explorez vous-même, pièce par pièce',
  video: 'Une déambulation filmée dans le logement',
  model: 'Le logement en volume, vu de l’extérieur',
  embed: 'Visite interactive',
};

/**
 * Scène de la visite publique.
 *
 * Un même logement peut proposer plusieurs formats — typiquement les panoramas
 * 360° et la vidéo de déambulation. Le voyageur bascule de l'un à l'autre ; le
 * format affiché à l'ouverture est celui choisi dans le back-office.
 */
export function TourStage({
  formats,
  defaultFormat,
  name,
  scenes,
  hotspots,
  videoUrl,
  modelUrl,
  embedUrl,
}: TourStageProps) {
  const [active, setActive] = useState<TourMode>(
    formats.includes(defaultFormat) ? defaultFormat : (formats[0] ?? 'pano'),
  );

  return (
    <div className={styles.stage}>
      {formats.length > 1 && (
        <div className={styles.switcher} role="tablist" aria-label="Format de la visite">
          {formats.map((format) => (
            <button
              key={format}
              type="button"
              role="tab"
              aria-selected={format === active}
              className={styles.tab}
              onClick={() => setActive(format)}
              title={HINTS[format]}
            >
              {LABELS[format]}
            </button>
          ))}
        </div>
      )}

      <div className={styles.frame}>
        {active === 'pano' && <PanoViewer scenes={scenes} hotspots={hotspots} />}

        {active === 'video' && (
          // `key` force le remontage : sans lui, une vidéo déjà lancée continue
          // de tourner en fond quand on revient sur le panorama.
          <video
            key={videoUrl}
            className={styles.media}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            title={`Visite vidéo — ${name}`}
          />
        )}

        {active === 'model' && <ModelViewer url={modelUrl} />}

        {active === 'embed' && (
          <iframe
            className={styles.media}
            src={embedUrl}
            title={`Visite 3D — ${name}`}
            allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
}
