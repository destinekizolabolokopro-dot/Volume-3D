/**
 * Le message d'erreur du fil.
 *
 * Trois situations, trois issues, et c'est tout l'objet de ce composant.
 *
 * Un quota atteint demande une décision : il porte donc la sortie avec lui —
 * sans elle, la limite ne serait qu'un mur.
 *
 * Une panne passagère demande un geste, un seul : reposer la question. Elle
 * est conservée, et la retaper serait une punition pour une faute qui n'est
 * pas celle de la personne.
 *
 * Une panne de configuration ne demande rien du tout : insister n'y changera
 * rien, et offrir un bouton qui ne peut pas marcher est pire que de n'en
 * offrir aucun.
 */
export function Alerte({
  message,
  quota,
  reessayable = false,
  onRelancer,
}: {
  message: string;
  quota: boolean;
  reessayable?: boolean;
  onRelancer?: () => void;
}) {
  return (
    <p className="jur-erreur" role="alert">
      {message}
      {quota && (
        <>
          {' '}
          <a href="/abonnement">Voir les formules</a>
        </>
      )}
      {!quota && reessayable && onRelancer && (
        <>
          {' '}
          <button type="button" className="jur-relance" onClick={onRelancer}>
            Relancer la question
          </button>
        </>
      )}
    </p>
  );
}
