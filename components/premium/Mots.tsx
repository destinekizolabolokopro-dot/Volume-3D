'use client';

import { useEffect, useRef } from 'react';
import styles from './Mots.module.css';

/**
 * Le titre qui se lève, mot par mot.
 *
 * Chaque ligne est une fenêtre à débord caché ; chaque mot part sous son bord
 * inférieur et remonte à sa place. C'est le seul effet vraiment « spectacle »
 * de la page, et il est réservé aux deux titres qui le méritent — celui du
 * premier écran et celui de l'appel final.
 *
 * Trois précautions, et elles font toute la différence entre l'élégance et le
 * gadget :
 *
 *  · **le décalage est court** — cinquante-cinq millisecondes par mot. À cent,
 *    une phrase de six mots met une seconde à s'écrire et on attend le
 *    dernier mot au lieu de lire la phrase ;
 *  · **la coupure des lignes est écrite**, pas laissée à la largeur du bloc.
 *    Un masque par ligne suppose de savoir où sont les lignes ; une phrase qui
 *    se recoupe toute seule sur un écran étroit mettrait ses mots à cheval sur
 *    deux fenêtres. D'où un tableau de lignes en entrée, et un repli sans
 *    masque quand la ligne déborde malgré tout ;
 *  · **le texte reste du texte.** Les mots sont des `span` dans un flux
 *    normal, séparés par de vraies espaces : la phrase se sélectionne, se
 *    cherche, se traduit et se lit à voix haute comme n'importe quelle autre.
 */
export function Mots({
  lignes,
  as: Tag = 'h2',
  className = '',
  delai = 0,
  id,
}: {
  /** Le texte, une entrée par ligne. La coupure est un choix de composition. */
  lignes: readonly string[];
  as?: 'h1' | 'h2' | 'p';
  className?: string;
  /** Retard avant le premier mot, en millisecondes. */
  delai?: number;
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
      { rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
    );
    observateur.observe(node);
    return () => observateur.disconnect();
  }, []);

  let rang = 0;
  return (
    <Tag ref={ref as never} id={id} className={`${styles.mots} ${className}`.trim()}>
      {lignes.map((ligne, i) => (
        <span className={styles.ligne} key={i}>
          {ligne.split(' ').map((mot, j) => {
            const n = rang;
            rang += 1;
            return (
              <span
                className={styles.mot}
                key={j}
                style={{ '--rang': n, '--delai': `${delai}ms` } as React.CSSProperties}
              >
                {mot}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
