/**
 * Cube isométrique de la marque.
 *
 * Les deux faces sombres sont tirées de `currentColor` : le logo se pose aussi
 * bien sur le blanc de la landing que sur la barre sombre du back-office, sans
 * variante ni prop. Seule la face du dessus porte l'accent, et sur fond sombre
 * c'est sa version claire — le pétrole profond y tomberait à 2,8 de contraste.
 */
export function LogoMark({ size = 26, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flex: 'none' }} aria-hidden="true" focusable="false">
      <polygon points="20,3 36,12 20,21 4,12" fill={onDark ? 'var(--accent-on-dark)' : 'var(--accent)'} />
      <polygon points="4,12 20,21 20,37 4,28" fill="currentColor" opacity="0.9" />
      <polygon points="20,21 36,12 36,28 20,37" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function Logo({ size = 26, href = '/' }: { size?: number; href?: string }) {
  return (
    <a className="brand" href={href}>
      <LogoMark size={size} />
      <span className="brand-name">
        Volume<span>3D</span>
      </span>
    </a>
  );
}
