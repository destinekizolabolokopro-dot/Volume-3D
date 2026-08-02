/** Cube isométrique de la marque : face du dessus en accent, deux faces sombres. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flex: 'none' }} aria-hidden="true" focusable="false">
      <polygon points="20,3 36,12 20,21 4,12" fill="var(--accent)" />
      <polygon points="4,12 20,21 20,37 4,28" fill="#0f1418" />
      <polygon points="20,21 36,12 36,28 20,37" fill="#2a323b" />
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
