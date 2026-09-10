import { MENTION } from '@/lib/copie';

/**
 * La mention, tout en haut de chaque page — avant même la marque.
 *
 * Elle est dans le gabarit racine et non dans une page : quelqu'un qui arrive
 * par un moteur de recherche sur une fiche de spécialité, lit une réponse et
 * repart n'aura peut-être jamais fait défiler jusqu'au pied de page.
 *
 * Elle n'est pas une alerte et n'en a pas la couleur — un bandeau rouge en
 * haut d'un site qu'on vient d'ouvrir se ferme sans être lu. Elle est un
 * filet et une nuance de gris : présente, calme, et impossible à manquer
 * puisqu'elle précède tout le reste.
 */
export function Mention() {
  return (
    <p className="jur-mention" role="note">
      <strong>{MENTION.court}</strong> {MENTION.long}
    </p>
  );
}
