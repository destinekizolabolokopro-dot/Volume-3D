'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/Logo';

const LINKS = [
  { href: '#demonstration', label: 'Démonstration' },
  { href: '#resultats', label: 'Résultats' },
  { href: '#fonctionnement', label: 'Fonctionnement' },
  { href: '#tarifs', label: 'Tarifs' },
];

/**
 * Barre de navigation.
 *
 * Elle ne fait que deux choses : poser un filet une fois la page défilée, et
 * ouvrir une liste de liens sur petit écran. Le `scrollY` est comparé à une
 * constante, ce qui n'impose jamais de recalcul de mise en page.
 */
export function SiteNav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const evaluate = () => {
      ticking = false;
      setStuck(window.scrollY > 8);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(evaluate);
    };
    evaluate();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="nav" data-stuck={stuck ? '1' : undefined}>
      <div className="nav-inner">
        <a className="brand" href="#haut">
          <LogoMark size={22} />
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
            Demander un scan
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
              Demander un scan
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
