import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Identifiant aléatoire en base 32 lisible.
 *
 * Sans l, o, 0 ni 1 : ces identifiants finissent dans des adresses qu'on
 * dicte au téléphone ou qu'on recopie d'un écran, et la confusion entre un
 * « l » et un « 1 » est celle qu'on ne voit jamais venir.
 *
 * Ce fichier ne contient plus que cela. Il portait aussi `slugify` et
 * `uniqueSlug`, venus du dépôt des visites 3D pour fabriquer des adresses de
 * logements : rien ici n'a de nom à transformer en adresse, et personne ne
 * les appelait.
 */
export function randomId(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
