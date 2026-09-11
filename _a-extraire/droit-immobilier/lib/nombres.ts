/**
 * Écrire une date et un nombre en français, à la main.
 *
 * `Intl` sait le faire, mais rend « 8 sept. 2026 » ou réclame un fuseau
 * horaire — et une date de fonds juridique lue au fuseau du navigateur peut
 * reculer d'un jour, ce qui est exactement le genre de détail qu'on ne veut
 * pas avoir à expliquer.
 *
 * Ce module ne dépend de rien et ne touche ni au disque ni au réseau : il
 * sert au site comme au générateur de la page unique, qui tourne dans un
 * simple script Node et ne peut pas importer `server-only`.
 */

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 8 septembre 2026 ». Écrit à la main : `Intl` rend « 8 sept. 2026 » ou impose un fuseau. */
export function dateLisible(iso: string): string {
  const [annee, mois, jour] = iso.split('-').map(Number);
  if (!annee || !mois || !jour) return iso;
  return `${jour === 1 ? '1ᵉʳ' : jour} ${MOIS[mois - 1]} ${annee}`;
}

/** « 2 133 » — espace fine insécable, celle des nombres en français. */
export function nombreLisible(valeur: number): string {
  return valeur.toLocaleString('fr-FR').replace(/ /g, ' ');
}
