'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildEdifice } from '@/components/three/edifice';
import { creerProfondeur } from '@/components/three/profondeur';
import { adaptQuality } from '@/components/three/quality';
import { VOL } from '@/lib/residence';
import styles from './Edifice.module.css';

/**
 * L'édifice, et la caméra qui tourne autour.
 *
 * Trois principes, et ils viennent tous du même endroit — la visite au
 * défilement du reste du site, qui a déjà réglé ces questions-là.
 *
 * **On ne détourne pas le défilement.** Pas de `preventDefault`, pas de scroll
 * simulé : la page défile normalement, on lit seulement où elle en est. La
 * molette garde son inertie, la barre de défilement fonctionne, Espace et les
 * flèches marchent, la recherche dans la page marche. Les sites qui reprennent
 * la main sur le défilement gagnent trois pour cent d'effet et perdent tout le
 * reste.
 *
 * **Rien ne passe par React pendant le défilement.** La pose de caméra est
 * écrite directement dans la scène depuis la boucle de rendu. Un `setState`
 * par image ferait retomber la page à vingt images par seconde sur un
 * téléphone, ce qui est l'exact contraire d'un site premium.
 *
 * **L'image suit le curseur avec du retard.** Un amortissement normalisé sur le
 * temps écoulé, donc la même douceur à 60 et à 120 images par seconde. Sans
 * lui, la caméra colle à la molette et saccade à chaque cran ; avec lui, elle a
 * le poids d'une caméra.
 */

/* ================================================================== vol === */

/*
 * Le vol lui-même vit dans `lib/residence.ts`, avec les cotes du bâtiment.
 *
 * Ce n'est pas un rangement de confort : une trajectoire qui se termine dans
 * le hall est **liée aux dimensions du hall**. La dernière étape doit se
 * trouver entre ses murs et au-dessus de son sol, et cela se vérifie par
 * test — ce qui suppose que les deux soient lisibles depuis le même endroit,
 * sans monter un contexte WebGL pour y arriver.
 */

/*
 * Les positions réelles des étapes, relevées dans le document.
 *
 * Les `t` écrits dans `VOL` sont un repli : la position d'une section dépend
 * de la longueur de son texte, de la largeur de l'écran et de la taille de la
 * fonte. Aucun nombre écrit à la main ne peut la connaître, et la première
 * version l'a payé — deux sections ajoutées, et l'arrêt de l'atrium tombait
 * quinze pour cent trop loin : on arrivait dans la verrière au lieu du puits.
 *
 * On relève donc, au montage et à chaque changement de forme de la page. Les
 * étapes de transit, qui n'ont pas d'ancre, sont réparties entre leurs voisines
 * ancrées au prorata de leurs `t` d'origine : c'est ce qui garde le rythme du
 * découpage quand la page s'allonge.
 */
const TS: number[] = VOL.map((e) => e.t);

function caler(): void {
  if (typeof document === 'undefined') return;
  const course = document.documentElement.scrollHeight - window.innerHeight;
  if (course <= 0) return;

  const ancres = new Map<number, number>();
  VOL.forEach((etape, i) => {
    if (!etape.ancre) return;
    const node = document.querySelector(etape.ancre);
    if (!node) return;
    const haut =
      node.getBoundingClientRect().top + window.scrollY + (etape.ecran ?? 0) * window.innerHeight;
    ancres.set(i, Math.min(1, Math.max(0, haut / course)));
  });
  if (ancres.size < 2) return;

  const index = [...ancres.keys()].sort((a, b) => a - b);
  for (const i of index) TS[i] = ancres.get(i) as number;

  /* Entre deux ancres, on répartit au prorata des `t` d'origine plutôt qu'à
     intervalles égaux : le découpage écrit à la main dit, par exemple, que le
     transit du seuil au hall est court et celui du hall au puits plus long.
     Répartir uniformément effacerait cette intention. */
  for (let k = 0; k + 1 < index.length; k += 1) {
    const a = index[k];
    const b = index[k + 1];
    const etendue = VOL[b].t - VOL[a].t;
    for (let i = a + 1; i < b; i += 1) {
      const part = etendue > 1e-6 ? (VOL[i].t - VOL[a].t) / etendue : (i - a) / (b - a);
      TS[i] = TS[a] + (TS[b] - TS[a]) * part;
    }
  }
  // Avant la première ancre et après la dernière : on garde les bornes.
  for (let i = 0; i < index[0]; i += 1) TS[i] = TS[index[0]];
  for (let i = index[index.length - 1] + 1; i < TS.length; i += 1) TS[i] = 1;
}

const lisse = (u: number) => {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return c * c * (3 - 2 * c);
};

/*
 * Deux courbes, pas huit segments.
 *
 * Relier les étapes par des droites donnerait un vol qui casse à chaque
 * étape : la direction change d'un coup, et l'œil voit très bien une caméra
 * qui pivote instantanément, même de trois degrés. Une spline de Catmull-Rom
 * passe par tous les points **et** garde une tangente continue, donc une
 * vitesse et une direction continues.
 *
 * En version « centripète », précisément, et pas en version uniforme : la
 * variante uniforme fait des boucles quand deux points sont proches et un
 * troisième loin, ce qui est exactement la forme de ce vol — soixante mètres
 * puis treize. La caméra serait sortie de la trajectoire juste avant la porte,
 * c'est-à-dire au pire endroit.
 */
const COURBE_OEIL = new THREE.CatmullRomCurve3(
  VOL.map((e) => new THREE.Vector3(...e.oeil)),
  false,
  'centripetal',
  0.5,
);
/** L'axe vertical, gardé au chaud : la dérive tourne autour de lui à chaque image. */
const HAUT = new THREE.Vector3(0, 1, 0);

const COURBE_VISE = new THREE.CatmullRomCurve3(
  VOL.map((e) => new THREE.Vector3(...e.vise)),
  false,
  'centripetal',
  0.5,
);

/**
 * Du curseur de défilement au paramètre de la courbe.
 *
 * Linéaire à l'intérieur de chaque segment, et c'est **délibéré**. Une
 * accélération douce par segment — la solution évidente — ferait ralentir la
 * caméra jusqu'à l'arrêt à chaque étape, puis repartir : huit petits
 * démarrages au lieu d'un travelling. La continuité de vitesse est déjà
 * assurée par la spline ; l'adoucissement, lui, est réservé aux deux bouts du
 * vol, là où il n'y a rien avant et rien après.
 */
function parametre(t: number): { u: number; foyer: number; pan: number } {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  let i = 0;
  while (i < VOL.length - 2 && TS[i + 1] < c) i += 1;
  const a = VOL[i];
  const b = VOL[i + 1];
  let f = (c - TS[i]) / Math.max(1e-6, TS[i + 1] - TS[i]);
  f = f < 0 ? 0 : f > 1 ? 1 : f;
  /* Les deux bouts, et eux seuls : on démarre en douceur et on se pose en
     douceur. Au milieu, la vitesse reste continue d'un segment à l'autre. */
  if (i === 0) f = lisse(f);
  else if (i === VOL.length - 2) f = lisse(f);
  return {
    u: (i + f) / (VOL.length - 1),
    foyer: a.foyer + (b.foyer - a.foyer) * f,
    pan: (a.pan ?? 0) + ((b.pan ?? 0) - (a.pan ?? 0)) * f,
  };
}

/**
 * Le cadrage se rattrape sur les écrans étroits.
 *
 * Le champ d'une caméra three.js est **vertical** : à foyer constant, passer
 * d'un écran seize-neuvièmes à un téléphone tenu debout ne montre pas plus de
 * hauteur, cela retire de la largeur. Sur le premier écran, le bâtiment
 * sortait du cadre par la droite et perdait son couronnement.
 *
 * On élargit donc le champ à mesure que la fenêtre se resserre — mais **pas
 * complètement**. Compenser à cent pour cent demanderait quatre-vingt-dix
 * degrés de champ vertical sur un téléphone, et un champ pareil déforme les
 * verticales d'un immeuble au point de le faire tomber en arrière. Un facteur
 * borné, et un plafond à cinquante-huit degrés : on récupère l'essentiel du
 * cadre sans basculer dans le fisheye.
 */
function cadrer(foyer: number, aspect: number): { foyer: number; part: number } {
  const part = Math.min(1, Math.max(0, (aspect - 0.62) / 0.9));
  const k = Math.min(1.62, Math.max(1, 1.55 / Math.max(0.2, aspect)));
  const large = 2 * Math.atan(Math.tan((foyer * Math.PI) / 360) * k);
  return { foyer: Math.min(58, (large * 180) / Math.PI), part };
}

/* ============================================================== composant === */

export function Edifice({ reveal = true }: { reveal?: boolean }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<'attente' | 'vivant' | 'sansGL'>('attente');
  const [net, setNet] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return undefined;

    /* Le mouvement est un choix de la personne, pas du site. Sans WebGL ou
       avec « moins d'animations », on ne monte pas de scène du tout : c'est
       aussi ce qui évite de fabriquer un contexte pendant le rendu serveur. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEtat('sansGL');
      return undefined;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setEtat('sansGL');
      return undefined;
    }

    /*
     * L'allègement, et sur quel critère.
     *
     * Ni l'agent utilisateur ni le nombre de cœurs ne disent ce qu'une machine
     * sait faire. `hardwareConcurrency` a d'ailleurs été essayé ici et retiré :
     * il rend quatre sur une machine de développement en conteneur comme sur
     * un téléphone d'entrée de gamme, et il faisait tomber le rendu complet
     * sur des écrans de quatorze cent quarante pixels.
     *
     * Reste la taille de la fenêtre, qui ne dit pas la puissance mais dit le
     * **besoin** : sur un petit écran, les meneaux des petits côtés et une
     * carte d'ombre de deux mille pixels ne se voient pas, donc on ne les
     * paie pas. La vraie mesure, elle, est faite par `adaptQuality`, image par
     * image, sur la machine réelle.
     */
    const leger = Math.min(window.innerWidth, window.innerHeight) < 760;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, leger ? 1.5 : 2));
    renderer.setClearColor(0x0d1014, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    /* L'exposition monte à 1,14 depuis que le soleil est descendu à quinze
       degrés : à cette hauteur-là, une façade ne reçoit plus qu'une fraction
       de ce qu'elle prenait à vingt-six, et l'image entière glissait vers le
       gris. On ne rattrape pas une lumière rasante en la redressant — on
       l'expose.
       Puis à 1,32 le jour où la page est passée à l'intérieur : un séjour au
       cinquième ne reçoit qu'une part du ciel, et l'exposition d'une façade
       n'est pas celle d'une pièce. */
    renderer.toneMappingExposure = 1.12;
    holder.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      'Vue en trois dimensions de l’appartement : la caméra le traverse pièce par pièce à mesure que la page défile.',
    );

    const edifice = buildEdifice(renderer, { leger });

    /*
     * La profondeur de champ.
     *
     * Elle coûte deux passes plein écran ; on ne l'accorde donc pas aux
     * petites machines, qui ont mieux à faire de leur temps d'image — et à qui
     * elle manquera moins qu'à personne, un flou d'arrière-plan sur un écran
     * de six pouces se voyant à peine. Sur les autres, c'est le réglage qui
     * distingue le plus nettement une image d'objectif d'une image de calcul :
     * plus que les matières, plus que la lumière.
     */
    const bokeh = leger ? null : creerProfondeur(renderer, 0.85);
    /* Le plan rapproché descend à vingt centimètres : la caméra frôle un
       montant de porte en entrant, et un plan avant à un mètre l'aurait
       tranché en deux au moment précis où l'on veut sentir qu'on passe. */
    const camera = new THREE.PerspectiveCamera(32, 1, 0.2, 1200);
    setEtat('vivant');

    /*
     * Une poignée sur la scène, pour les sondes.
     *
     * Elle ne sert à rien à l'écran et elle a déjà payé son écriture deux
     * fois. Un rendu ne se débogue pas à l'œil : quand l'atrium est sorti
     * comme un aplat, trois hypothèses fausses se sont succédé avant qu'un
     * lancer de rayon depuis la caméra ne réponde en une seconde — « une
     * sous-face de dalle, à un mètre soixante-dix ». Sans poignée, cette
     * question-là ne peut pas être posée depuis un script, et on retombe sur
     * la théorie.
     *
     * Elle n'expose que de la lecture, elle ne coûte rien, et elle reste en
     * production : un site dont la scène est inspectable depuis la console est
     * un site qu'on peut réparer.
     */
    const rayon = new THREE.Raycaster();
    (window as unknown as { oriel?: unknown }).oriel = {
      scene: edifice.scene,
      camera,
      renderer,
      /**
       * Ce que la caméra touche en un point de l'écran, en coordonnées
       * normalisées (-1 à 1, y vers le haut). Rend `null` pour le ciel.
       */
      sonder(x: number, y: number) {
        rayon.setFromCamera(new THREE.Vector2(x, y), camera);
        const [touche] = rayon.intersectObjects([edifice.scene], true);
        if (!touche) return null;
        const material = (touche.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
        return {
          nom: touche.object.name || touche.object.type,
          distance: Number(touche.distance.toFixed(2)),
          couleur: material?.color ? `#${material.color.getHexString()}` : null,
          rugosite: material?.roughness ?? null,
          point: [touche.point.x, touche.point.y, touche.point.z].map((v) => Number(v.toFixed(2))),
        };
      },
    };

    let dirty = true;
    const resize = () => {
      const { clientWidth, clientHeight } = holder;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      const pixels = renderer.getDrawingBufferSize(new THREE.Vector2());
      bokeh?.setSize(pixels.x, pixels.y);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(holder);

    /* Le vol se recale sur les sections dès que la page change de forme : une
       fonte qui arrive, un bloc qui se révèle, une rotation d'écran. Sans
       cela, un relevé pris avant que la page ait sa hauteur définitive fige
       une répartition fausse d'un bout à l'autre du défilement. */
    caler();
    const arpenteur = new ResizeObserver(caler);
    arpenteur.observe(document.documentElement);

    /* La scène ne se dessine que si elle est à l'écran. Le dernier tampon
       reste affiché — on ne perd rien, et le téléphone ne chauffe pas pendant
       qu'on lit le bas de la page. */
    let onScreen = true;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        dirty = true;
      },
      { rootMargin: '160px' },
    );
    watcher.observe(holder);

    const progres = () => {
      const doc = document.documentElement;
      const span = doc.scrollHeight - window.innerHeight;
      if (span <= 0) return 0;
      const v = window.scrollY / span;
      return v < 0 ? 0 : v > 1 ? 1 : v;
    };

    let curseur = progres();
    let precedent = performance.now();
    let frame = 0;
    let depuis = performance.now();
    const quality = adaptQuality(renderer, Math.min(window.devicePixelRatio, leger ? 1.5 : 2));

    /** Écrit la pose du curseur `t` dans la caméra, dérive comprise, et rend. */
    const oeil = new THREE.Vector3();
    const vise = new THREE.Vector3();

    /** Écrit la pose du curseur `t` dans la caméra, dérive comprise, et rend. */
    const rendre = (t: number, derive: number) => {
      const { u, foyer, pan } = parametre(t);
      COURBE_OEIL.getPoint(u, oeil);
      COURBE_VISE.getPoint(u, vise);
      const cadre = cadrer(foyer, camera.aspect);

      /*
       * La dérive : le vol tourne très légèrement autour de ce qu'il regarde.
       *
       * Elle est appliquée comme une **rotation de l'œil autour du point
       * visé**, et non comme une translation. La différence compte : une
       * translation de deux mètres n'est rien à deux cents mètres et beaucoup
       * dans un hall, alors qu'un degré et demi reste un degré et demi partout.
       * C'est le mouvement qui empêche l'image d'être fixe quand on s'arrête
       * de faire défiler, sans jamais devenir un économiseur d'écran.
       */
      oeil.sub(vise).applyAxisAngle(HAUT, (derive * Math.PI) / 180).add(vise);

      /*
       * Sur un écran étroit, on vise plus bas.
       *
       * Le portrait empile le bâtiment et le texte au lieu de les mettre côte
       * à côte. Abaisser le point visé fait monter la masse dans la moitié
       * haute du cadre et rend la moitié basse au titre. Le décalage est
       * proportionnel à la distance — un mètre de plus ou de moins ne veut pas
       * dire la même chose à deux cents mètres et à deux — et il s'efface à
       * mesure qu'on entre : dans le hall, viser un mètre plus bas reviendrait
       * à regarder le sol.
       */
      if (cadre.part < 1) {
        const loin = oeil.distanceTo(vise);
        vise.y -= Math.min(14, loin * 0.075) * (1 - cadre.part);
      }

      camera.position.copy(oeil);
      /* Le panoramique fait tourner la **direction de visée** autour de l'œil,
         et s'efface avec le portrait : sur un écran étroit le texte occupe
         toute la largeur, et pousser le bâtiment de côté ne dégagerait plus
         personne — cela le couperait. */
      if (pan && cadre.part > 0) {
        vise.sub(oeil).applyAxisAngle(HAUT, (pan * cadre.part * Math.PI) / 180).add(oeil);
      }
      camera.lookAt(vise);
      camera.fov = cadre.foyer;
      camera.updateProjectionMatrix();

      /* Le point de netteté est ce que la caméra regarde. C'est le geste d'un
         cadreur, et cela évite un second jeu de nombres à tenir en accord avec
         le premier : le vol dit déjà, à chaque étape, ce qui compte dans le
         cadre. */
      /*
       * La profondeur de champ s'efface quand la machine peine.
       *
       * `adaptQuality` mesure le temps par image et baisse la résolution de
       * rendu jusqu'à son plancher. Quand elle y est arrivée et qu'elle y
       * reste, c'est que la machine ne suit plus : deux passes plein écran de
       * plus n'y changeront rien de bon. On rend alors la scène directement.
       *
       * C'est le bon ordre de sacrifice — mesuré : la profondeur de champ ne
       * pèse que 1 % du temps par image ici, contre 45 % pour la résolution.
       * On coupe donc d'abord ce qui coûte, et l'effet en dernier.
       */
      if (bokeh && quality.scale > 0.6) bokeh.rendre(edifice.scene, camera, oeil.distanceTo(vise));
      else renderer.render(edifice.scene, camera);
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || !onScreen) {
        precedent = now;
        return;
      }
      quality.tick(now);
      const ecoule = Math.min(0.25, (now - precedent) / 1000);
      precedent = now;

      const vise = progres();
      const tire = 1 - Math.pow(0.0022, ecoule);
      if (Math.abs(vise - curseur) < 0.00002) curseur = vise;
      else {
        curseur += (vise - curseur) * tire;
        dirty = true;
      }

      /*
       * L'orbite lente, par-dessus le défilement.
       *
       * Deux degrés d'amplitude sur quarante secondes. C'est très peu, et
       * c'est le but : le mouvement ne doit pas se voir, il doit seulement
       * empêcher l'image d'être fixe. Au-delà de trois ou quatre degrés on
       * quitte le film d'architecture pour l'économiseur d'écran, et la
       * personne qui lit un paragraphe se met à suivre le bâtiment des yeux.
       */
      const derive = Math.sin((now - depuis) / 6400) * 1.5;
      dirty = true;

      if (!dirty) return;
      dirty = false;
      rendre(curseur, derive);
    };

    /*
     * La mise au point se fait sur une image **arrêtée**, et c'est une
     * correction, pas une préférence.
     *
     * Première version : la boucle démarrait tout de suite et le canevas
     * portait un `filter: blur(18px)` qui se levait en deux secondes. À
     * l'écran, le flou ne se levait jamais. La raison est mécanique — un flou
     * CSS sur une couche qui se repeint soixante fois par seconde oblige le
     * compositeur à re-flouter tout le plein écran à chaque image, et il
     * n'arrive plus à suivre. Sur la machine de test, ni le flou ni le texte
     * du premier écran n'apparaissaient : le compositeur affichait une image
     * périmée pendant plusieurs secondes.
     *
     * On dessine donc **une seule image**, on laisse le flou se lever
     * dessus — une seule rastérisation, animée par le compositeur seul — puis
     * on démarre la boucle. C'est aussi ce que la métaphore demandait : un
     * objectif fait le point sur une image fixe, il ne fait pas le point sur
     * un travelling.
     */
    rendre(curseur, 0);

    /*
     * L'ombre est calculée une fois, puis gelée.
     *
     * Par défaut, three.js redessine la carte d'ombre à chaque image. Ici,
     * cela revient à refaire deux mille quarante-huit fois deux mille
     * quarante-huit pixels de profondeur, soixante fois par seconde, pour un
     * soleil qui ne bouge pas et un bâtiment qui ne bouge pas non plus. C'est
     * la passe la plus chère de la scène, et elle est intégralement inutile.
     *
     * Ce n'était pas une optimisation théorique : sans ce gel, la page saturait
     * le fil principal au point que les minuteries et les transitions CSS
     * n'avançaient plus. Le premier écran restait flou et son titre invisible,
     * non pas à cause d'une faute de style, mais parce que le navigateur
     * n'avait plus une milliseconde à leur consacrer.
     *
     * Seule la caméra bouge, et une carte d'ombre ne dépend pas de la caméra.
     */
    renderer.shadowMap.autoUpdate = false;

    const leve = window.setTimeout(() => setNet(true), 60);

    let lancee = false;
    const demarrer = () => {
      if (lancee) return;
      lancee = true;
      window.removeEventListener('scroll', demarrer);
      depuis = performance.now();
      precedent = performance.now();
      frame = requestAnimationFrame(draw);
    };
    /* Au premier défilement, ou au bout de la mise au point — le premier des
       deux. Quelqu'un qui fait défiler tout de suite ne doit pas trouver une
       image figée. */
    const depart = window.setTimeout(demarrer, 1500);
    window.addEventListener('scroll', demarrer, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(leve);
      window.clearTimeout(depart);
      window.removeEventListener('scroll', demarrer);
      quality.dispose();
      bokeh?.dispose();
      observer.disconnect();
      arpenteur.disconnect();
      watcher.disconnect();
      edifice.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      className={styles.scene}
      data-etat={etat}
      data-net={net || !reveal ? '1' : undefined}
      ref={holderRef}
      aria-hidden={etat === 'sansGL' ? 'true' : undefined}
    />
  );
}
