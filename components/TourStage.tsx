'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AttentionTracker } from '@/lib/attention-client';
import { ModelViewer } from './ModelViewer';
import { PanoViewer } from './PanoViewer';
import { PlanViewer } from './PlanViewer';
import type { Chapter, FloorPlan, Hotspot, Photo, PlanDoor, Scene, TourMode } from '@/lib/types';
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
  /** Repères de la vidéo, pour sauter directement à une pièce. */
  chapters: Chapter[];
  /** Plan lu et confirmé, si le logement en a un. */
  plan: FloorPlan | null;
  planDoors: PlanDoor[];
  /** Photos du bien : accrochées aux murs dans le format « plan ». */
  photos: Photo[];
  /** Nom de la visite. Vide pour ne rien mesurer — l'éditeur et les aperçus. */
  slug?: string;
}

const LABELS: Record<TourMode, string> = {
  pano: 'Visite 360°',
  video: 'Vidéo',
  model: 'Modèle 3D',
  embed: 'Visite 3D',
  plan: 'Plan 3D',
};

const HINTS: Record<TourMode, string> = {
  pano: 'Vous explorez vous-même, pièce par pièce',
  video: 'Une déambulation filmée dans le logement',
  model: 'Le logement en volume, vu de l’extérieur',
  embed: 'Visite interactive',
  plan: 'Le logement en volume, photos à l’appui',
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
  chapters,
  plan,
  planDoors,
  photos,
  slug = '',
}: TourStageProps) {
  /**
   * Mesure de l'attention.
   *
   * Elle ne tourne que sur une visite publiée — l'éditeur et les aperçus de
   * démarchage passent un `slug` vide, et ne comptent donc rien : les allers et
   * venues du propriétaire dans son propre éditeur fausseraient ses chiffres.
   */
  const tracker = useMemo(() => (slug ? new AttentionTracker(slug) : null), [slug]);
  useEffect(() => tracker?.start(), [tracker]);

  const [active, setActive] = useState<TourMode>(
    formats.includes(defaultFormat) ? defaultFormat : (formats[0] ?? 'pano'),
  );
  const [chapterIndex, setChapterIndex] = useState(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ordered = [...chapters].sort((a, b) => a.seconds - b.seconds);

  /** Une vidéo ne se parcourt pas : on la découpe en pièces, comme la 360°. */
  function seek(index: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = ordered[index].seconds;
    setChapterIndex(index);
    void video.play().catch(() => undefined);
  }

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
        {active === 'pano' && (
          <PanoViewer scenes={scenes} hotspots={hotspots} onSceneChange={(id) => tracker?.enter(id)} />
        )}

        {active === 'plan' && plan && (
          <PlanViewer plan={plan} doors={planDoors} photos={photos} onRoomChange={(id) => tracker?.enter(id)} />
        )}

        {active === 'video' && (
          <div className={styles.videoWrap}>
            {/* `key` force le remontage : sans lui, une vidéo déjà lancée
                continue de tourner en fond quand on revient sur le panorama. */}
            <video
              key={videoUrl}
              ref={videoRef}
              className={styles.media}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              title={`Visite vidéo — ${name}`}
              onTimeUpdate={(event) => {
                const time = event.currentTarget.currentTime;
                let current = -1;
                for (let i = 0; i < ordered.length; i += 1) {
                  if (ordered[i].seconds <= time + 0.25) current = i;
                }
                if (current !== chapterIndex) setChapterIndex(current);
              }}
            />

            {ordered.length > 0 && (
              <div className={styles.chapters} aria-label="Pièces de la vidéo">
                {ordered.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    type="button"
                    className={styles.chapter}
                    aria-current={index === chapterIndex}
                    onClick={() => seek(index)}
                  >
                    {chapter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
