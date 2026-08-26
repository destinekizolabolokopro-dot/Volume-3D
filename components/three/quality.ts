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

/*
 * Les paliers, et pourquoi la résolution ne suffit pas.
 *
 * Baisser la résolution rapporte beaucoup et se voit peu — c'est pour cela
 * qu'on commence par là. Mais elle a un plancher : en dessous de cinquante-cinq
 * pour cent, l'image devient molle et on n'a plus rien gagné à descendre
 * encore. Sur une machine qui est **toujours** trop lente à ce plancher, il
 * faut alors renoncer à des effets, et dans un ordre choisi : du moins
 * indispensable au plus indispensable.
 *
 * L'ordre est celui du coût par pixel divisé par ce que l'effet apporte :
 *
 *   0. tout — éclat, profondeur de champ, ombres portées ;
 *   1. sans éclat — trois passes plein écran en moins, et l'image reste juste,
 *      seulement moins lumineuse sur les arêtes ;
 *   2. sans profondeur de champ — deux passes de plus en moins ; on perd le
 *      signe le plus net d'une image d'objectif, mais on garde la scène ;
 *   3. sans ombres portées — c'est la marche la plus visible, et donc la
 *      dernière : une scène sans ombre est une scène sans sol. Elle n'est
 *      franchie que par les machines qui, à résolution plancher et sans aucun
 *      effet, ne tiennent toujours pas la cadence.
 *
 * On ne remonte un palier qu'après une marge confortable et **une fois** :
 * une machine qui oscille entre deux paliers montre ses ombres qui
 * apparaissent et disparaissent, ce qui est bien pire que de ne pas en avoir.
 */
export const PALIER_TOUT = 0;
export const PALIER_SANS_ECLAT = 1;
export const PALIER_SANS_FLOU = 2;
export const PALIER_SANS_OMBRE = 3;

export interface Quality {
  /** À appeler une fois par image, avant le rendu. */
  tick(now: number): void;
  /** L'échelle courante, pour l'affichage d'un diagnostic. */
  readonly scale: number;
  /** Le palier de repli courant : 0 = tout, 3 = sans ombres portées. */
  readonly palier: number;
  /**
   * Impose un palier, pour l'éprouver.
   *
   * Sans cela, le palier le plus bas n'est atteignable que sur une machine
   * assez lente pour le déclencher — c'est-à-dire jamais celle sur laquelle on
   * développe, et jamais dans un test. Un chemin de repli qu'on ne peut pas
   * exécuter est un chemin de repli qu'on n'a pas.
   */
  forcer(palier: number): void;
  dispose(): void;
}

/**
 * @param plafond Résolution maximale, en général `min(devicePixelRatio, 2)`.
 */
export function adaptQuality(
  renderer: THREE.WebGLRenderer,
  plafond: number,
  /** Appelé quand le palier change, pour que l'appelant coupe ou rallume. */
  surPalier?: (palier: number) => void,
): Quality {
  let echelle = 1;
  let palier = PALIER_TOUT;
  let precedent = 0;
  /* Combien de fenêtres de mesure consécutives passées au plancher sans
     tenir la cadence. On ne descend un palier qu'après deux : une seule peut
     être un pic de charge de la page — une fonte qui arrive, un observateur
     qui se déclenche — et non la machine. */
  let insuffisant = 0;
  const releves: number[] = [];

  const appliquer = () => {
    renderer.setPixelRatio(plafond * echelle);
  };
  appliquer();

  const changerPalier = (suivant: number) => {
    if (suivant === palier) return;
    palier = suivant;
    surPalier?.(palier);
  };

  return {
    get scale() {
      return echelle;
    },
    get palier() {
      return palier;
    },
    forcer(voulu: number) {
      changerPalier(Math.max(PALIER_TOUT, Math.min(PALIER_SANS_OMBRE, Math.round(voulu))));
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
        insuffisant = 0;
        return;
      }

      /* Au plancher et toujours trop lent : on descend d'un palier. C'est la
         seule branche qui coupe un effet, et elle demande deux fenêtres de
         mesure concordantes — soit une seconde et demie de lenteur franche. */
      if (median > TROP_LENT) {
        insuffisant += 1;
        if (insuffisant >= 2 && palier < PALIER_SANS_OMBRE) {
          changerPalier(palier + 1);
          insuffisant = 0;
        }
        return;
      }

      insuffisant = 0;

      /* On remonte la résolution avant de remonter un palier : elle se voit
         plus et elle se reprend sans à-coup. Un effet qu'on rallume, lui,
         change l'image d'un coup — donc seulement quand la marge est large. */
      if (median < CONFORTABLE && echelle < 1) {
        echelle = Math.min(1, echelle * 1.08);
        appliquer();
      } else if (median < CONFORTABLE * 0.72 && echelle >= 1 && palier > PALIER_TOUT) {
        changerPalier(palier - 1);
      }
    },
    dispose() {
      releves.length = 0;
    },
  };
}
