/**
 * Le sceau — la marque d'Immolex.
 *
 * Un cachet gravé : double anneau, monogramme au centre, une étoile en haut
 * et une en bas. C'est le geste qu'on pose au bas d'un acte, et c'est le seul
 * signe que ce métier ait vraiment à lui.
 *
 * Il est dessiné, pas écrit. Une lettre dans un carré arrondi est ce que fait
 * tout le monde, et cela ne se reconnaît pas de loin ; un disque gravé se
 * reconnaît à seize pixels comme à quatre-vingt-dix, ce qui est exactement ce
 * qu'on demande à une marque — un onglet de navigateur, une favicon, un en-tête
 * de courriel et un pied de page n'ont pas la même place à lui donner.
 *
 * Les couleurs sont passées en propriété plutôt que prises aux jetons : le
 * sceau doit pouvoir se poser sur le papier comme sur l'encre, et `currentColor`
 * ne suffit pas — l'anneau et la lettre n'ont pas la même valeur.
 */
export function Sceau({
  taille = 36,
  trait = 'var(--accent)',
  lettre = 'var(--accent)',
  className,
}: {
  taille?: number;
  trait?: string;
  lettre?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="50" cy="50" r="47" fill="none" stroke={trait} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="39.5" fill="none" stroke={trait} strokeWidth="1" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Bodoni Moda, Didot, Times New Roman, serif"
        fontSize="40"
        fontWeight="500"
        fill={lettre}
      >
        IM
      </text>
      {/* Les deux étoiles ferment le champ du sceau en haut et en bas, comme
          la couronne d'un cachet officiel. Sous 24 px elles disparaissent dans
          l'anneau : c'est le seul détail que le petit format perd. */}
      <path
        d="M50 12.5 l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z"
        fill={trait}
      />
      <path
        d="M50 72.8 l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z"
        fill={trait}
      />
    </svg>
  );
}
