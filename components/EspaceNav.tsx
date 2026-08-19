import { ProBar } from '@/components/pro/Pro';
import { signout } from '@/app/espace/actions';
import { PLAN_LABELS } from '@/lib/accounts';
import type { Account, Plan } from '@/lib/types';

const TABS = [
  { href: '/espace', label: 'Tableau de bord' },
  { href: '/espace/biens', label: 'Mes biens' },
  { href: '/espace/creation', label: 'Création' },
  { href: '/espace/compte', label: 'Mon compte' },
];

/**
 * La barre de l'espace client.
 *
 * Elle passe par `ProBar`, comme le back-office. Les deux surfaces avaient
 * chacune la leur — l'une claire, l'autre sombre, avec deux traitements
 * d'onglet différents — alors qu'elles servent le même produit et que c'est
 * souvent la même personne qui passe de l'une à l'autre.
 */
export function EspaceNav({ account, current }: { account: Account; current: string }) {
  return (
    <ProBar
      tabs={TABS}
      current={current}
      who={`${account.name} · ${PLAN_LABELS[account.plan as Plan] ?? account.plan}`}
      side={
        <form action={signout}>
          <button className="btn btn-on-dark btn-sm" type="submit">
            Déconnexion
          </button>
        </form>
      }
    />
  );
}
