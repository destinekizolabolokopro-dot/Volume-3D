'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Chiffre qui se compose à l'entrée dans le champ.
 *
 * Le décompte n'a de sens que pour une valeur numérique : « 48h » est animé,
 * « 1 lien » ne l'est pas. Le préfixe et le suffixe sont donc séparés.
 */
export function Counter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 900;
        const step = (time: number) => {
          const ratio = Math.min(1, (time - start) / duration);
          // Décélération : le chiffre arrive vite puis se pose.
          const eased = 1 - Math.pow(1 - ratio, 3);
          setShown(Math.round(value * eased));
          if (ratio < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
