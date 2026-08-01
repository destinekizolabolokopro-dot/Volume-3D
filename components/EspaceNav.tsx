import { LogoMark } from '@/components/Logo';
import { signout } from '@/app/espace/actions';
import type { Account } from '@/lib/types';
import { PLAN_LABELS } from '@/lib/accounts';
import type { Plan } from '@/lib/types';

const TABS = [
  { href: '/espace', label: 'Tableau de bord' },
  { href: '/espace/biens', label: 'Mes biens' },
  { href: '/espace/creation', label: 'Création' },
  { href: '/espace/compte', label: 'Mon compte' },
];

/** Barre de navigation de l'espace client. `current` est le chemin actif. */
export function EspaceNav({ account, current }: { account: Account; current: string }) {
  return (
    <header className="topbar">
      <a className="topbar-brand" href="/espace">
        <LogoMark size={22} />
        <span>
          Volume<i>3D</i>
        </span>
      </a>

      <nav className="tabs" aria-label="Sections de l’espace">
        {TABS.map((tab) => (
          <a key={tab.href} className="tab" href={tab.href} aria-current={tab.href === current ? 'page' : undefined}>
            {tab.label}
          </a>
        ))}
      </nav>

      <div className="topbar-side">
        <span>
          {account.name} · {PLAN_LABELS[account.plan as Plan] ?? account.plan}
        </span>
        <form action={signout}>
          <button className="btn btn-ghost btn-sm" type="submit">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
