/**
 * Les matières, fabriquées par le code.
 *
 * Chaque surface de la scène était un aplat : une couleur, une rugosité, rien
 * d'autre. C'était le parti « maquette » d'une passe précédente, et il ne tient
 * pas dès qu'on demande du réalisme, pour une raison qu'aucun réglage de
 * lumière ne contourne : **une surface parfaitement uniforme n'existe pas.** Un
 * parquet a des lames, un lin a une trame, un enduit a un grain, un béton a des
 * taches. L'œil ne sait pas nommer ces choses, mais il sait immédiatement
 * qu'elles manquent — et il appelle cela « de la synthèse ».
 *
 * Rien n'est chargé depuis le réseau. Tout est calculé dans un canevas, étalé
 * sur les premières images de la page — voir `Chantier` plus bas pour le
 * pourquoi de l'étalement. Trois raisons à ce calcul :
 *
 *  - **Le poids.** Huit matières en trois cartes chacune feraient plusieurs
 *    mégaoctets de fichiers. Ici, c'est un fichier de code.
 *  - **La cohérence.** Les couleurs de la scène sont mesurées et vérifiées par
 *    `npm run palette`. Une texture téléchargée les remplacerait ; une texture
 *    calculée est construite pour **moduler** la couleur du matériau sans
 *    jamais la déplacer.
 *  - **Le raccord.** Une texture doit se répéter sans qu'on voie la couture.
 *    Un bruit calculé sur un réseau périodique se répète exactement ; un
 *    fichier photographique, presque jamais.
 *
 * Chaque famille rend trois cartes tirées du **même champ de hauteur**, ce qui
 * est la seule façon d'obtenir une matière crédible : la couleur, la brillance
 * et le relief d'un vrai matériau ne sont pas trois hasards indépendants — un
 * creux du parquet est plus sombre, plus mat et plus bas. Trois bruits
 * distincts donneraient trois motifs superposés, c'est-à-dire de la saleté.
 *
 * ---
 *
 * **Ce fichier a été réécrit après avoir regardé ce qu'il produisait.**
 *
 * `npm run matieres` sort une planche contact des vingt-quatre cartes à leur
 * taille réelle. La première version y est apparue pour ce qu'elle était :
 * presque entièrement blanche. Trois fautes, dont aucune ne se voyait dans une
 * scène — et c'est bien le problème, on ne juge pas une texture à trois mètres,
 * sous une lumière rasante, derrière une profondeur de champ.
 *
 *  1. **L'étirement détruisait le bruit.** Il divisait la coordonnée
 *     d'échantillonnage : avec quatre cellules et un étirement de neuf, le
 *     motif variait sur moins d'une demi-cellule d'un bord à l'autre de la
 *     texture — donc il ne variait pas. Et il faisait perdre la périodicité au
 *     passage. On étire maintenant en **allongeant le réseau**, pas en divisant
 *     la coordonnée : trois cellules dans un sens, quarante-huit dans l'autre.
 *     Le nombre de cellules reste entier, donc le raccord reste exact.
 *
 *  2. **La carte de couleur saturait.** Elle était centrée sur le blanc, donc
 *     la moitié claire de sa variation dépassait un et se faisait écrêter. Il ne
 *     restait qu'une demi-amplitude, sur une amplitude déjà petite. Elle
 *     n'assombrit plus que — et la couleur du matériau est relevée d'autant,
 *     pour que la moyenne rendue reste celle qui a été mesurée.
 *
 *  3. **Les motifs n'étaient pas les bons motifs.** Un parquet dont les lames
 *     ne s'arrêtent jamais est un bardage. Un marbre veiné au bruit lisse est
 *     une tache. Un béton sans granulat est du papier. Chaque famille a
 *     maintenant sa construction propre, écrite à la main.
 */

import * as THREE from 'three';

/* ================================================================ bruit === */

/**
 * Un réseau de valeurs aléatoires, **anisotrope**.
 *
 * Deux nombres de cellules et non un : c'est ce qui permet d'étirer un motif
 * sans toucher aux coordonnées, donc sans perdre la périodicité. Un fil de
 * bois, c'est trois cellules en travers et quarante-huit dans le sens du fil.
 */
function reseau(cx: number, cy: number, graine: number): Float32Array {
  const valeurs = new Float32Array(cx * cy);
  let etat = (graine >>> 0) || 1;
  for (let i = 0; i < valeurs.length; i += 1) {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    valeurs[i] = etat / 4294967296;
  }
  return valeurs;
}

const lisser = (t: number) => t * t * (3 - 2 * t);

/** Échantillonne le réseau en coordonnées de cellule, en bouclant sur les deux axes. */
function echantillon(
  valeurs: Float32Array,
  cx: number,
  cy: number,
  x: number,
  y: number,
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = lisser(x - ix);
  const fy = lisser(y - iy);
  const x0 = ((ix % cx) + cx) % cx;
  const y0 = ((iy % cy) + cy) % cy;
  const x1 = (x0 + 1) % cx;
  const y1 = (y0 + 1) % cy;
  const a = valeurs[y0 * cx + x0];
  const b = valeurs[y0 * cx + x1];
  const c = valeurs[y1 * cx + x0];
  const d = valeurs[y1 * cx + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Un champ de bruit fractal anisotrope, entre 0 et 1.
 *
 * `u` et `v` sont en tours de texture (0 à 1). Chaque octave double les deux
 * nombres de cellules, ce qui préserve l'anisotropie de départ et la
 * périodicité.
 */
function fractal(cx: number, cy: number, octaves: number, graine: number) {
  const couches: { valeurs: Float32Array; cx: number; cy: number; poids: number }[] = [];
  let poids = 1;
  let total = 0;
  for (let o = 0; o < octaves; o += 1) {
    const ax = cx * 2 ** o;
    const ay = cy * 2 ** o;
    couches.push({ valeurs: reseau(ax, ay, graine + o * 7919), cx: ax, cy: ay, poids });
    total += poids;
    poids *= 0.5;
  }
  return (u: number, v: number) => {
    let somme = 0;
    for (const c of couches) somme += c.poids * echantillon(c.valeurs, c.cx, c.cy, u * c.cx, v * c.cy);
    return somme / total;
  };
}

/**
 * Un bruit en crêtes.
 *
 * `1 − |2n − 1|` transforme les passages par la moyenne en arêtes vives. C'est
 * la brique de toutes les veines : un bruit lisse donne des taches, un bruit en
 * crêtes donne des lignes qui se rejoignent et se séparent, ce que fait
 * exactement une veine de marbre ou un fil de bois.
 */
const crete = (n: number) => 1 - Math.abs(2 * n - 1);

/* =============================================================== cartes === */

/**
 * Une carte vivante : le canevas existe tout de suite, son contenu arrive plus tard.
 *
 * `moyenne` est la valeur que la carte aurait **en moyenne** une fois
 * calculée. Le canevas en est rempli d'emblée, si bien que la scène est juste
 * dès la première image — simplement uniforme — et se détaille ensuite sans
 * qu'aucune couleur ne bouge. Un blanc franc aurait éclairci toutes les
 * surfaces le temps du calcul, puis les aurait vues s'assombrir d'un coup :
 * un défaut visible, là où celui-ci ne l'est pas.
 */
class Carte {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  readonly data: Uint8ClampedArray;

  constructor(taille: number, moyenne: [number, number, number]) {
    const canvas = document.createElement('canvas');
    canvas.width = taille;
    canvas.height = taille;
    this.ctx = canvas.getContext('2d')!;
    this.image = this.ctx.createImageData(taille, taille);
    this.data = this.image.data;
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = moyenne[0];
      this.data[i + 1] = moyenne[1];
      this.data[i + 2] = moyenne[2];
      this.data[i + 3] = 255;
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    /* Les coordonnées viennent d'une projection du monde et peuvent valoir des
       dizaines : sans anisotropie, un sol vu en fuite se réduit à un moiré. */
    this.texture.anisotropy = 4;
  }

  /** Publie ce qui a été écrit depuis le dernier appel. */
  publier() {
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.needsUpdate = true;
  }
}

/* ============================================================= chantier === */

/**
 * La file des travaux, et pourquoi elle existe.
 *
 * Les huit familles en trois cartes coûtaient **onze cent soixante-huit
 * millisecondes** en un seul bloc, mesurées par `npm run demarrage`. Pendant ce
 * temps le fil principal ne rend pas la main : la page ne défile pas, le
 * curseur ne répond pas, l'écran d'ouverture ne s'anime pas. C'est très
 * exactement ce que le visiteur appelle « ça bugue », et aucune optimisation du
 * calcul lui-même n'y changeait rien — un travail de plus d'une seconde fige
 * une page, qu'il soit efficace ou non.
 *
 * Le travail est donc découpé en tranches de quelques lignes, rangées dans une
 * file, et la boucle de rendu en consomme **ce qu'un budget par image lui
 * permet**. Le total ne baisse pas ; il cesse d'être un blocage.
 */
type Tache = () => void;

class Chantier {
  private file: Tache[] = [];
  private tete = 0;

  tache(t: Tache) {
    this.file.push(t);
  }

  /** Découpe une passe par pixel en bandes de lignes. */
  bandes(taille: number, lignesParTache: number, passe: (y0: number, y1: number) => void) {
    for (let y = 0; y < taille; y += lignesParTache) {
      const debut = y;
      const fin = Math.min(taille, y + lignesParTache);
      this.file.push(() => passe(debut, fin));
    }
  }

  get fini() {
    return this.tete >= this.file.length;
  }

  /** Consomme la file tant que le budget tient. Rend `true` quand tout est fait. */
  avancer(budget: number): boolean {
    const limite = performance.now() + budget;
    while (this.tete < this.file.length) {
      this.file[this.tete]();
      this.tete += 1;
      if (performance.now() >= limite) break;
    }
    if (this.fini) this.file = [];
    return this.fini;
  }
}

export interface Matiere {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
  /** Répétitions par mètre, à écrire dans `userData.tuile` du matériau. */
  tuile: number;
  /** Amplitude de l'assombrissement moyen, pour compenser la couleur de base. */
  teinte: number;
  dispose(): void;
}

/**
 * Fabrique les trois cartes d'une famille à partir d'un champ de hauteur.
 *
 * @param teinte Amplitude de la variation de couleur. La carte va de
 *   `1 − teinte` à `1` : elle **n'assombrit que**. C'est imposé par le format —
 *   un octet ne dépasse pas un — et c'était la faute de la première version,
 *   qui centrait la variation sur le blanc et en perdait la moitié à
 *   l'écrêtage. La couleur du matériau est relevée de `teinte / 2` pour que la
 *   moyenne rendue reste la couleur mesurée.
 * @param mat Amplitude de la variation de rugosité, même principe.
 * @param relief Force du relief. Il ne déplace rien — il incline la normale,
 *   donc il change la façon dont la lumière frappe. C'est de très loin la plus
 *   rentable des trois cartes, et la seule qui survive à un éclairage plat.
 */
function famille(
  taille: number,
  source: Champ,
  teinte: number,
  mat: number,
  relief: number,
  tuile: number,
  chantier: Chantier,
): Matiere {
  /* Le champ d'abord, puis les trois cartes qui le lisent. L'ordre est celui
     de la file, donc celui de l'exécution : aucune carte ne lit du vide. */
  for (const tranche of source.tranches) chantier.tache(tranche);
  const champ = source.data;
  /* Seize lignes par tranche : à cinq cent douze de côté cela fait trente-deux
     tranches par passe, de l'ordre de deux millisecondes chacune. Assez court
     pour qu'une tranche ne se voie jamais, assez long pour que l'appel de
     fonction ne pèse rien devant. */
  const TRANCHE = 16;

  const map = new Carte(taille, [255 * (1 - teinte / 2), 255 * (1 - teinte / 2), 255 * (1 - teinte / 2)]);
  chantier.bandes(taille, TRANCHE, (y0, y1) => {
    for (let i = y0 * taille; i < y1 * taille; i += 1) {
      const k = 255 * (1 - teinte + teinte * champ[i]);
      map.data[i * 4] = k;
      map.data[i * 4 + 1] = k;
      map.data[i * 4 + 2] = k;
    }
  });
  chantier.tache(() => map.publier());

  const roughnessMap = new Carte(taille, [255, 255 * (1 - mat / 2), 255]);
  chantier.bandes(taille, TRANCHE, (y0, y1) => {
    for (let i = y0 * taille; i < y1 * taille; i += 1) {
      /* Le creux est **plus mat** que la crête : c'est là que la poussière se
         dépose et que le vernis s'use le moins. L'inverse donne des surfaces
         qui brillent dans leurs rayures, ce qui se lit comme du plastique. */
      roughnessMap.data[i * 4 + 1] = 255 * (1 - mat + mat * champ[i]);
    }
  });
  chantier.tache(() => roughnessMap.publier());

  /* Une carte de relief neutre est le bleu franc : normale droite. */
  const normalMap = new Carte(taille, [127.5, 127.5, 255]);
  chantier.bandes(taille, TRANCHE, (y0, y1) => {
    const g = (px: number, py: number) =>
      champ[(((py % taille) + taille) % taille) * taille + (((px % taille) + taille) % taille)];
    for (let y = y0; y < y1; y += 1) {
      for (let x = 0; x < taille; x += 1) {
        /* Différences centrées, en bouclant sur les bords : une carte de relief
           dont les bords ne bouclent pas dessine une grille de rainures à
           chaque raccord de tuile. */
        const dx = (g(x + 1, y) - g(x - 1, y)) * relief;
        const dy = (g(x, y + 1) - g(x, y - 1)) * relief;
        const norme = Math.sqrt(dx * dx + dy * dy + 1);
        const i = y * taille + x;
        normalMap.data[i * 4] = ((-dx / norme) * 0.5 + 0.5) * 255;
        normalMap.data[i * 4 + 1] = ((-dy / norme) * 0.5 + 0.5) * 255;
        normalMap.data[i * 4 + 2] = (1 / norme) * 0.5 * 255 + 127.5;
      }
    }
  });
  chantier.tache(() => normalMap.publier());

  return {
    map: map.texture,
    roughnessMap: roughnessMap.texture,
    normalMap: normalMap.texture,
    tuile,
    teinte,
    dispose() {
      map.texture.dispose();
      roughnessMap.texture.dispose();
      normalMap.texture.dispose();
    },
  };
}

/**
 * Un champ de hauteur, réservé mais pas encore calculé.
 *
 * Le tableau existe tout de suite, vide ; son calcul est découpé en tranches
 * que `famille` enfilera **juste avant** ses propres passes. C'est ce qui
 * donne l'ordre : chaque matière est finie avant que la suivante ne commence,
 * au lieu que les huit champs se calculent d'abord et que les vingt-quatre
 * cartes n'arrivent qu'ensuite. Quelqu'un qui fait défiler tout de suite voit
 * alors le parquet prendre son grain, puis le lin, puis l'enduit — et non huit
 * surfaces uniformes pendant deux secondes suivies de tout d'un coup.
 */
interface Champ {
  data: Float32Array;
  tranches: (() => void)[];
}

function champ(taille: number, f: (u: number, v: number) => number): Champ {
  const data = new Float32Array(taille * taille);
  const tranches: (() => void)[] = [];
  for (let y = 0; y < taille; y += 16) {
    const debut = y;
    const fin = Math.min(taille, y + 16);
    tranches.push(() => {
      for (let ligne = debut; ligne < fin; ligne += 1) {
        for (let x = 0; x < taille; x += 1) {
          data[ligne * taille + x] = Math.max(0, Math.min(1, f(x / taille, ligne / taille)));
        }
      }
    });
  }
  return { data, tranches };
}

/* ============================================================ familles === */

export interface Matieres {
  parquet: Matiere;
  bois: Matiere;
  lin: Matiere;
  enduit: Matiere;
  beton: Matiere;
  pierre: Matiere;
  marbre: Matiere;
  metal: Matiere;
  /**
   * Fabrique les cartes, `budget` millisecondes à la fois.
   *
   * À appeler une fois par image tant qu'elle rend `false`. Les cartes sont
   * déjà branchées sur les matériaux avant le premier appel — elles y sont
   * simplement uniformes, à la bonne moyenne — donc rien n'attend rien.
   */
  avancer(budget: number): boolean;
  /** Vrai quand la file est vide. */
  readonly pret: boolean;
  dispose(): void;
}

/** Un hachage entier stable, pour les valeurs « par lame » ou « par rang ». */
function hache(n: number): number {
  let x = (n * 374761393 + 668265263) >>> 0;
  x = ((x ^ (x >>> 13)) * 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Toutes les matières de la scène.
 *
 * Deux règles se dégagent des allers-retours à la planche contact, et méritent
 * d'être écrites :
 *
 * **La teinte reste faible partout.** C'est la carte qu'on est tenté de
 * pousser, parce que c'est celle qu'on voit en regardant la texture seule. Mais
 * une texture ne se regarde jamais seule : elle se regarde sur un objet, sous
 * une lumière, à trois mètres. À cette distance, une variation de couleur de
 * vingt pour cent ne fait pas « du bois », elle fait « du bois sale ».
 *
 * **Le relief fait le travail.** C'est la carte qui coûte le moins à la lecture
 * — elle ne change aucune couleur — et qui rapporte le plus, parce qu'elle est
 * la seule qui réagisse au déplacement de la caméra. Une matière dont le grain
 * s'allume et s'éteint quand on bouge est une matière ; une matière peinte
 * reste un dessin.
 */
export function creerMatieres(leger: boolean): Matieres {
  /* Deux cent cinquante-six pixels sur les petites machines, cinq cent douze
     ailleurs. Le coût est au démarrage et il est mesurable. */
  const T = leger ? 256 : 512;
  const chantier = new Chantier();

  /* ---------------------------------------------------------- parquet --- */
  /*
   * Deux mètres par tuile, dix lames de vingt centimètres, et — c'est le point
   * — des **abouts**. Une lame qui ne s'arrête jamais n'est pas une lame de
   * parquet, c'est une planche de bardage, et c'est exactement ce que la
   * première version dessinait. Chaque rang porte son décalage propre, donc
   * les abouts ne s'alignent pas d'un rang à l'autre.
   */
  const filParquet = fractal(3, 40, 3, 4021);
  const poresParquet = fractal(8, 220, 2, 991);
  const parquet = champ(T, (u, v) => {
    const RANGS = 10;
    const rang = Math.floor(v * RANGS);
    const dansRang = v * RANGS - rang;
    /* Deux abouts par tuile et par rang, décalés d'un rang à l'autre : le
       décalage vient d'un hachage du rang, donc il ne se répète pas. */
    const decale = hache(rang * 3 + 1);
    const long = (u + decale) * 2;
    const dansLame = long - Math.floor(long);

    // Les joints : trois centièmes de lame en travers, un centième en long.
    const joint =
      Math.max(
        dansRang < 0.035 ? 1 - dansRang / 0.035 : 0,
        dansRang > 0.965 ? (dansRang - 0.965) / 0.035 : 0,
      ) * 1.0;
    const about = dansLame < 0.012 ? 1 - dansLame / 0.012 : dansLame > 0.988 ? (dansLame - 0.988) / 0.012 : 0;

    // Le ton propre de chaque lame : c'est ce qui fait qu'on les compte.
    const teinteLame = 0.34 + 0.32 * hache(rang * 17 + Math.floor(long) * 53);
    // Le fil, dans le sens de la lame, plus les pores.
    const fil = crete(filParquet(u, v)) * 0.34;
    const pores = poresParquet(u, v) * 0.14;

    return teinteLame + fil + pores - 0.9 * Math.max(joint, about);
  });

  /* ------------------------------------------------------------- bois --- */
  /*
   * Le bois de menuiserie : pas de lames, mais une figure. Un bruit en crêtes
   * dont on déforme la coordonnée par un second bruit — la déformation de
   * domaine — donne les arceaux d'un débit sur dosse. Sans elle, on obtient des
   * lignes parallèles, c'est-à-dire du contreplaqué.
   */
  const figure = fractal(3, 26, 3, 7717);
  const ondeBois = fractal(4, 9, 2, 313);
  const poresBois = fractal(6, 180, 2, 5501);
  const bois = champ(T, (u, v) => {
    const w = v + (ondeBois(u, v) - 0.5) * 0.22;
    /* Trente pour cent d'amplitude et non quarante : la figure du bois est
       la plus basse fréquence de toutes les matières, donc la plus visible
       une fois inclinée en normale. */
    return 0.36 + 0.3 * crete(figure(u, w)) + 0.16 * poresBois(u, v);
  });

  /* -------------------------------------------------------------- lin --- */
  /*
   * Vingt centimètres par tuile, vingt-six fils. Le tissage est un produit et
   * non une somme : une trame est un croisement, donc un maximum aux nœuds et
   * un creux entre eux dans les deux directions. L'épaisseur de chaque fil
   * varie — ce sont les flammes du lin, et sans elles on obtient du nylon.
   */
  const flammes = fractal(24, 24, 2, 8123);
  const lin = champ(T, (u, v) => {
    const FILS = 26;
    const epaisseurU = 0.7 + 0.6 * hache(Math.floor(u * FILS) * 31 + 7);
    const epaisseurV = 0.7 + 0.6 * hache(Math.floor(v * FILS) * 47 + 3);
    const chaine = Math.abs(Math.sin(u * FILS * Math.PI)) ** (1 / epaisseurU);
    const trame = Math.abs(Math.sin(v * FILS * Math.PI)) ** (1 / epaisseurV);
    return 0.34 + 0.42 * chaine * trame + 0.2 * flammes(u, v);
  });

  /* ----------------------------------------------------------- enduit --- */
  /*
   * Presque rien, et c'est le but. Un mur peint dont on voit la texture est un
   * mur mal peint ; un mur peint dont on ne voit rien du tout est un mur de
   * synthèse. La différence tient à trois pour cent — mais il faut que ces
   * trois pour cent existent, et dans la première version ils avaient été
   * mangés par l'écrêtage.
   */
  const peau = fractal(6, 6, 4, 31337);
  const grain = fractal(64, 64, 2, 4242);
  const enduit = champ(T, (u, v) => 0.3 + 0.42 * peau(u, v) + 0.28 * grain(u, v));

  /* ------------------------------------------------------------ béton --- */
  /*
   * Quatre mètres et demi par tuile : des taches larges, un granulat fin, et
   * les lignes de banche. Ce sont elles qui disent « coulé en place » — un
   * béton sans reprise de coffrage est une pierre reconstituée.
   */
  const taches = fractal(4, 4, 4, 5150);
  const granulat = fractal(90, 90, 1, 6600);
  const beton = champ(T, (u, v) => {
    const banche = Math.abs(((v * 3) % 1) - 0.5) > 0.487 ? 0.1 : 0;
    /* Le granulat n'apparaît que là où la laitance a été poncée : on ne le
       montre qu'au-dessus d'un seuil, sinon la surface devient du grès. */
    const points = Math.max(0, granulat(u, v) - 0.62) * 1.6;
    return 0.36 + 0.38 * taches(u, v) + points - banche;
  });

  /* ----------------------------------------------------------- pierre --- */
  /* Une pierre claire de salle de bains : un litage très doux, un piquetage
     fin. Rien de spectaculaire — c'est une pierre, pas un marbre. */
  const litage = fractal(3, 14, 3, 606);
  const piquetage = fractal(70, 70, 1, 808);
  const pierre = champ(T, (u, v) => 0.32 + 0.42 * litage(u, v) + 0.26 * piquetage(u, v));

  /* ----------------------------------------------------------- marbre --- */
  /*
   * Les veines : un bruit en crêtes, à la coordonnée déformée par un second
   * bruit de grande échelle. C'est ce qui les fait se rejoindre, se séparer et
   * changer de direction — un bruit lisse étiré donne des traînées parallèles,
   * qui ne sont pas des veines.
   *
   * Deux réseaux superposés : les grandes veines et les filaments. C'est le
   * seul endroit où la couleur mène et où le relief suit — une veine de marbre
   * poli ne se sent pas sous le doigt.
   */
  const veines = fractal(4, 3, 3, 99);
  const derive = fractal(3, 3, 2, 4477);
  const filaments = fractal(11, 8, 2, 1213);
  const marbre = champ(T, (u, v) => {
    const dx = (derive(u, v) - 0.5) * 0.5;
    const dy = (derive(v, u) - 0.5) * 0.5;
    const grande = crete(veines(u + dx, v + dy)) ** 3;
    const fine = crete(filaments(u + dx * 0.4, v + dy * 0.4)) ** 6;
    return 0.82 - 0.5 * grande - 0.28 * fine;
  });

  /* ------------------------------------------------------------ métal --- */
  /* Le brossage : un réseau extrêmement allongé, donc des rayures parallèles
     très fines. Deux cellules en travers, deux cent cinquante-six dans le sens
     du brossage. */
  const brosse = fractal(2, 256, 1, 8080);
  const metal = champ(T, (u, v) => 0.4 + 0.6 * brosse(u, v));

  const familles = {
    /* Le parquet : la matière la plus regardée de la page — elle occupe le bas
       de six écrans sur dix — et celle qui porte le plus de relief, parce que
       ses joints sont de vraies rainures. */
    /*
     * Les forces de relief, retenues après une capture qui les a montrées
     * pour ce qu'elles étaient.
     *
     * Le premier jeu était deux à trois fois trop fort, et le défaut ne se
     * voit **que sur les grandes surfaces planes vues en fuite** : la table à
     * manger, deux mètres quatre-vingts de bois sous une suspension, sortait
     * ondulée comme une surface d'eau. La raison est mécanique — la carte de
     * relief incline la normale d'autant plus que le champ varie vite, et une
     * figure de bois est faite de larges ondes ; amplifiée, elle devient une
     * houle.
     *
     * La règle qu'on en tire : le relief doit être réglé sur **la plus grande
     * pièce** faite de cette matière, pas sur la vignette de texture. Un grain
     * qu'on distingue à peine sur un échantillon de vingt centimètres est
     * exactement ce qu'il faut sur un plateau de trois mètres.
     */
    parquet: famille(T, parquet, 0.2, 0.3, 3.2, 0.5, chantier),
    bois: famille(T, bois, 0.14, 0.24, 1.0, 0.8, chantier),
    /* Le lin : peu de teinte, beaucoup de relief. Un tissu ne change pas de
       couleur, il change d'orientation — c'est ce qui lui donne son velouté. */
    lin: famille(T, lin, 0.1, 0.16, 2.4, 5, chantier),
    enduit: famille(T, enduit, 0.05, 0.1, 1.2, 0.32, chantier),
    beton: famille(T, beton, 0.11, 0.2, 1.6, 0.22, chantier),
    pierre: famille(T, pierre, 0.11, 0.18, 1.4, 0.4, chantier),
    marbre: famille(T, marbre, 0.16, 0.1, 0.4, 0.3, chantier),
    metal: famille(T, metal, 0.06, 0.34, 0.8, 1.6, chantier),
  };

  return {
    ...familles,
    avancer: (budget: number) => chantier.avancer(budget),
    get pret() {
      return chantier.fini;
    },
    dispose() {
      for (const m of Object.values(familles)) m.dispose();
    },
  };
}
