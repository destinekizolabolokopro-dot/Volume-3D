/**
 * Cube isométrique de la marque : face du dessus en accent, deux faces sombres.
 *
 * En mode `adaptive`, les deux faces prennent la couleur du texte courant avec
 * des opacités différentes. Le même cube reste donc lisible sur l'ivoire du
 * back-office comme sur le panorama sombre du héros, sans second fichier.
 */
export function LogoMark({ size = 26, adaptive = false }: { size?: number; adaptive?: boolean }) {
  const near = adaptive ? 'currentColor' : '#211c18';
  const far = adaptive ? 'currentColor' : '#3a332c';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flex: 'none' }} aria-hidden="true" focusable="false">
      <polygon points="20,3 36,12 20,21 4,12" fill="var(--accent)" />
      <polygon points="4,12 20,21 20,37 4,28" fill={near} fillOpacity={adaptive ? 0.92 : 1} />
      <polygon points="20,21 36,12 36,28 20,37" fill={far} fillOpacity={adaptive ? 0.6 : 1} />
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
