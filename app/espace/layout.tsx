import { redirect } from 'next/navigation';
import { BarreEspace } from '@/components/BarreEspace';
import { Onglets } from '@/components/Onglets';
import { Pied } from '@/components/Pied';
import { BRANCHE_PAR_DEFAUT } from '@/lib/branches';
import { compteCourant } from '@/lib/comptes';

/**
 * L'espace de travail.
 *
 * Tout ce qui vit sous /espace suppose un compte, et c'est ce gabarit qui le
 * garantit — une seule fois, pour toutes les pages. Chacune vérifiait la
 * session pour son propre compte ; il suffisait d'en ajouter une et d'oublier
 * la ligne pour ouvrir une porte, et personne ne s'en serait aperçu tant que
 * la page n'aurait rien affiché de sensible.
 *
 * ── Pourquoi une barre différente de celle du site ─────────────────────────
 * Parce qu'on n'y fait pas la même chose. La barre publique vend : documents,
 * formules, entrer. Celle-ci travaille : poser une question, retrouver ses
 * fils, son compte. Garder la même aux deux endroits donnerait à un client qui
 * paie l'impression d'être toujours dans la vitrine.
 *
 * ── Les onglets de branches ────────────────────────────────────────────────
 * Ils sont ici et nulle part ailleurs. L'immobilier est ouvert ; le foncier,
 * la construction, le travail et les sociétés sont annoncés, chacun avec ce
 * qu'il couvrira et les textes qui lui serviront. Les mettre sur la vitrine
 * reviendrait à vendre quatre droits dont un seul répond.
 */
export default async function GabaritEspace({ children }: { children: React.ReactNode }) {
  const compte = await compteCourant();

  /* La redirection emporte l'adresse voulue : quelqu'un qui ouvre un lien vers
     une consultation précise doit y arriver après s'être connecté, et non
     atterrir sur un accueil où il aura à la retrouver. */
  if (!compte) redirect('/entrer');

  return (
    <>
      <BarreEspace nom={compte.nom} verifie={Boolean(compte.emailVerifieA)} />
      <Onglets active={BRANCHE_PAR_DEFAUT} />
      {children}
      <Pied />
    </>
  );
}
