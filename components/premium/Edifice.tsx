'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildEdifice } from '@/components/three/edifice';
import { adaptQuality } from '@/components/three/quality';
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

/* ================================================================= plans === */

interface Plan {
  /** Position du curseur de défilement où ce plan est atteint. */
  t: number;
  /** Distance à l'axe du bâtiment, en mètres. */
  rayon: number;
  /** Azimut, en degrés. */
  azimut: number;
  /** Site, en degrés. Négatif = on regarde depuis le bas. */
  site: number;
  /** Hauteur visée sur le bâtiment, en fraction de sa hauteur totale. */
  cible: number;
  /** Champ vertical, en degrés. Un long foyer écrase, un court exagère. */
  foyer: number;
  /**
   * Décentrement horizontal du point visé, en mètres. Positif pousse le
   * bâtiment vers la droite du cadre.
   *
   * C'est le seul réglage de la liste qui ne parle pas du bâtiment mais de la
   * **page**. Le titre du premier écran tient la moitié gauche du cadre ; sans
   * décentrement, il se pose en travers de la façade la plus travaillée de la
   * scène. Un cadreur ne recule pas pour régler cela, il panote.
   */
  ecart?: number;
}

/**
 * Le découpage en plans.
 *
 * C'est un découpage de film, pas une liste de positions. Chaque plan répond
 * à la section qu'il accompagne, et le passage de l'un à l'autre est une
 * **coupe adoucie**, jamais un mouvement libre : une caméra qui erre autour
 * d'un objet donne le tournis, une caméra qui va d'un cadre à un autre raconte.
 *
 * L'ordre suit le regard : on découvre la masse de loin et d'en bas, on monte
 * pour comprendre les redans, on descend au ras du parvis pour la hauteur, on
 * recule pour finir. C'est l'ordre dans lequel un architecte montre son projet.
 */
const PLANS: Plan[] = [
  /* Le premier écran. De trois quarts, de loin, à hauteur d'homme : le seul
     cadrage qui donne à la fois la masse et le sol sur lequel elle pose. */
  { t: 0.0, rayon: 134, azimut: 42, site: 6, cible: 0.47, foyer: 30, ecart: 20 },
  /* La présentation. On avance de vingt mètres, à peine — la section parle du
     nez de dalle, il faut commencer à le voir. */
  { t: 0.2, rayon: 112, azimut: 28, site: 10, cible: 0.5, foyer: 28, ecart: 11 },
  /* Galerie, plan I — « The mass ». On passe de l'autre côté de l'angle : même
     hauteur d'œil, mais la lumière est désormais rasante sur le grand côté et
     le petit côté part à l'ombre. C'est le contraste qui fait la masse. */
  { t: 0.43, rayon: 96, azimut: -34, site: 4, cible: 0.4, foyer: 31, ecart: 9 },
  /* Galerie, plan II — « The setbacks ». Vu d'en haut, les trois redans se
     lisent d'un seul mouvement et les terrasses apparaissent. C'est le seul
     plan presque frontal de la série, et il peut se le permettre : à trente
     degrés de site, ce sont les toitures qui donnent le volume. */
  { t: 0.57, rayon: 86, azimut: -6, site: 30, cible: 0.74, foyer: 27, ecart: 8 },
  /* Galerie, plan III — « From the forecourt ». Au pied du socle, en
     contre-plongée. Le foyer court est volontaire : c'est le seul plan de la
     page où l'on veut la déformation, celle qui fait fuir les verticales. */
  { t: 0.72, rayon: 46, azimut: -44, site: -11, cible: 0.3, foyer: 44, ecart: 7 },
  /* Les chiffres. On recule pour rendre le bâtiment entier à qui le compte. */
  { t: 0.88, rayon: 112, azimut: -22, site: 12, cible: 0.55, foyer: 29, ecart: 0 },
  /* L'appel final : le plus large de tous, et un retour à l'angle d'ouverture.
     La page se referme sur le cadrage qui l'a ouverte, en plus lointain. */
  { t: 1.0, rayon: 142, azimut: 34, site: 7, cible: 0.46, foyer: 27, ecart: 0 },
];

/*
 * Une contrainte tenue sur toute la liste : **aucun arrêt ne passe du côté de
 * l'ombre.**
 *
 * Le soleil est à dix-huit degrés d'azimut (`components/three/edifice.ts`).
 * Au-delà d'une soixantaine de degrés de part et d'autre, la caméra ne voit
 * plus que des faces à contre-jour : le bâtiment redevient une silhouette et
 * tout le travail sur le béton est perdu. Les sept arrêts tiennent donc dans
 * l'intervalle [−44°, +42°], et la variété vient d'ailleurs — de la distance,
 * de la hauteur et du foyer, qui sont d'ailleurs les trois vrais outils d'un
 * cadreur. Le grand tour d'horizon, lui, est une idée de logiciel.
 */

const lisse = (u: number) => {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return c * c * (3 - 2 * c);
};

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
 * borné à deux, et un plafond à cinquante-cinq degrés : on récupère
 * l'essentiel du cadre sans basculer dans le fisheye.
 *
 * Le décentrement, lui, s'efface : il existait pour dégager la colonne de
 * texte, et sur un écran étroit le texte occupe toute la largeur. Le pousser
 * de côté n'aurait plus dégagé personne, seulement coupé le bâtiment.
 */
function cadrer(p: Plan, aspect: number): { foyer: number; rayon: number; cible: number; ecart: number } {
  /* `part` vaut 1 sur un écran large et 0 sur un téléphone tenu debout ; tout
     le reste s'y accroche, ce qui évite trois seuils indépendants qui se
     contrediraient au premier changement d'orientation. */
  const part = Math.min(1, Math.max(0, (aspect - 0.62) / 0.9));
  const k = Math.min(1.62, Math.max(1, 1.55 / Math.max(0.2, aspect)));
  const large = 2 * Math.atan(Math.tan((p.foyer * Math.PI) / 360) * k);
  return {
    foyer: Math.min(55, (large * 180) / Math.PI),
    /* On se rapproche de dix pour cent : élargir le champ éloigne le sujet, et
       un immeuble minuscule au milieu d'un écran de téléphone n'impressionne
       personne. */
    rayon: p.rayon * (1 - 0.1 * (1 - part)),
    /* Et l'on vise plus bas. Le portrait empile le bâtiment et le texte au
       lieu de les mettre côte à côte : viser un tiers plus bas fait monter la
       masse dans la moitié haute du cadre, et rend la moitié basse au titre.
       C'est le même geste que le décentrement horizontal, tourné de
       quatre-vingt-dix degrés. */
    cible: p.cible * (1 - 0.36 * (1 - part)),
    ecart: (p.ecart ?? 0) * part,
  };
}

/** La pose au curseur `t`, interpolée entre les deux plans qui l'encadrent. */
function poseA(t: number): Plan {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  let i = 0;
  while (i < PLANS.length - 2 && PLANS[i + 1].t < c) i += 1;
  const a = PLANS[i];
  const b = PLANS[i + 1];
  const u = lisse((c - a.t) / Math.max(1e-6, b.t - a.t));
  const entre = (x: number, y: number) => x + (y - x) * u;
  return {
    t: c,
    rayon: entre(a.rayon, b.rayon),
    azimut: entre(a.azimut, b.azimut),
    site: entre(a.site, b.site),
    cible: entre(a.cible, b.cible),
    foyer: entre(a.foyer, b.foyer),
    ecart: entre(a.ecart ?? 0, b.ecart ?? 0),
  };
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
    renderer.toneMappingExposure = 1.02;
    holder.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      'Vue en trois dimensions de la résidence, qui tourne à mesure que la page défile.',
    );

    const edifice = buildEdifice(renderer, { leger });
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 900);
    const cible = new THREE.Vector3();
    setEtat('vivant');

    let dirty = true;
    const resize = () => {
      const { clientWidth, clientHeight } = holder;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(holder);

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
    const rendre = (t: number, derive: number) => {
      const p = poseA(t);
      const cadre = cadrer(p, camera.aspect);
      const az = ((p.azimut + derive) * Math.PI) / 180;
      const si = (p.site * Math.PI) / 180;
      const h = edifice.hauteur * cadre.cible;
      camera.position.set(
        Math.cos(az) * Math.cos(si) * cadre.rayon,
        h + Math.sin(si) * cadre.rayon,
        Math.sin(az) * Math.cos(si) * cadre.rayon,
      );
      /* Le décentrement s'applique au point visé, perpendiculairement à l'axe
         de vue : la caméra panote, elle ne se translate pas. Une translation
         latérale changerait la perspective du bâtiment ; un panoramique ne
         change que sa place dans le cadre, ce qui est exactement la demande. */
      cible.set(-Math.sin(az) * cadre.ecart, h, Math.cos(az) * cadre.ecart);
      camera.lookAt(cible);
      camera.fov = cadre.foyer;
      camera.updateProjectionMatrix();
      renderer.render(edifice.scene, camera);
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
      const derive = Math.sin((now - depuis) / 6400) * 2.1;
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
      observer.disconnect();
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
