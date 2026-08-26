/**
 * Les matières, fabriquées par le code.
 *
 * Jusqu'ici, chaque surface de la scène était un aplat : une couleur, une
 * rugosité, rien d'autre. C'était un choix — le rendu maquette — et il se
 * tenait. Il ne tient plus dès qu'on demande du réalisme, pour une raison
 * qu'aucun réglage de lumière ne contourne : **une surface parfaitement
 * uniforme n'existe pas.** Un parquet a des lames, un lin a une trame, un
 * enduit a un grain, un béton a des taches. L'œil ne sait pas nommer ces
 * choses, mais il sait immédiatement qu'elles manquent — et il appelle cela
 * « de la synthèse ».
 *
 * Rien n'est chargé depuis le réseau. Tout est calculé dans un canevas au
 * démarrage, pour trois raisons :
 *
 *  - **Le poids.** Neuf matières en trois cartes chacune feraient plusieurs
 *    mégaoctets de fichiers. Ici, c'est une centaine de lignes.
 *  - **La cohérence.** Les couleurs de la scène sont mesurées et vérifiées par
 *    `npm run palette`. Une texture téléchargée les remplacerait ; une texture
 *    calculée peut être construite pour **tourner autour du blanc**, donc pour
 *    moduler la couleur du matériau sans jamais la déplacer.
 *  - **Le raccord.** Une texture doit se répéter sans qu'on voie la couture.
 *    Un bruit calculé sur un réseau périodique se répète exactement ; un
 *    fichier photographique, presque jamais.
 *
 * Chaque famille rend trois cartes tirées du **même champ de hauteur**, ce qui
 * est la seule façon d'obtenir une matière crédible : la couleur, la brillance
 * et le relief d'un vrai matériau ne sont pas trois hasards indépendants — un
 * creux du parquet est plus sombre, plus mat, et plus bas. Trois bruits
 * distincts donneraient trois motifs superposés, c'est-à-dire de la saleté.
 */

import * as THREE from 'three';

/* ================================================================ bruit === */

/**
 * Un bruit de valeur **périodique**.
 *
 * Le réseau est bouclé par un modulo sur les indices de cellule : le bord
 * droit interpole vers la même valeur que le bord gauche, et la texture se
 * répète sans couture. C'est toute la différence entre une matière et un
 * carrelage de photos.
 *
 * L'interpolation est en `t²(3−2t)` et non linéaire : une interpolation
 * linéaire laisse voir les arêtes du réseau, qui forment une grille en
 * losanges très reconnaissable une fois qu'on l'a vue.
 */
function reseau(cellules: number, graine: number): Float32Array {
  const valeurs = new Float32Array(cellules * cellules);
  let etat = graine >>> 0;
  for (let i = 0; i < valeurs.length; i += 1) {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    valeurs[i] = etat / 4294967296;
  }
  return valeurs;
}

function lisser(t: number): number {
  return t * t * (3 - 2 * t);
}

function echantillon(valeurs: Float32Array, cellules: number, x: number, y: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = lisser(x - cx);
  const fy = lisser(y - cy);
  const x0 = ((cx % cellules) + cellules) % cellules;
  const y0 = ((cy % cellules) + cellules) % cellules;
  const x1 = (x0 + 1) % cellules;
  const y1 = (y0 + 1) % cellules;
  const a = valeurs[y0 * cellules + x0];
  const b = valeurs[y0 * cellules + x1];
  const c = valeurs[y1 * cellules + x0];
  const d = valeurs[y1 * cellules + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Plusieurs octaves de bruit périodique, ramenées entre 0 et 1.
 *
 * `etirement` allonge le motif sur un axe : c'est ce qui distingue un fil de
 * bois d'une tache de béton. Un bruit isotrope ne fera jamais un veinage.
 */
function octaves(
  taille: number,
  base: number,
  nombre: number,
  graine: number,
  etirementX = 1,
  etirementY = 1,
): Float32Array {
  const champ = new Float32Array(taille * taille);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < nombre; o += 1) {
    const cellules = base * Math.pow(2, o);
    const valeurs = reseau(cellules, graine + o * 7919);
    for (let y = 0; y < taille; y += 1) {
      for (let x = 0; x < taille; x += 1) {
        const u = ((x / taille) * cellules) / etirementX;
        const v = ((y / taille) * cellules) / etirementY;
        champ[y * taille + x] += amplitude * echantillon(valeurs, cellules, u, v);
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < champ.length; i += 1) champ[i] /= total;
  return champ;
}

/* =============================================================== cartes === */

function texture(taille: number, remplir: (data: Uint8ClampedArray) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = taille;
  canvas.height = taille;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(taille, taille);
  remplir(image.data);
  ctx.putImageData(image, 0, 0);
  const carte = new THREE.CanvasTexture(canvas);
  carte.wrapS = THREE.RepeatWrapping;
  carte.wrapT = THREE.RepeatWrapping;
  /* Les coordonnées viennent d'une projection du monde et peuvent valoir des
     dizaines : sans anisotropie, un sol vu en fuite se réduit à un moiré. */
  carte.anisotropy = 4;
  return carte;
}

export interface Matiere {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
  /** Répétitions par mètre, à écrire dans `userData.tuile` du matériau. */
  tuile: number;
  dispose(): void;
}

/**
 * Fabrique les trois cartes d'une famille à partir d'un champ de hauteur.
 *
 * @param teinte Amplitude de la variation de couleur, autour du blanc. C'est
 *   le paramètre à garder petit : la couleur mesurée du matériau doit rester
 *   la couleur qu'on voit. Au-delà de quinze pour cent, ce n'est plus une
 *   matière, c'est une autre couleur.
 * @param mat Amplitude de la variation de rugosité. La carte de rugosité de
 *   three **multiplie** la valeur du matériau et ne peut donc que la baisser :
 *   on la centre haut et on relève la rugosité de base en conséquence.
 * @param relief Force du relief. Il ne déplace rien — il incline la normale,
 *   donc il change la façon dont la lumière frappe. C'est de très loin la plus
 *   rentable des trois cartes, et la seule qui survive à un éclairage plat.
 */
function famille(
  taille: number,
  champ: Float32Array,
  teinte: number,
  mat: number,
  relief: number,
  tuile: number,
): Matiere {
  const map = texture(taille, (data) => {
    for (let i = 0; i < champ.length; i += 1) {
      const k = 255 * (1 - teinte * 0.5 + teinte * champ[i]);
      data[i * 4] = k;
      data[i * 4 + 1] = k;
      data[i * 4 + 2] = k;
      data[i * 4 + 3] = 255;
    }
  });

  const roughnessMap = texture(taille, (data) => {
    for (let i = 0; i < champ.length; i += 1) {
      /* Le creux est **plus mat** que la crête : c'est là que la poussière se
         dépose et que le vernis s'use le moins. L'inverse donne des surfaces
         qui brillent dans leurs rayures, ce qui se lit comme du plastique. */
      const g = 255 * (1 - mat + mat * champ[i]);
      data[i * 4] = 255;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = 255;
    }
  });

  const normalMap = texture(taille, (data) => {
    for (let y = 0; y < taille; y += 1) {
      for (let x = 0; x < taille; x += 1) {
        /* Différences centrées, en bouclant sur les bords : une carte de
           relief dont les bords ne bouclent pas dessine une grille de rainures
           à chaque raccord de tuile. */
        const g = (px: number, py: number) =>
          champ[(((py % taille) + taille) % taille) * taille + (((px % taille) + taille) % taille)];
        const dx = (g(x + 1, y) - g(x - 1, y)) * relief;
        const dy = (g(x, y + 1) - g(x, y - 1)) * relief;
        const nx = -dx;
        const ny = -dy;
        const nz = 1;
        const norme = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const i = y * taille + x;
        data[i * 4] = ((nx / norme) * 0.5 + 0.5) * 255;
        data[i * 4 + 1] = ((ny / norme) * 0.5 + 0.5) * 255;
        data[i * 4 + 2] = ((nz / norme) * 0.5 + 0.5) * 255;
        data[i * 4 + 3] = 255;
      }
    }
  });

  return {
    map,
    roughnessMap,
    normalMap,
    tuile,
    dispose() {
      map.dispose();
      roughnessMap.dispose();
      normalMap.dispose();
    },
  };
}

/* ============================================================ familles === */

/** Ajoute au champ les rainures d'un lamé : des lames dans le sens de `u`. */
function lames(taille: number, champ: Float32Array, parTuile: number, creux: number): void {
  for (let y = 0; y < taille; y += 1) {
    const v = (y / taille) * parTuile;
    const dans = v - Math.floor(v);
    /* Le joint occupe les trois premiers centièmes de la lame. Il assombrit et
       il creuse — c'est lui, et non le fil du bois, qui donne au parquet son
       échelle : sans joint, un parquet est une planche unique. */
    const joint = dans < 0.03 ? 1 - dans / 0.03 : 0;
    /* Une lame sur deux est décalée d'un tiers et légèrement plus claire :
       deux lames voisines de même teinte se lisent comme une seule. */
    const rang = Math.floor(v);
    const nuance = (rang % 3) * 0.035 - 0.035;
    for (let x = 0; x < taille; x += 1) {
      const i = y * taille + x;
      champ[i] = Math.max(0, Math.min(1, champ[i] + nuance - creux * joint));
    }
  }
}

/** Ajoute au champ une trame tissée : deux peignes croisés. */
function trame(taille: number, champ: Float32Array, fils: number, force: number): void {
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const u = (x / taille) * fils * Math.PI * 2;
      const v = (y / taille) * fils * Math.PI * 2;
      /* Le produit et non la somme : une trame est un croisement, donc un
         maximum aux nœuds et un creux dans les deux directions entre eux. */
      const tissu = Math.sin(u) * Math.sin(v);
      const i = y * taille + x;
      champ[i] = Math.max(0, Math.min(1, champ[i] + force * tissu));
    }
  }
}

export interface Matieres {
  parquet: Matiere;
  bois: Matiere;
  lin: Matiere;
  enduit: Matiere;
  beton: Matiere;
  pierre: Matiere;
  marbre: Matiere;
  metal: Matiere;
  dispose(): void;
}

/**
 * Toutes les matières de la scène.
 *
 * Les réglages ci-dessous sont le résultat d'allers-retours à la capture, pas
 * d'un calcul. Deux règles s'en dégagent et méritent d'être écrites :
 *
 * **La teinte reste faible partout.** C'est la carte qu'on est tenté de
 * pousser, parce que c'est celle qu'on voit en regardant la texture seule. Mais
 * une texture ne se regarde jamais seule : elle se regarde sur un objet, sous
 * une lumière, à trois mètres. À cette distance, une variation de couleur de
 * vingt pour cent ne fait pas « du bois », elle fait « du bois sale ».
 *
 * **Le relief fait le travail.** C'est la carte qui coûte le moins à la
 * lecture — elle ne change aucune couleur — et qui rapporte le plus, parce
 * qu'elle est la seule qui réagisse au déplacement de la caméra. Une matière
 * dont le grain s'allume et s'éteint quand on bouge est une matière ; une
 * matière peinte reste un dessin.
 */
export function creerMatieres(leger: boolean): Matieres {
  /* Deux cent cinquante-six pixels sur les petites machines, cinq cent douze
     ailleurs. Le coût est au démarrage et il est mesurable : environ dix
     millisecondes par famille en 512, deux en 256. */
  const T = leger ? 256 : 512;

  const champParquet = octaves(T, 4, 4, 12345, 9, 1);
  lames(T, champParquet, 10, 0.55);

  const champBois = octaves(T, 6, 4, 777, 7, 1);

  const champLin = octaves(T, 16, 3, 4242, 1, 1);
  trame(T, champLin, 26, 0.16);

  const champEnduit = octaves(T, 5, 5, 31337, 1, 1);
  const champBeton = octaves(T, 3, 5, 5150, 1, 1);
  const champPierre = octaves(T, 4, 5, 606, 2.2, 1);
  const champMarbre = octaves(T, 3, 5, 99, 5, 1.4);
  const champMetal = octaves(T, 8, 3, 8080, 40, 1);

  const familles = {
    /* Le parquet : la matière la plus regardée de la page — elle occupe le bas
       de six écrans sur dix — et celle qui porte le plus de relief, parce que
       ses joints sont de vraies rainures. */
    parquet: famille(T, champParquet, 0.13, 0.22, 3.4, 0.5),
    bois: famille(T, champBois, 0.09, 0.18, 1.8, 0.8),
    /* Le lin : peu de teinte, beaucoup de relief. Un tissu ne change pas de
       couleur, il change d'orientation — c'est ce qui lui donne son velouté. */
    lin: famille(T, champLin, 0.07, 0.1, 2.6, 5),
    /* L'enduit : presque rien, et c'est le but. Un mur peint dont on voit la
       texture est un mur mal peint ; un mur peint dont on ne voit rien du tout
       est un mur de synthèse. La différence tient à trois pour cent. */
    enduit: famille(T, champEnduit, 0.04, 0.08, 1.1, 0.32),
    beton: famille(T, champBeton, 0.07, 0.14, 1.4, 0.22),
    pierre: famille(T, champPierre, 0.06, 0.12, 1.2, 0.4),
    /* Le marbre : le veinage est un étirement fort sur un seul axe. C'est le
       seul endroit où la carte de couleur mène et où le relief suit — une
       veine de marbre poli ne se sent pas sous le doigt. */
    marbre: famille(T, champMarbre, 0.11, 0.07, 0.5, 0.3),
    /* Le métal brossé : un étirement extrême, presque des lignes. */
    metal: famille(T, champMetal, 0.05, 0.3, 0.8, 1.6),
  };

  return {
    ...familles,
    dispose() {
      for (const m of Object.values(familles)) m.dispose();
    },
  };
}
