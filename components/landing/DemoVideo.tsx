'use client';

import { useRef, useState } from 'react';

/**
 * Lecteur de la vidéo de démonstration.
 *
 * La vidéo n'est pas chargée tant que le visiteur ne l'a pas lancée
 * (`preload="none"`) : sur la page d'accueil, c'est le plus gros fichier du
 * site, et la majorité des visiteurs ne la regardent pas. Une fois lancée, on
 * rend la main aux contrôles natifs — ils sont accessibles et connus de tous.
 */
export function DemoVideo({ src, poster }: { src: string; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const start = () => {
    setStarted(true);
    const video = videoRef.current;
    if (!video) return;
    video.preload = 'auto';
    void video.play();
  };

  return (
    <div className="video">
      <video
        ref={videoRef}
        poster={poster}
        preload="none"
        playsInline
        controls={started}
        onEnded={() => setStarted(false)}
      >
        <source src={`${src}.mp4`} type="video/mp4" />
        <source src={`${src}.webm`} type="video/webm" />
        <span style={{ color: 'var(--ink-on-dark)' }}>Votre navigateur ne peut pas lire cette vidéo.</span>
      </video>

      <button type="button" className="video-cover" hidden={started} onClick={start}>
        <span className="video-play">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
            <path d="M4 2.5v13l11-6.5z" />
          </svg>
          Lancer la démonstration
        </span>
      </button>
    </div>
  );
}
