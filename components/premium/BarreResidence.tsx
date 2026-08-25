'use client';

import { useEffect, useRef, useState } from 'react';
import { NAVIGATION, PROJET } from '@/lib/residence';
import styles from './BarreResidence.module.css';

/**
 * La barre.
 *
 * Elle fait trois choses, et rien de plus :
 *
 *  · au premier écran elle est **transparente**, posée sur le bâtiment. Une
 *    barre opaque au chargement coupe le hero en deux et lui prend sa hauteur,
 *    qui est tout ce qu'il a ;
 *  · passé le premier écran elle **prend son verre** — un fond très sombre à
 *    soixante-dix pour cent et un flou d'arrière-plan. Le flou n'est pas là
 *    pour faire joli : sans lui, le bâtiment défile derrière les liens et les
 *    rend illisibles pendant deux secondes à chaque section ;
 *  · elle **surligne la section courante**. C'est la seule micro-interaction
 *    de la page qui informe au lieu de décorer.
 *
 * Ce qu'elle ne fait pas : masquer au défilement vers le bas et réapparaître
 * vers le haut. Ce mouvement-là est partout, et il coûte un tressautement à
 * chaque changement de direction sur un pavé tactile.
 */
export function BarreResidence() {
  const [pose, setPose] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const [ici, setIci] = useState<string>('');
  const barre = useRef<HTMLElement>(null);

  useEffect(() => {
    let attente = false;
    const juger = () => {
      attente = false;
      /* Le seuil est la hauteur du premier écran moins la barre : c'est
         exactement le moment où le titre du hero passe dessous. */
      setPose(window.scrollY > window.innerHeight * 0.62);
    };
    const auDefilement = () => {
      if (attente) return;
      attente = true;
      requestAnimationFrame(juger);
    };
    juger();
    window.addEventListener('scroll', auDefilement, { passive: true });
    window.addEventListener('resize', auDefilement, { passive: true });
    return () => {
      window.removeEventListener('scroll', auDefilement);
      window.removeEventListener('resize', auDefilement);
    };
  }, []);

  /* La section courante est lue par observation, pas en comparant des
     positions à chaque image : c'est le navigateur qui fait le calcul, hors
     du fil principal, et il le fait mieux. */
  useEffect(() => {
    const cibles = NAVIGATION.map((lien) => document.querySelector(lien.href)).filter(
      (node): node is Element => node !== null,
    );
    if (cibles.length === 0) return undefined;
    const vues = new Map<string, number>();
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) vues.set(`#${entree.target.id}`, entree.intersectionRatio);
        let meilleur = '';
        let part = 0.12;
        for (const [href, ratio] of vues) {
          if (ratio > part) {
            part = ratio;
            meilleur = href;
          }
        }
        setIci(meilleur);
      },
      { threshold: [0, 0.12, 0.3, 0.55, 0.8] },
    );
    for (const cible of cibles) observateur.observe(cible);
    return () => observateur.disconnect();
  }, []);

  /* Le menu du téléphone se ferme sur Échap et quand on part ailleurs. Un
     panneau qu'on ne peut fermer qu'en visant une croix de vingt pixels est
     un panneau qu'on subit. */
  useEffect(() => {
    if (!ouverte) return undefined;
    const auClavier = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOuverte(false);
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [ouverte]);

  return (
    <header ref={barre} className={styles.barre} data-pose={pose ? '1' : undefined} data-ouverte={ouverte ? '1' : undefined}>
      <div className={styles.rang}>
        <a className={styles.marque} href="#top">
          <span className={styles.nom}>{PROJET.nom}</span>
          <span className={styles.lieu}>{PROJET.lieu}</span>
        </a>

        <nav className={styles.liens} aria-label="Sections">
          {NAVIGATION.map((lien) => (
            <a
              key={lien.href}
              href={lien.href}
              className={styles.lien}
              data-ici={ici === lien.href ? '1' : undefined}
              aria-current={ici === lien.href ? 'true' : undefined}
              onClick={() => setOuverte(false)}
            >
              {lien.label}
            </a>
          ))}
        </nav>

        <a className={styles.explorer} href="#contact" onClick={() => setOuverte(false)}>
          Explore <span aria-hidden="true">→</span>
        </a>

        <button
          type="button"
          className={styles.bascule}
          aria-expanded={ouverte}
          aria-label={ouverte ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setOuverte((v) => !v)}
        >
          <span className={styles.trait} />
          <span className={styles.trait} />
        </button>
      </div>
    </header>
  );
}
