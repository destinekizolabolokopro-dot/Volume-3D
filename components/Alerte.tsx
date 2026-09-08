/**
 * Le message d'erreur du fil.
 *
 * Une panne et un quota atteint n'appellent pas la même chose : la première
 * demande de réessayer, le second demande une décision. Le second porte donc
 * la sortie avec lui — sans elle, la limite ne serait qu'un mur.
 */
export function Alerte({ message, quota }: { message: string; quota: boolean }) {
  return (
    <p className="jur-erreur" role="alert">
      {message}
      {quota && (
        <>
          {' '}
          <a href="/abonnement">Voir les formules</a>
        </>
      )}
    </p>
  );
}
