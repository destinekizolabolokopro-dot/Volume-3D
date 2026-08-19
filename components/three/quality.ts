import type * as THREE from 'three';

/**
 * La qualité s'adapte à la machine, en la mesurant.
 *
 * Le passage aux matériaux physiques et à l'éclairage d'environnement a
 * multiplié par trois et demi le coût par pixel. Sur une machine récente c'est
 * invisible ; sur un téléphone de trois ans, c'est la différence entre une
 * visite fluide et un diaporama. Et on ne peut pas le savoir à l'avance : ni
 * l'agent utilisateur, ni le nombre de cœurs, ni `deviceMemory` ne disent ce
 * que le processeur graphique sait faire — un même modèle rend deux fois moins
 * vite quand la batterie est basse.
 *
 * On mesure donc, et on corrige. La résolution de rendu descend quand les
 * images tardent, remonte quand elles reviennent — jamais au-delà de ce que
 * l'écran demande. C'est le seul réglage qui rapporte beaucoup pour ce qu'il
 * coûte à l'image : un logement rendu à 80 % de la résolution garde ses lignes
 * droites et ses reflets, il perd un peu de netteté sur les arêtes. Baisser
 * l'éclairage ou l'ombre, à l'inverse, se voit tout de suite.
 *
 * La correction est lente et hystérétique : on ne change qu'au bout d'une
 * seconde de mesures concordantes, et la marche de descente est plus large que
 * celle de montée. Un réglage qui suit la moindre saccade oscille, et une
 * résolution qui oscille se voit bien plus qu'une résolution basse.
 */

/** Ce qu'on vise : soixante images par seconde laisse 16,7 ms. */
const CIBLE = 15;
/** Au-delà, on descend. En deçà, on remonte. */
const TROP_LENT = 21;
const CONFORTABLE = 11;
/** Bornes de l'échelle, en fraction de la résolution demandée par l'écran. */
const PLANCHER = 0.55;
/** Images agrégées avant chaque décision. */
const FENETRE = 45;

export interface Quality {
  /** À appeler une fois par image, avant le rendu. */
  tick(now: number): void;
  /** L'échelle courante, pour l'affichage d'un diagnostic. */
  readonly scale: number;
  dispose(): void;
}

/**
 * @param plafond Résolution maximale, en général `min(devicePixelRatio, 2)`.
 */
export function adaptQuality(
  renderer: THREE.WebGLRenderer,
  plafond: number,
): Quality {
  let echelle = 1;
  let precedent = 0;
  const releves: number[] = [];

  const appliquer = () => {
    renderer.setPixelRatio(plafond * echelle);
  };
  appliquer();

  return {
    get scale() {
      return echelle;
    },
    tick(now: number) {
      if (precedent === 0) {
        precedent = now;
        return;
      }
      const delta = now - precedent;
      precedent = now;
      /* Une image de plus de 200 ms n'est pas une image lente : c'est un onglet
         qui revient au premier plan, ou le ramasse-miettes. La compter ferait
         plonger la résolution pour rien. */
      if (delta > 200) return;
      releves.push(delta);
      if (releves.length < FENETRE) return;

      releves.sort((a, b) => a - b);
      const median = releves[Math.floor(releves.length / 2)];
      releves.length = 0;

      if (median > TROP_LENT && echelle > PLANCHER) {
        echelle = Math.max(PLANCHER, echelle * (median > CIBLE * 2 ? 0.72 : 0.86));
        appliquer();
      } else if (median < CONFORTABLE && echelle < 1) {
        echelle = Math.min(1, echelle * 1.08);
        appliquer();
      }
    },
    dispose() {
      releves.length = 0;
    },
  };
}
