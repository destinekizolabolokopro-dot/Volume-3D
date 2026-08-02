/**
 * Petit jeu d'icônes au trait, dessinées à la même grille de 16 et au même
 * poids. Les importer d'une bibliothèque coûterait plus de kilo-octets que
 * l'ensemble des styles de la page.
 */
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export function IconCheck() {
  return (
    <svg {...base}>
      <path d="M2.8 8.4 6.2 11.8l7-7.6" />
    </svg>
  );
}

export function IconDot() {
  return (
    <svg {...base}>
      <circle cx="8" cy="8" r="2.4" />
    </svg>
  );
}

export function IconCalendar() {
  return (
    <svg {...base}>
      <rect x="2.2" y="3.4" width="11.6" height="10.4" rx="2" />
      <path d="M2.2 6.6h11.6M5.6 2v2.6M10.4 2v2.6" />
    </svg>
  );
}

export function IconChat() {
  return (
    <svg {...base}>
      <path d="M13.8 8.6c0 2.5-2.3 4.5-5.2 4.5-.7 0-1.4-.1-2-.3L2.6 14l1-2.6a4.3 4.3 0 0 1-1.4-3.1c0-2.5 2.3-4.5 5.2-4.5s5.4 1.9 5.4 4.4Z" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg {...base}>
      <path d="M8 2 3.2 3.9v3.7c0 2.7 1.9 5.2 4.8 6.4 2.9-1.2 4.8-3.7 4.8-6.4V3.9Z" />
      <path d="M6 8.1 7.4 9.5 10.2 6.6" />
    </svg>
  );
}

export function IconStar() {
  return (
    <svg {...base}>
      <path d="m8 2.4 1.8 3.6 4 .6-2.9 2.8.7 4L8 11.5l-3.6 1.9.7-4-2.9-2.8 4-.6Z" />
    </svg>
  );
}

export const RESULT_ICONS: Record<string, () => React.ReactElement> = {
  calendar: IconCalendar,
  chat: IconChat,
  shield: IconShield,
  star: IconStar,
};
