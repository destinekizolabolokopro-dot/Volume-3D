import { EspaceNav } from '@/components/EspaceNav';
import { ProHead } from '@/components/pro/Pro';
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
    <div className="pro">
      <EspaceNav account={account} current="/espace/compte" />

      <main className="pro-page">
        <ProHead title="Mon compte" sub="Vos coordonnées et votre formule d’abonnement." />

        <AccountForm account={account} used={properties.length} limit={limit} />
      </main>
    </div>
  );
}
