'use client';

import { useEffect, useRef } from 'react';
import { suivre } from './mouvement';
import styles from './Apparition.module.css';

/**
 * Ce qui entre dans le champ apparaît.
 *
 * Le mécanisme est celui de `components/landing/Reveal.tsx` — un observateur
 * par élément, un seul déclenchement, puis on se débranche — et il n'a pas été
 * dupliqué par confort : cette page-ci demande **plusieurs manières**
 * d'apparaître, et une seule d'entre elles est celle de la page d'accueil.
 *
 *  · `monte`  le bloc arrive de vingt-huit pixels plus bas. C'est le défaut ;
 *  · `fond`   il ne fait qu'apparaître, sans bouger. Pour ce qui est déjà
 *             lourd de mouvement, un grand titre par exemple ;
 *  · `net`    il arrive flou et fait le point. C'est la transition du bâtiment,
 *             reprise sur le texte pour que la page ait un seul vocabulaire ;
 *  · `filet`  un trait qui se tire de gauche à droite.
 *
 * Les durées sont longues — de neuf cents à seize cents millisecondes — et la
 * courbe décélère très tard. C'est la différence entre « ça apparaît » et « ça
 * se pose » ; le brief demandait la seconde.
 */
export type Facon = 'monte' | 'fond' | 'net' | 'filet';

export function Apparition({
  children,
  facon = 'monte',
  delai = 0,
  parallaxe = 0,
  as: Tag = 'div',
  className = '',
  id,
}: {
  children: React.ReactNode;
  facon?: Facon;
  /** Retard à l'apparition, en millisecondes. */
  delai?: number;
  /** Fraction de l'écart au centre de l'écran reportée en translation. */
  parallaxe?: number;
  as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'p' | 'span' | 'figure';
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.dataset.vu = '1';
      return undefined;
    }

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (!entree.isIntersecting) return;
        node.dataset.vu = '1';
        observateur.disconnect();
      },
      /* Le seuil est bas et la marge nulle : un bloc plein écran ne peut jamais
         être visible à dix pour cent d'un coup, et un bloc en pied de page ne
         peut plus s'éloigner du bord. */
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    observateur.observe(node);
    return () => observateur.disconnect();
  }, []);

  /* Le parallaxe est monté séparément : il vit tant que l'élément vit, alors
     que l'apparition se débranche au premier passage. */
  useEffect(() => {
    const node = ref.current;
    if (!node || !parallaxe) return undefined;
    return suivre(node, parallaxe);
  }, [parallaxe]);

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`${styles.apparition} ${className}`.trim()}
      data-facon={facon}
      style={delai ? ({ '--delai': `${delai}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
