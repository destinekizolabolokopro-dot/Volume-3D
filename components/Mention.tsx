import { MENTION } from '@/lib/copie';

/**
 * La mention, sous deux formes.
 *
 * Elle ne coiffe plus la page. Quatre lignes de petit texte gris avant même
 * le nom du site coûtaient la première impression sans rien protéger de
 * plus : une décharge qu'on tend avant de s'être présenté ne se lit pas. Elle
 * est désormais posée là où elle est réellement lue — voir l'en-tête de
 * `MENTION` dans lib/copie.ts.
 *
 * `entiere` sert au pied de page et aux fiches : le texte complet, avec les
 * recours nommés. `rappel` sert au-dessus d'une conversation, c'est-à-dire à
 * l'endroit exact où quelqu'un pourrait prendre une réponse pour un conseil
 * d'avocat — une seule phrase, qui ne se met pas en travers du fil.
 */
export function Mention({ forme = 'entiere' }: { forme?: 'entiere' | 'rappel' }) {
  if (forme === 'rappel') {
    return (
      <p className="jur-rappel" role="note">
        {MENTION.court}
      </p>
    );
  }

  return (
    <p className="jur-mention" role="note">
      <strong>{MENTION.court}</strong> {MENTION.long}
    </p>
  );
}
