import { EspaceNav } from '@/components/EspaceNav';
import { PLAN_LIMITS } from '@/lib/accounts';
import { requireAccount } from '@/lib/require-account';
import { getStore } from '@/lib/store';
import type { Plan } from '@/lib/types';
import { AccountForm } from './AccountForm';

export const dynamic = 'force-dynamic';

export default async function ComptePage() {
  const account = await requireAccount();
  const properties = await getStore().list('properties', { accountId: account.id });
  const limit = PLAN_LIMITS[account.plan as Plan] ?? 1;

  return (
    <div className="shell">
      <EspaceNav account={account} current="/espace/compte" />

      <main className="page">
        <div className="page-head">
          <div>
            <h1>Mon compte</h1>
            <p>Vos coordonnées et votre formule d’abonnement.</p>
          </div>
        </div>

        <AccountForm account={account} used={properties.length} limit={limit} />
      </main>
    </div>
  );
}
