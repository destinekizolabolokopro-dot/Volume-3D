/**
 * La barre de la zone juridique.
 *
 * Elle ne reprend pas `ProBar` : celle-ci habille des outils de travail
 * derrière un mot de passe, quand cette zone est publique et se lit sans
 * compte. Le nom du site reste présent, en petit, parce que c'est lui qui
 * répond de ce qui est écrit ici.
 */
export function Barre({ retour }: { retour?: { href: string; label: string } }) {
  return (
    <header className="jur-bar">
      <a className="jur-bar-brand" href="/juridique">
        Assistant juridique
        <small>par Volume3D</small>
      </a>
      {retour && (
        <a className="jur-bar-link" href={retour.href}>
          ← {retour.label}
        </a>
      )}
      <a className="jur-bar-link" href="/juridique/dossiers">
        Mes consultations
      </a>
    </header>
  );
}
