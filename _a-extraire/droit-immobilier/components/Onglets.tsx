'use client';

import { usePathname } from 'next/navigation';
import { BRANCHES } from '@/lib/branches';

/**
 * Les onglets des branches, en tête de l'espace de travail.
 *
 * Ils ne sont PAS sur la vitrine, et c'est un choix : une page de vente qui
 * annonce cinq droits dont un seul répond vend quelque chose qui n'existe pas.
 * Ici, on est entré, on sait ce qu'on a payé, et voir arriver le reste est une
 * bonne nouvelle plutôt qu'une promesse.
 *
 * Une branche qui n'est pas ouverte est montrée, pas cachée, et porte la
 * mention « bientôt » à côté de son nom. Elle mène à sa page d'annonce, qui
 * dit ce qu'elle couvrira et sur quels textes — pas à un écran vide.
 *
 * ── L'onglet courant se lit dans l'adresse ─────────────────────────────────
 * Il était passé en propriété depuis le gabarit, qui n'en connaît qu'une :
 * celle par défaut. Résultat, « Droit immobilier » restait souligné même sur
 * la page du droit du travail, et la rangée disait le contraire de la page.
 * L'adresse, elle, sait toujours où l'on est.
 */
export function Onglets() {
  const chemin = usePathname() ?? '';
  const surUneBranche = chemin.match(/^\/espace\/branches\/([^/]+)/);
  const active = surUneBranche ? surUneBranche[1] : 'immobilier';

  return (
    <nav className="jur-onglets-branches" aria-label="Branches du droit">
      <ul>
        {BRANCHES.map((branche) => {
          const courante = branche.id === active;
          const lien = branche.ouverte ? '/espace' : `/espace/branches/${branche.id}`;

          return (
            <li key={branche.id}>
              <a
                href={lien}
                aria-current={courante ? 'page' : undefined}
                className={branche.ouverte ? undefined : 'jur-onglet-attente'}
              >
                {branche.label}
                {!branche.ouverte && <span className="jur-pastille">bientôt</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
