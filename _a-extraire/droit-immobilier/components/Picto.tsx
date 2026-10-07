/**
 * Les quatre marques dessinées.
 *
 * Elles remplacent des emoji — un trombone, un micro — et deux symboles de
 * lecteur audio. Trois raisons, dont une seule est esthétique.
 *
 * Un emoji n'est pas un dessin, c'est un CARACTÈRE, rendu par une police que
 * le système choisit : le même trombone est gris sur Windows, jaune sur
 * Android, bleu sur iOS, et absent d'un navigateur ancien, qui affiche alors
 * un rectangle. Un site qui tient à sa typographie ne peut pas laisser trois
 * systèmes décider de la moitié de ses icônes.
 *
 * Ils ne prennent pas non plus la couleur du texte : à côté d'un lien
 * d'accent ou d'un bouton sombre, ils restent de leur couleur à eux, et le
 * bouton se met à ressembler à un collage.
 *
 * Et le registre est faux. Ce service donne des délais à quelqu'un dont le
 * locataire est parti sans payer ; un micro en couleurs, au milieu de ça,
 * dit « application » là où tout le reste dit « étude ».
 *
 * Elles sont donc tracées ici, au trait, à la couleur du texte courant, et
 * masquées aux lecteurs d'écran : le sens est dans le libellé qui les
 * accompagne, jamais dans le dessin.
 */

import type { SVGProps } from 'react';

const COMMUN: SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

/** Le trombone du dépôt de pièce. */
export function Trombone({ taille = 15 }: { taille?: number }) {
  return (
    <svg
      {...COMMUN}
      className="jur-picto"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      strokeWidth="1.5"
    >
      <path d="M17 8.5v7.2a5 5 0 0 1-10 0V6.8a3.2 3.2 0 0 1 6.4 0v8.7a1.5 1.5 0 0 1-3 0V8.5" />
    </svg>
  );
}

/** Le micro de la dictée. */
export function Micro({ taille = 15 }: { taille?: number }) {
  return (
    <svg
      {...COMMUN}
      className="jur-picto"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      strokeWidth="1.5"
    >
      <rect x="9.25" y="2.75" width="5.5" height="11" rx="2.75" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.2M9 21.2h6" />
    </svg>
  );
}

/**
 * Le triangle de lecture. Nommé « Jouer » et non « Lecture » : ce dernier est
 * déjà le composant qui lit la réponse à voix haute, et deux choses du même
 * nom dans le même dossier finissent par se confondre à l'import.
 *
 * Rempli, et c'est le seul du lot : un triangle au trait se lit comme une
 * forme, un triangle plein se lit comme un bouton. C'est la convention de
 * tous les lecteurs depuis cinquante ans, et ce n'est pas l'endroit où
 * inventer autre chose.
 */
export function Jouer({ taille = 13 }: { taille?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="jur-picto"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8 4.8 19 12 8 19.2z" />
    </svg>
  );
}

/** Le carré d'arrêt. */
export function Arret({ taille = 13 }: { taille?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="jur-picto"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}
