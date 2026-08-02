'use client';

import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/Logo';

/** Les mêmes ancres servent à la barre haute et au menu plein écran. */
const LINKS = [
  { href: '#seuil', label: 'La différence' },
  { href: '#methode', label: 'La méthode' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '/espace', label: 'Mon espace' },
];

/**
 * Barre haute, menu plein écran (mobile) et rappel d'action bas d'écran.
 *
 * Les trois dépendent du même signal — « a-t-on quitté le héros ? » — donc ils
 * partagent un unique écouteur de défilement, cadencé par requestAnimationFrame.
 * Aucun de ces éléments ne lit la géométrie du document : on ne compare qu'un
 * `scrollY` à une fraction de la hauteur de fenêtre, ce qui n'impose jamais de
 * recalcul de mise en page.
 */
export function SiteChrome() {
  const [past, setPast] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let ticking = false;
    const evaluate = () => {
      ticking = false;
      setPast(window.scrollY > window.innerHeight * 0.62);
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

  // Menu ouvert : la page dessous ne défile plus, et Échap referme.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const close = () => {
    setMenuOpen(false);
    openerRef.current?.focus();
  };

  return (
    <>
      <header className="site-head" data-solid={past ? '1' : undefined}>
        <a className="mark" href="#accueil" aria-label="Volume3D — accueil">
          <LogoMark size={26} adaptive />
          <span className="mark-name">
            Volume<i>3D</i>
          </span>
        </a>

        <nav className="site-nav" aria-label="Navigation principale">
          {LINKS.map((link) => (
            <a key={link.href} className="hide-sm" href={link.href}>
              {link.label}
            </a>
          ))}
          <a className="cta hide-xs" href="#contact">
            Prendre rendez-vous
          </a>
          <button
            ref={openerRef}
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="menu-plein-ecran"
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true" />
            <span className="sr-only">Ouvrir le menu</span>
          </button>
        </nav>
      </header>

      <div id="menu-plein-ecran" className="menu-sheet" data-open={menuOpen ? '1' : undefined}>
        <div className="menu-top">
          <span className="mark-name">
            Volume<i>3D</i>
          </span>
          <button type="button" className="menu-close" onClick={close}>
            <span aria-hidden="true">Fermer</span>
            <span className="sr-only">Fermer le menu</span>
          </button>
        </div>
        <nav aria-label="Navigation">
          <ul>
            {LINKS.map((link, index) => (
              <li key={link.href} style={{ '--menu-delay': `${90 + index * 70}ms` } as React.CSSProperties}>
                <a href={link.href} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="cta cta-light" href="#contact" onClick={() => setMenuOpen(false)}>
          Prendre rendez-vous
        </a>
      </div>

      {/* Sur téléphone, le bouton du héros disparaît au défilement : ce rappel
          le remet à portée de pouce, sans jamais couvrir le contenu lu. */}
      <div className="rail-mobile" data-shown={past ? '1' : undefined} aria-hidden={!past}>
        <span>Visite livrée sous 48h</span>
        <a className="cta" href="#contact" tabIndex={past ? undefined : -1}>
          Rendez-vous
        </a>
      </div>
    </>
  );
}
