import type { ReactNode } from 'react';
import { LogoMark } from '@/components/Logo';

/**
 * Les pièces communes au back-office et à l'espace client.
 *
 * Les deux sont des outils de travail, vus par la même personne à quelques
 * minutes d'intervalle. Avant ce module, ils avaient chacun leur barre, leur
 * traitement de titre et leur façon de dessiner une carte — pour le même
 * produit. Ce qui est ici est ce qui doit être identique ; ce qui reste dans
 * chaque page est ce qui lui appartient vraiment.
 */

/* ------------------------------------------------------------- en-tête --- */

export interface ProBarProps {
  /** Onglets de navigation, dans l'ordre. */
  tabs: { href: string; label: string; count?: number }[];
  /** Chemin courant, pour marquer l'onglet actif. */
  current?: string;
  /** Qui est connecté, affiché à droite. */
  who?: string;
  /** Le bouton de déconnexion, monté par l'appelant : les deux surfaces n'ont
   *  pas la même action de sortie. */
  side?: ReactNode;
}

export function ProBar({ tabs, current, who, side }: ProBarProps) {
  return (
    <header className="pro-bar">
      <a className="pro-brand" href={tabs[0]?.href ?? '/'}>
        <LogoMark size={20} onDark />
        <span aria-hidden="true">
          Volume<span>3D</span>
        </span>
        <span className="sr-only">Volume3D</span>
      </a>

      <nav className="pro-tabs" aria-label="Sections">
        {tabs.map((tab) => (
          <a
            key={tab.href}
            className="pro-tab"
            href={tab.href}
            aria-current={tab.href === current ? 'page' : undefined}
          >
            {tab.label}
            {tab.count ? (
              <span className="pro-count">
                {tab.count}
                <span className="sr-only"> à traiter</span>
              </span>
            ) : null}
          </a>
        ))}
      </nav>

      <div className="pro-bar-side">
        {who && <span className="pro-who">{who}</span>}
        {side}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------- titre de page --- */

export function ProHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="pro-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="pro-head-actions">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- chiffres --- */

export interface StatProps {
  label: string;
  value: number | string;
  /** Unité collée au chiffre — « vues », « / 5 ». */
  unit?: string;
  hint?: string;
  /** Met la tuile en alerte : quelque chose attend d'être traité. */
  alert?: boolean;
}

export function Stat({ label, value, unit, hint, alert }: StatProps) {
  return (
    <div className="pro-stat" data-alert={alert ? '1' : undefined}>
      <p className="pro-stat-label">{label}</p>
      <p className="pro-stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </p>
      {hint && <p className="pro-stat-hint">{hint}</p>}
    </div>
  );
}

export const StatBand = ({ children }: { children: ReactNode }) => (
  <div className="pro-stats">{children}</div>
);

/* ------------------------------------------------------------------ blocs --- */

export function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pro-section">
      <div className="pro-section-head">
        <h2>
          {title}
          {note && <small>{note}</small>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- état vide --- */

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  /* Le « + » n'apparaît que s'il y a quelque chose à créer. Sur un état vide
     qu'on ne peut pas remplir soi-même — les demandes reçues, par exemple — il
     promettait une action qui n'existait pas. */
  return (
    <div className="pro-empty">
      {action && (
        <span className="pro-empty-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------- barre --- */

/*
 * Une ligne mesurée : un nom, un chiffre, une barre.
 *
 * Le même dessin sert aux vues par bien et au temps passé par pièce. Ces deux
 * blocs avaient chacun leur barre, dessinée en styles en ligne, avec deux
 * hauteurs et deux fonds différents — pour la même information.
 */
export function Meter({
  label,
  note,
  share,
  href,
  tone,
}: {
  label: string;
  note?: ReactNode;
  /** Part du total, entre 0 et 1. */
  share: number;
  href?: string;
  /** « soft » pour une mesure encore trop mince pour conclure. */
  tone?: 'soft';
}) {
  const width = Math.max(2, Math.min(100, Math.round((share || 0) * 100)));
  const inner = (
    <>
      <div className="pro-meter-head">
        <span className="pro-meter-label">{label}</span>
        {note && <span className="pro-meter-note">{note}</span>}
      </div>
      <div className="pro-meter-track">
        <div className="pro-meter-fill" style={{ width: `${width}%` }} />
      </div>
    </>
  );
  const className = 'pro-meter';
  return href ? (
    <a className={className} href={href} data-tone={tone}>
      {inner}
    </a>
  ) : (
    <div className={className} data-tone={tone}>
      {inner}
    </div>
  );
}

/* --------------------------------------------------------------- étiquette --- */

export const Tag = ({ tone, children }: { tone: 'live' | 'draft' | 'warn' | 'demo'; children: ReactNode }) => (
  <span className="pro-tag" data-tone={tone}>
    {children}
  </span>
);
