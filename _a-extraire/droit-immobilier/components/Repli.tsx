'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Un bloc long, replié, avec « Voir tout » dessous.
 *
 * Trois décisions gouvernent ce composant, et elles tiennent toutes à la même
 * idée : un repli ne doit jamais faire perdre du texte.
 *
 * 1. IL MESURE AVANT DE COUPER. Le bouton n'apparaît que si le contenu dépasse
 *    vraiment la hauteur donnée. Un « Voir tout » sous une réponse de quatre
 *    lignes est une promesse vide, et la troisième fois qu'on la voit on ne
 *    clique plus nulle part.
 *
 * 2. LE TEXTE RESTE DANS LA PAGE. Rien n'est retiré du DOM : le contenu replié
 *    est simplement débordé et masqué. Un lecteur d'écran le lit, la recherche
 *    du navigateur le trouve, et un moteur l'indexe. Replier n'est pas cacher.
 *
 * 3. SANS JAVASCRIPT, TOUT EST VISIBLE. Le repli n'est posé qu'au montage.
 *    L'ordre importe : il est posé AVANT le premier affichage — avec
 *    `useLayoutEffect`, pas `useEffect` — sans quoi une longue réponse
 *    apparaîtrait en entier puis se refermerait sous les yeux du lecteur.
 *
 * Le repliement se souvient aussi de là où l'on était : rouvrir puis refermer
 * un bloc long, en haut de page, renverrait sinon la personne à un endroit du
 * texte qu'elle n'a jamais lu.
 */

/* `useLayoutEffect` n'existe pas au rendu serveur, et React s'en plaint à voix
   haute. On retombe sur `useEffect`, qui n'y sert de toute façon à rien. */
const useEffetDeMiseEnPage = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function Repli({
  children,
  hauteur = 460,
  libelle = 'Voir tout',
  libelleReplie = 'Replier',
  /** Ce qu'on annonce aux lecteurs d'écran : « la réponse », « la fiche »… */
  quoi = 'ce bloc',
}: {
  children: ReactNode;
  /** La hauteur visible tant que c'est replié, en pixels. */
  hauteur?: number;
  libelle?: string;
  libelleReplie?: string;
  quoi?: string;
}) {
  const contenu = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const [depasse, setDepasse] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const mesurer = useCallback(() => {
    const el = contenu.current;
    if (!el) return;
    /* Une marge de tolérance : couper pour trente pixels ajoute un bouton et
       n'économise rien. */
    setDepasse(el.scrollHeight > hauteur + 48);
  }, [hauteur]);

  useEffetDeMiseEnPage(mesurer, [mesurer, children]);

  /* La largeur change, le texte se recompose, la hauteur n'est plus la même.
     Un simple écouteur de redimensionnement suffit : ce contenu ne bouge pas
     tout seul une fois rendu. */
  useEffect(() => {
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [mesurer]);

  const basculer = () => {
    if (ouvert) {
      /* On referme : on ramène la personne au haut du bloc si elle l'a
         dépassé, sinon elle se retrouve au milieu d'un texte replié. */
      const haut = cadre.current?.getBoundingClientRect().top ?? 0;
      setOuvert(false);
      if (haut < 0) {
        requestAnimationFrame(() => {
          cadre.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
      }
      return;
    }
    setOuvert(true);
  };

  const replie = depasse && !ouvert;

  return (
    <div className="jur-repli" ref={cadre} data-replie={replie ? '1' : undefined}>
      <div
        className="jur-repli-corps"
        ref={contenu}
        style={replie ? { maxHeight: `${hauteur}px` } : undefined}
      >
        {children}
      </div>

      {depasse && (
        <button
          className="jur-repli-bouton"
          type="button"
          onClick={basculer}
          aria-expanded={ouvert}
        >
          {ouvert ? libelleReplie : libelle}
          <span className="sr-only"> {quoi}</span>
          <span className="jur-repli-chevron" aria-hidden="true">
            {ouvert ? '↑' : '↓'}
          </span>
        </button>
      )}
    </div>
  );
}
