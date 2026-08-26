/**
 * Subdivision de maillage, partagée.
 *
 * Elle vivait dans `components/three/interior.ts`, où elle sert à donner de la
 * résolution aux surfaces avant d'y cuire l'occlusion dans les sommets : une
 * couleur portée par les sommets ne peut varier qu'aux sommets, et un mur de
 * quatre triangles ne sait faire qu'un dégradé de coin à coin.
 *
 * Elle en est sortie le jour où l'appartement d'ORIEL a eu besoin du même
 * outil. Deux copies d'un algorithme de maillage divergent toujours — l'une
 * corrige une jonction en T que l'autre garde — et c'est le genre de
 * divergence qui ne se voit qu'à la capture, six mois plus tard.
 */

import * as THREE from 'three';

/**
 * Un pas de subdivision : chaque triangle en donne quatre.
 *
 * Les milieux sont mémorisés par arête, donc deux triangles voisins partagent
 * exactement le même sommet neuf : le maillage reste cousu, sans jonction en T
 * — et une jonction en T, sur une surface dont la couleur est portée par les
 * sommets, se voit tout de suite comme une couture claire.
 */
export function subdiviserUnPas(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const index = geometry.index!;
  const noms = Object.keys(geometry.attributes);
  const source = new Map<string, THREE.BufferAttribute>();
  const sortie = new Map<string, number[]>();
  for (const nom of noms) {
    const attribut = geometry.getAttribute(nom) as THREE.BufferAttribute;
    source.set(nom, attribut);
    sortie.set(nom, Array.from(attribut.array as ArrayLike<number>));
  }
  let compte = source.get('position')!.count;
  const connus = new Map<number, number>();
  const milieu = (i: number, j: number): number => {
    const cle = i < j ? i * 16777216 + j : j * 16777216 + i;
    const vu = connus.get(cle);
    if (vu !== undefined) return vu;
    for (const nom of noms) {
      const attribut = source.get(nom)!;
      const taille = attribut.itemSize;
      const liste = sortie.get(nom)!;
      for (let k = 0; k < taille; k += 1) {
        liste.push(
          ((attribut.array[i * taille + k] as number) +
            (attribut.array[j * taille + k] as number)) /
            2,
        );
      }
    }
    connus.set(cle, compte);
    compte += 1;
    return compte - 1;
  };

  const triangles: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const ab = milieu(a, b);
    const bc = milieu(b, c);
    const ca = milieu(c, a);
    triangles.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }

  const suivant = new THREE.BufferGeometry();
  for (const nom of noms) {
    suivant.setAttribute(
      nom,
      new THREE.BufferAttribute(new Float32Array(sortie.get(nom)!), source.get(nom)!.itemSize),
    );
  }
  suivant.setIndex(triangles);
  // Un milieu de deux normales unitaires ne l'est plus. Sur du plan c'est sans
  // effet, mais la fonction ne sait pas qu'elle travaille sur du plan.
  if (suivant.getAttribute('normal')) suivant.normalizeNormals();
  return suivant;
}

/** Subdivise jusqu'à ce qu'aucune arête ne dépasse `maille`, dans la limite de `passes`. */
export function subdiviser(
  geometry: THREE.BufferGeometry,
  maille: number,
  passes = 5,
): THREE.BufferGeometry {
  let courant = geometry;
  for (let pas = 0; pas < passes; pas += 1) {
    const index = courant.index;
    const position = courant.getAttribute('position');
    if (!index || !position) break;
    let plusLongue = 0;
    for (let t = 0; t < index.count; t += 3) {
      for (let e = 0; e < 3; e += 1) {
        const i = index.getX(t + e);
        const j = index.getX(t + ((e + 1) % 3));
        const d = Math.hypot(
          position.getX(i) - position.getX(j),
          position.getY(i) - position.getY(j),
          position.getZ(i) - position.getZ(j),
        );
        if (d > plusLongue) plusLongue = d;
      }
    }
    if (plusLongue <= maille) break;
    const suivant = subdiviserUnPas(courant);
    if (courant !== geometry) courant.dispose();
    courant = suivant;
  }
  return courant;
}


/* ============================================================== pavés === */

/**
 * Un pavé dont les arêtes sont cassées.
 *
 * C'est le dernier grand signe distinctif d'une image calculée, et le plus
 * têtu : **une arête vive n'existe pas.** Un plateau de table, un caisson, un
 * bras de canapé, un mur — tout, dans le monde, a un congé ou un chanfrein de
 * quelques millimètres, et ce chanfrein attrape une ligne de lumière que la
 * face voisine n'a pas. C'est cette ligne, et non la matière, qui dit à l'œil
 * qu'un objet est un objet. Une boîte à arêtes parfaites ne la donne jamais,
 * quelle que soit la finesse de ses textures.
 *
 * Un centimètre suffit largement : à trois mètres, sous un cadrage de
 * cinquante degrés sur quatorze cent quarante pixels, il couvre quatre pixels.
 * On ne le voit pas — on voit qu'il est là.
 *
 * La construction est celle d'un solide convexe : six faces rentrées de `r`,
 * douze bandes d'arête, huit triangles de coin. Quarante-quatre triangles au
 * lieu de douze.
 *
 * **L'orientation n'est pas écrite à la main.** Vingt-six facettes font vingt-
 * six ordres de sommets à ne pas se tromper, et une seule erreur donne un trou
 * noir dans le meuble qu'on ne retrouve qu'à la capture. Le solide étant
 * convexe et centré sur l'origine, la direction du dehors en un point est ce
 * point lui-même : on calcule la normale de chaque triangle et on échange deux
 * sommets si elle regarde vers l'intérieur. C'est plus court à écrire, et
 * c'est juste par construction.
 */
export function paveChanfreine(
  largeur: number,
  hauteur: number,
  profondeur: number,
  rayon: number,
): THREE.BufferGeometry {
  const hx = largeur / 2;
  const hy = hauteur / 2;
  const hz = profondeur / 2;
  const r = Math.max(0, Math.min(rayon, hx / 2, hy / 2, hz / 2));
  const a = hx - r;
  const b = hy - r;
  const c = hz - r;

  /** Les trois sommets du coin de signes donnés, un par face qui s'y rejoint. */
  const coin = (sx: number, sy: number, sz: number) => ({
    x: [sx * hx, sy * b, sz * c] as [number, number, number],
    y: [sx * a, sy * hy, sz * c] as [number, number, number],
    z: [sx * a, sy * b, sz * hz] as [number, number, number],
  });

  const sommets: number[] = [];
  const triangle = (
    p: [number, number, number],
    q: [number, number, number],
    s: [number, number, number],
  ) => {
    const ux = q[0] - p[0];
    const uy = q[1] - p[1];
    const uz = q[2] - p[2];
    const vx = s[0] - p[0];
    const vy = s[1] - p[1];
    const vz = s[2] - p[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const cx = (p[0] + q[0] + s[0]) / 3;
    const cy = (p[1] + q[1] + s[1]) / 3;
    const cz = (p[2] + q[2] + s[2]) / 3;
    const dehors = nx * cx + ny * cy + nz * cz >= 0;
    const ordre = dehors ? [p, q, s] : [p, s, q];
    for (const v of ordre) sommets.push(v[0], v[1], v[2]);
  };
  const quad = (
    p: [number, number, number],
    q: [number, number, number],
    s: [number, number, number],
    t: [number, number, number],
  ) => {
    triangle(p, q, s);
    triangle(p, s, t);
  };

  const signes = [-1, 1];
  const C: Record<string, ReturnType<typeof coin>> = {};
  for (const sx of signes) {
    for (const sy of signes) {
      for (const sz of signes) C[`${sx},${sy},${sz}`] = coin(sx, sy, sz);
    }
  }
  const g = (sx: number, sy: number, sz: number) => C[`${sx},${sy},${sz}`];

  // Les six faces, rentrées de `r` sur leurs deux axes de plan.
  for (const s of signes) {
    quad(g(s, -1, -1).x, g(s, 1, -1).x, g(s, 1, 1).x, g(s, -1, 1).x);
    quad(g(-1, s, -1).y, g(1, s, -1).y, g(1, s, 1).y, g(-1, s, 1).y);
    quad(g(-1, -1, s).z, g(1, -1, s).z, g(1, 1, s).z, g(-1, 1, s).z);
  }

  // Les douze bandes d'arête, une par couple de faces adjacentes.
  for (const s1 of signes) {
    for (const s2 of signes) {
      // Arêtes parallèles à z : entre une face x et une face y.
      quad(g(s1, s2, -1).x, g(s1, s2, 1).x, g(s1, s2, 1).y, g(s1, s2, -1).y);
      // Arêtes parallèles à y : entre une face x et une face z.
      quad(g(s1, -1, s2).x, g(s1, 1, s2).x, g(s1, 1, s2).z, g(s1, -1, s2).z);
      // Arêtes parallèles à x : entre une face y et une face z.
      quad(g(-1, s1, s2).y, g(1, s1, s2).y, g(1, s1, s2).z, g(-1, s1, s2).z);
    }
  }

  // Les huit coins.
  for (const sx of signes) {
    for (const sy of signes) {
      for (const sz of signes) {
        const k = g(sx, sy, sz);
        triangle(k.x, k.y, k.z);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sommets), 3));
  /* Sur une géométrie non indexée, `computeVertexNormals` donne une normale par
     face — ce qu'on veut : un chanfrein lissé avec ses voisines n'attrape plus
     de ligne de lumière, et l'exercice perd tout son objet. */
  geometry.computeVertexNormals();
  return geometry;
}
