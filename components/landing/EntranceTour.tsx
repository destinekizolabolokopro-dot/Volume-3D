'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  EYE,
  buildJourney,
  captionOpacity,
  doorOpening,
  sample,
  verticalFov,
  viewPitch,
  type CaptionText,
  type Journey,
} from '@/lib/journey-path';
import { buildInterior, configure, type Dehors } from '@/components/three/interior';
import { createAmbience, type Ambience } from '@/lib/ambience';
import { adaptQuality } from '@/components/three/quality';
import type { Massing } from '@/lib/showcase';
import type { PlanDoor, PlanPoint, PlanRoom } from '@/lib/types';
import styles from './EntranceTour.module.css';

/**
 * L'entrée du site : le défilement fait la visite.
 *
 * Le principe tient en une ligne — la position dans la page donne un curseur
 * entre 0 et 1, ce curseur donne une pose de caméra (`lib/journey-path.ts`), et
 * on dessine. Tout le reste n'est que soin.
 *
 * Trois décisions méritent d'être expliquées, parce qu'elles vont à l'encontre
 * de ce que font la plupart des sites de ce genre.
 *
 * **On ne détourne pas le défilement.** Pas de `preventDefault`, pas de scroll
 * simulé : la page défile normalement, on se contente de *lire* où elle en est.
 * Conséquence directe : la molette garde son inertie habituelle, la barre de
 * défilement fonctionne, Espace et les flèches marchent, la recherche dans la
 * page marche, et le lecteur d'écran n'est pas perdu. Les sites qui reprennent
 * la main sur le défilement gagnent trois pour cent d'effet et perdent tout le
 * reste.
 *
 * **L'image suit le curseur avec du retard.** Un amortissement à chaque frame,
 * normalisé sur le temps écoulé. Sans lui, l'image colle à la molette et
 * saccade à chaque cran ; avec lui, la caméra a le poids d'une caméra.
 *
 * **Rien ne passe par React pendant le défilement.** Opacités, textes, barre de
 * progression : tout est écrit directement dans le DOM depuis la boucle de
 * rendu. Un `setState` par frame ferait retomber la page à vingt images par
 * seconde sur un téléphone.
 *
 * **Le son est coupé, et il le reste tant qu'on n'a rien demandé.** Il existe —
 * des pas synthétisés qui suivent les mètres parcourus, une porte qui s'ouvre,
 * l'acoustique de chaque pièce (`lib/ambience.ts`) — mais rien n'est fabriqué,
 * pas même l'`AudioContext`, avant le clic sur le bouton. Une page qui se met à
 * faire du bruit toute seule est une page qu'on ferme.
 */

export interface EntranceTourProps {
  rooms: PlanRoom[];
  doors: PlanDoor[];
  massing?: Massing[];
  opening?: CaptionText;
  captions?: Record<string, CaptionText>;
  closing?: CaptionText;
  /** Ancre visée par le bouton « passer la visite ». */
  skipTo: string;
  /** Mention obligatoire sous la visite : ce bien est une démonstration. */
  disclaimer?: string;
  /** Ce qu'il y a derrière les fenêtres et la porte. Voir `interior.ts`. */
  dehors?: Dehors;
  /** Une piscine au sud. Indépendant de `dehors` : toutes les maisons de
   *  plain-pied n'en ont pas, et c'est ce qui distingue la villa. */
  piscine?: boolean;
}

export function EntranceTour({
  rooms,
  doors,
  massing = [],
  opening,
  captions,
  closing,
  skipTo,
  disclaimer,
  dehors,
  piscine,
}: EntranceTourProps) {
  const journey = useMemo(
    () => buildJourney(rooms, doors, { opening, captions, closing }),
    [rooms, doors, opening, captions, closing],
  );

  /* Le mouvement est un choix de l'utilisateur, pas du site. Tant qu'on ne sait
     pas ce qu'il a choisi, on ne monte pas la scène : c'est aussi ce qui évite
     de fabriquer un contexte WebGL pendant le rendu serveur. */
  const [motion, setMotion] = useState<'inconnu' | 'oui' | 'non'>('inconnu');
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setMotion(query.matches ? 'non' : 'oui');
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  if (motion === 'non') {
    return <StillTour journey={journey} skipTo={skipTo} disclaimer={disclaimer} />;
  }
  return (
    <MovingTour
      journey={journey}
      rooms={rooms}
      doors={doors}
      massing={massing}
      skipTo={skipTo}
      disclaimer={disclaimer}
      dehors={dehors}
      piscine={piscine}
      ready={motion === 'oui'}
    />
  );
}

/* ==================================================== version sans animation */

/**
 * Ce que voit quelqu'un qui a demandé moins d'animations.
 *
 * Pas une version dégradée où l'on aurait juste coupé le mouvement : les mêmes
 * textes, dans le même ordre, lisibles d'un coup. Quelqu'un qui souffre du
 * mouvement a droit au contenu, pas à un message d'excuse.
 */
function StillTour({
  journey,
  skipTo,
  disclaimer,
}: {
  journey: Journey;
  skipTo: string;
  disclaimer?: string;
}) {
  return (
    <section className={styles.still} aria-label="Visite guidée du logement">
      <ol className={styles.stillList}>
        {journey.captions.map((caption) => (
          <li key={caption.id}>
            <p className={styles.kicker}>{caption.kicker}</p>
            <h2 className={styles.stillTitle}>{caption.title}</h2>
            <p className={styles.stillText}>{caption.text}</p>
          </li>
        ))}
      </ol>
      {disclaimer ? <p className={styles.disclaimer}>{disclaimer}</p> : null}
      <a className={styles.stillLink} href={skipTo}>
        Continuer
      </a>
    </section>
  );
}

/* =============================================================== la visite */

function MovingTour({
  journey,
  rooms,
  doors,
  massing,
  skipTo,
  disclaimer,
  dehors,
  piscine,
  ready,
}: {
  journey: Journey;
  rooms: PlanRoom[];
  doors: PlanDoor[];
  massing: Massing[];
  skipTo: string;
  disclaimer?: string;
  dehors?: Dehors;
  piscine?: boolean;
  ready: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLParagraphElement>(null);
  const captionRefs = useRef<(HTMLElement | null)[]>([]);
  const [failed, setFailed] = useState(false);
  const [sound, setSound] = useState(false);
  /* L'`Ambience` survit aux rendus mais ne fabrique rien tant que personne n'a
     cliqué : elle n'est qu'un objet vide jusqu'à `enable()`. */
  const ambienceRef = useRef<Ambience | null>(null);
  if (ambienceRef.current === null) ambienceRef.current = createAmbience();
  useEffect(() => {
    const ambience = ambienceRef.current;
    return () => ambience?.dispose();
  }, []);

  /* La hauteur de défilement suit la longueur réelle du parcours : un studio se
     traverse plus vite qu'un cinq-pièces, et il serait absurde de demander le
     même nombre de tours de molette pour l'un et pour l'autre. */
  const height = Math.round(Math.min(760, Math.max(420, 220 + journey.metres * 22)));

  useEffect(() => {
    if (!ready) return undefined;
    const holder = holderRef.current;
    const section = sectionRef.current;
    if (!holder || !section) return undefined;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return undefined;
    }
    configure(renderer);
    holder.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      'Vue en trois dimensions du logement, qui avance à mesure que la page défile.',
    );

    const interior = buildInterior({ rooms, doors, massing, entrance: journey.entrance, renderer, dehors, piscine });
    const { scene, origin, leaf } = interior;
    const camera = new THREE.PerspectiveCamera(66, 1, 0.04, 300);

    const resize = () => {
      const { clientWidth, clientHeight } = holder;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    let dirty = true;
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(holder);

    /* La section n'est pas toujours à l'écran : quand elle ne l'est pas, on
       arrête de dessiner. Le dernier tampon reste affiché — on ne perd rien, et
       le téléphone ne chauffe pas pendant qu'on lit le bas de la page. */
    let onScreen = true;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        dirty = true;
      },
      { rootMargin: '120px' },
    );
    watcher.observe(section);

    const progress = () => {
      const rect = section.getBoundingClientRect();
      const span = section.offsetHeight - window.innerHeight;
      if (span <= 0) return 0;
      const value = -rect.top / span;
      return value < 0 ? 0 : value > 1 ? 1 : value;
    };

    let cursor = progress();
    const debut = sample(journey, cursor);
    let derniere = { x: debut.x, y: debut.y };
    let previous = performance.now();
    let frame = 0;
    /* La résolution suit ce que la machine sait tenir. Voir `quality.ts`. */
    const quality = adaptQuality(renderer, Math.min(window.devicePixelRatio, 2));

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || !onScreen) {
        previous = now;
        return;
      }
      quality.tick(now);
      /*
       * Le plafond sur le temps écoulé était à cinquante millisecondes, et
       * c'était un défaut sur les machines lentes.
       *
       * Il est là pour qu'une image en retard — un ramasse-miettes, un onglet
       * qui revient — ne fasse pas sauter la caméra d'un bond. Mais réglé à
       * vingt images par seconde, il bride aussi le cas ordinaire d'un appareil
       * modeste : à quatre images par seconde, chaque image ne rattrapait qu'un
       * quart du retard au lieu des quatre cinquièmes que le temps réellement
       * écoulé justifie. La caméra décrochait du doigt qui fait défiler — sur
       * l'appareil où l'on voudrait le moins que ça arrive.
       *
       * Un quart de seconde protège toujours du saut (l'onglet caché est déjà
       * traité au-dessus, et il remet la référence de temps), et laisse la
       * caméra suivre à quatre images par seconde.
       */
      const elapsed = Math.min(0.25, (now - previous) / 1000);
      previous = now;

      /* Amortissement normalisé sur le temps : la même douceur à 60 et à
         120 images par seconde. Un simple `+= delta * 0.12` donnerait une
         caméra deux fois plus nerveuse sur un écran rapide. */
      const target = progress();
      const pull = 1 - Math.pow(0.0016, elapsed);
      const moved = (target - cursor) * pull;
      if (Math.abs(target - cursor) < 0.00002) cursor = target;
      else {
        cursor += moved;
        dirty = true;
      }
      if (!dirty) return;
      dirty = false;

      const pose = sample(journey, cursor);
      camera.position.set(pose.x - origin.x, EYE, pose.y - origin.y);
      const yaw = (pose.yaw * Math.PI) / 180;
      /* L'assiette suit la forme du cadre : sur un téléphone tenu debout, le
         quart haut de l'image est du plafond nu. Voir `viewPitch`. */
      const pitch = (viewPitch(pose.pitch, camera.aspect) * Math.PI) / 180;
      camera.lookAt(
        camera.position.x + Math.cos(pitch) * Math.sin(yaw),
        camera.position.y + Math.sin(pitch),
        camera.position.z - Math.cos(pitch) * Math.cos(yaw),
      );
      camera.fov = verticalFov(pose.fov, camera.aspect);
      camera.updateProjectionMatrix();

      const openness = doorOpening(journey, cursor);
      if (leaf) leaf.group.rotation.y = leaf.closed + leaf.sweep * openness;

      /* Le son suit les mètres, pas le temps : on mesure ce que la caméra vient
         réellement de parcourir. À l'arrêt devant une légende, la distance est
         nulle et il ne se passe rien — ce qui est exactement ce qu'on veut
         entendre pendant qu'on lit. */
      const ambience = ambienceRef.current;
      if (ambience) {
        const marche = Math.hypot(pose.x - derniere.x, pose.y - derniere.y);
        derniere = { x: pose.x, y: pose.y };
        /* Le seuil de la porte d'entrée ne compte pas : la caméra y traverse
           deux mètres quatre-vingt-dix d'un coup, et huit pas d'un coup ne
           s'entendent pas comme de la marche. */
        if (cursor > journey.doorOpens.to) ambience.moved(marche, roomAt(journey, cursor));
        ambience.door(openness);
      }

      // Écriture directe dans le DOM : aucun rendu React pendant le défilement.
      let loudest = 0;
      journey.captions.forEach((caption, index) => {
        const node = captionRefs.current[index];
        if (!node) return;
        const opacity = captionOpacity(caption, cursor);
        if (opacity > loudest) loudest = opacity;
        node.style.opacity = String(opacity);
        node.style.transform = `translateY(${(1 - opacity) * 14}px)`;
        node.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
      });
      /* Le voile ne sert que la lisibilité du texte : il suit donc la légende
         la plus visible. Fixe, il assombrissait le bas de l'image même quand
         il n'y avait rien à y lire — et c'est précisément là que se trouvent le
         sol et le mobilier, c'est-à-dire ce qu'on est venu montrer.

         Mais il la précède : monté à la même vitesse que le texte, il n'était
         qu'aux deux tiers quand la lettre était déjà lisible, et sur un mur en
         plein soleil le contraste mesuré tombait à trois pour un au milieu du
         fondu. Le fond arrive avant le texte, comme au générique d'un film. */
      if (veilRef.current) {
        veilRef.current.style.opacity = String(0.24 + 0.76 * Math.min(1, loudest * 1.9));
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${cursor})`;
      if (cueRef.current) cueRef.current.style.opacity = String(Math.max(0, 1 - cursor * 14));

      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      quality.dispose();
      observer.disconnect();
      watcher.disconnect();
      interior.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ready, journey, rooms, doors, massing, dehors, piscine]);

  if (failed) return <StillTour journey={journey} skipTo={skipTo} disclaimer={disclaimer} />;

  return (
    <section
      ref={sectionRef}
      className={styles.tour}
      style={{ height: `${height}vh` }}
      aria-label="Visite guidée du logement, pilotée par le défilement"
    >
      <div className={styles.sticky}>
        <div className={styles.canvas} ref={holderRef} />
        <div className={styles.veil} ref={veilRef} aria-hidden="true" />

        {journey.captions.map((caption, index) => (
          <figure
            key={caption.id}
            className={styles.caption}
            style={{ opacity: 0, visibility: 'hidden' }}
            ref={(node) => {
              captionRefs.current[index] = node;
            }}
          >
            <figcaption>
              <p className={styles.kicker}>{caption.kicker}</p>
              <p className={styles.title}>{caption.title}</p>
              <p className={styles.text}>{caption.text}</p>
            </figcaption>
          </figure>
        ))}

        <p className={styles.cue} ref={cueRef} aria-hidden="true">
          <span className={styles.cueLine} />
          Faites défiler
        </p>

        <div className={styles.hud}>
          {disclaimer ? <p className={styles.mention}>{disclaimer}</p> : null}
          <div className={styles.track} aria-hidden="true">
            <div className={styles.bar} ref={barRef} />
          </div>
          <button
            type="button"
            className={styles.sound}
            aria-pressed={sound}
            onClick={() => {
              const ambience = ambienceRef.current;
              if (!ambience) return;
              if (sound) {
                ambience.disable();
                setSound(false);
              } else {
                /* Le clic **est** le geste qui autorise le son : les navigateurs
                   refusent tout `AudioContext` réveillé ailleurs, et ils ont
                   raison. D'où l'appel ici, et nulle part ailleurs. */
                void ambience.enable().then(() => setSound(true));
              }
            }}
          >
            <IconSound on={sound} />
            <span>{sound ? 'Couper le son' : 'Activer le son'}</span>
          </button>
          <a className={styles.skip} href={skipTo}>
            Passer la visite
          </a>
        </div>
      </div>
    </section>
  );
}


/**
 * La pièce traversée à cet instant du parcours.
 *
 * `journey.rooms` donne l'instant d'arrivée dans chacune ; on prend la dernière
 * franchie. Ce n'est pas exactement « où se trouve la caméra » — pendant la
 * traversée d'une porte, les deux pièces se valent — mais l'oreille n'entend
 * pas la différence, et le calcul coûte une boucle sur six entrées.
 */
function roomAt(journey: Journey, cursor: number): string {
  let current = '';
  for (const entry of journey.rooms) {
    if (entry.t > cursor) break;
    current = entry.roomId;
  }
  return current;
}

/**
 * Le haut-parleur du bouton de son.
 *
 * Barré quand le son est coupé — et **barré**, pas seulement plus pâle : sur la
 * barre du bas, posée sur une image qui change à chaque instant, une nuance de
 * gris ne dit rien. Le libellé porte l'information de toute façon ; l'icône ne
 * fait que la répéter d'un coup d'œil.
 */
function IconSound({ on }: { on: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 6h2.2L8.4 3.4v9.2L5.2 10H3V6Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {on ? (
        <>
          <path d="M10.6 5.9a2.9 2.9 0 0 1 0 4.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12.4 4.2a5.3 5.3 0 0 1 0 7.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <path d="M10.8 6.2 14 9.4M14 6.2l-3.2 3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      )}
    </svg>
  );
}
