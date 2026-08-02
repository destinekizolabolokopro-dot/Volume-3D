'use client';

import { useEffect, useRef } from 'react';

/**
 * Apparition à l'entrée dans le champ.
 *
 * Un observateur par élément, un seul déclenchement, puis l'observation
 * s'arrête : rien à calculer au défilement une fois l'élément vu. L'animation
 * est purement CSS, donc portée par le compositeur.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.dataset.shown = '1';
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.dataset.shown = '1';
        observer.disconnect();
      },
      // Aucune marge négative : un bloc situé tout en bas de page doit pouvoir
      // se révéler même quand le défilement ne peut plus l'éloigner du bord.
      { rootMargin: '0px', threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${className}`.trim()}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
