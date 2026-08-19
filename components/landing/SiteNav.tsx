'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/Logo';

const LINKS = [
  { href: '/demonstration', label: 'Démonstration' },
  { href: '#resultats', label: 'Résultats' },
  { href: '#fonctionnement', label: 'Fonctionnement' },
  { href: '#tarifs', label: 'Tarifs' },
];

export interface SiteNavProps {
  /**
   * Sélecteur de la zone sombre que la barre survole. Tant que le bas de cette
   * zone est sous la barre, celle-ci se met en clair sur transparent.
   */
  darkUntil?: string;
}

/**
 * Barre de navigation.
 *
 * Elle ne fait que deux choses : poser un filet une fois la page défilée, et
 * ouvrir une liste de liens sur petit écran. Le `scrollY` est comparé à une
 * constante, ce qui n'impose jamais de recalcul de mise en page.
 */
export function SiteNav({ darkUntil }: SiteNavProps = {}) {
  const [stuck, setStuck] = useState(false);
  const [dark, setDark] = useState(Boolean(darkUntil));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const evaluate = () => {
      ticking = false;
      setStuck(window.scrollY > 8);
      /* Une barre blanche posée sur la visite couperait le premier écran en
         deux. Elle reste donc transparente tant qu'elle survole le sombre, et
         reprend son fond clair dès qu'elle passe sur le reste de la page. */
      if (!darkUntil) return;
      const zone = document.querySelector(darkUntil);
      setDark(zone ? zone.getBoundingClientRect().bottom > 62 : false);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(evaluate);
    };
    evaluate();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [darkUntil]);

  return (
    <header className="nav" data-stuck={stuck ? '1' : undefined} data-dark={dark ? '1' : undefined}>
      <div className="nav-inner">
        <a className="brand" href="#haut">
          <LogoMark size={22} onDark={dark} />
          <span className="brand-name">
            Volume<span>3D</span>
          </span>
        </a>

        <nav className="nav-links" aria-label="Sections du site">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="nav-side">
          <a className="sign-in" href="/espace">
            Connexion
          </a>
          <a className="btn btn-accent btn-sm" href="#rendez-vous">
            Prendre rendez-vous
          </a>
          <button
            type="button"
            className="nav-burger"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className="nav-sheet" id="menu-mobile" data-open={open ? '1' : undefined}>
        <ul>
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a href="/espace" onClick={() => setOpen(false)}>
              Connexion
            </a>
          </li>
          <li>
            <a className="btn btn-accent btn-block" href="#rendez-vous" onClick={() => setOpen(false)}>
              Prendre rendez-vous
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
