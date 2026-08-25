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
