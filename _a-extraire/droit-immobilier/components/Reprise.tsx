'use client';

import { useEffect, useRef, useState } from 'react';
import { CLE_REPRISE } from '@/lib/reprise';

/**
 * Verse la consultation d'essai dans le compte qui vient de s'ouvrir.
 *
 * Elle est montée dans l'espace, se déclenche une fois, et disparaît. Trois
 * choses la gouvernent :
 *
 * 1. LE SILENCE QUAND IL N'Y A RIEN. C'est le cas de presque toutes les
 *    arrivées dans l'espace : elle ne rend alors rien du tout, et rien ne
 *    bouge à l'écran.
 *
 * 2. LA CLÉ EST RETIRÉE AVANT L'ENVOI, pas après. Deux montages coup sur coup
 *    — le double rendu du mode strict en développement, un aller-retour de
 *    navigation — auraient sinon versé le même fil deux fois, et la personne
 *    trouverait sa consultation en double le jour de son inscription.
 *
 * 3. UN ÉCHEC NE BLOQUE RIEN. Si la reprise rate, on efface et on se tait :
 *    la personne se retrouve dans un espace vide, ce qu'elle aurait eu de
 *    toute façon. Lui afficher une erreur qu'elle ne peut pas corriger serait
 *    un mauvais premier écran.
 */
export function Reprise() {
  const [etat, setEtat] = useState<'repos' | 'encours'>('repos');
  const fait = useRef(false);

  useEffect(() => {
    if (fait.current) return;
    fait.current = true;

    let brut: string | null = null;
    try {
      brut = sessionStorage.getItem(CLE_REPRISE);
      /* Retiré AVANT l'envoi : voir le point 2 de l'en-tête. */
      if (brut) sessionStorage.removeItem(CLE_REPRISE);
    } catch {
      return;
    }
    if (!brut) return;

    setEtat('encours');

    void (async () => {
      try {
        const reponse = await fetch('/api/reprendre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: brut,
        });
        const donnees = (await reponse.json()) as { consultationId?: string | null };
        if (reponse.ok && donnees.consultationId) {
          /* Un rechargement franc plutôt qu'une navigation douce : la page de
             la consultation est rendue par le serveur, et elle doit lire une
             ligne écrite il y a une seconde. */
          window.location.href = `/espace/dossiers/${donnees.consultationId}?reprise=1`;
          return;
        }
      } catch {
        /* Réseau coupé pendant la reprise : on se tait. */
      }
      setEtat('repos');
    })();
  }, []);

  if (etat === 'repos') return null;

  return (
    <p className="jur-reprise" role="status">
      Votre consultation d’essai est en train d’être reprise dans votre espace…
    </p>
  );
}
