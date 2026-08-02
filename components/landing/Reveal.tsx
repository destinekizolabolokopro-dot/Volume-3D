'use client';

import { useEffect, useRef } from 'react';

/**
 * Révélation à l'entrée dans le champ.
 *
 * Un seul IntersectionObserver par élément, un seul déclenchement, puis
 * l'observation s'arrête : aucun travail au défilement une fois l'élément vu.
 * L'animation elle-même est purement CSS (opacité + translation), donc portée
 * par le compositeur et sans impact sur le fil principal.
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

    // Sans animation demandée, l'élément est visible immédiatement.
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
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
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
