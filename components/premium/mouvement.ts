/**
 * Le parallaxe, en une boucle pour toute la page.
 *
 * Un site premium bouge un peu de partout au défilement — le titre plus lentement
 * que la colonne, le chiffre plus lentement que sa légende. Fait naïvement, c'est
 * un écouteur de défilement et un `getBoundingClientRect` par élément et par
 * image : dix éléments suffisent à faire tomber un téléphone sous les trente
 * images par seconde, et le site « fluide » devient le site qui rame.
 *
 * D'où trois règles, qui sont exactement celles de la visite au défilement :
 *
 *  · **un seul écouteur**, partagé, qui ne fait que lever un drapeau ;
 *  · **aucune lecture de mise en page pendant le défilement.** La position de
 *    chaque élément est mesurée une fois, à l'inscription, puis seulement quand
 *    la page change de forme. Pendant le défilement on ne lit que `scrollY`,
 *    qui ne force aucun recalcul ;
 *  · **rien ne passe par React.** On écrit la transformation dans le style de
 *    l'élément. Un `setState` par image reconstruirait l'arbre soixante fois
 *    par seconde pour déplacer un titre de douze pixels.
 *
 * Le résultat tient dans une transformation composée : ni `top`, ni `margin`,
 * rien qui touche la mise en page.
 */

interface Suivi {
  node: HTMLElement;
  /** Fraction de l'écart au centre reportée en translation. 0,06 est déjà visible. */
  facteur: number;
  /** Centre de l'élément dans le document, mesuré hors défilement. */
  centre: number;
}

const suivis = new Set<Suivi>();
let boucle = 0;
let attente = false;
let observateur: ResizeObserver | null = null;

function mesurer(suivi: Suivi): void {
  const rect = suivi.node.getBoundingClientRect();
  suivi.centre = rect.top + window.scrollY + rect.height / 2;
}

function peindre(): void {
  attente = false;
  const regard = window.scrollY + window.innerHeight / 2;
  for (const suivi of suivis) {
    const ecart = regard - suivi.centre;
    /* Le déplacement est borné. Sans borne, un élément en haut d'une page de
       huit mille pixels part à deux cents pixels de son texte et le bloc se
       disloque. */
    const y = Math.max(-90, Math.min(90, ecart * suivi.facteur));
    suivi.node.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
  }
}

function reveiller(): void {
  if (attente) return;
  attente = true;
  boucle = requestAnimationFrame(peindre);
}

function remesurer(): void {
  for (const suivi of suivis) mesurer(suivi);
  reveiller();
}

/**
 * Inscrit un élément au parallaxe. Rend la fonction qui l'en retire.
 *
 * Sans mouvement demandé — `prefers-reduced-motion` — l'inscription ne fait
 * rien du tout : pas d'écouteur, pas de transformation, l'élément reste où la
 * mise en page l'a posé.
 */
export function suivre(node: HTMLElement, facteur: number): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined;

  const suivi: Suivi = { node, facteur, centre: 0 };
  mesurer(suivi);
  suivis.add(suivi);

  if (suivis.size === 1) {
    window.addEventListener('scroll', reveiller, { passive: true });
    window.addEventListener('resize', remesurer, { passive: true });
    /* La page grandit après coup : la fonte arrive, une image se pose, un
       bloc se révèle. Sans cet observateur, les éléments inscrits tôt gardent
       la position qu'ils avaient avant que la page ait sa hauteur définitive,
       et le parallaxe part de travers d'un demi-écran. */
    observateur = new ResizeObserver(remesurer);
    observateur.observe(document.documentElement);
  }
  reveiller();

  return () => {
    suivis.delete(suivi);
    node.style.transform = '';
    if (suivis.size > 0) return;
    window.removeEventListener('scroll', reveiller);
    window.removeEventListener('resize', remesurer);
    observateur?.disconnect();
    observateur = null;
    cancelAnimationFrame(boucle);
    attente = false;
  };
}
