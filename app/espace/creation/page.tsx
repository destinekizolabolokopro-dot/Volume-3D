import { EspaceNav } from '@/components/EspaceNav';
import { ProHead } from '@/components/pro/Pro';
import { PLAN_LIMITS } from '@/lib/accounts';
import { requireAccount } from '@/lib/require-account';
import { getStore } from '@/lib/store';
import type { Plan } from '@/lib/types';
import { CreationForm } from './CreationForm';

export const dynamic = 'force-dynamic';

export default async function CreationPage() {
  const account = await requireAccount();
  const properties = await getStore().list('properties', { accountId: account.id });
  const limit = PLAN_LIMITS[account.plan as Plan] ?? 1;
  const full = properties.length >= limit;

  return (
    <div className="pro">
      <EspaceNav account={account} current="/espace/creation" />

      <main className="pro-page">
        <ProHead
          title="Création"
          sub="Décrivez votre bien et ajoutez vos photos. Vous pourrez ensuite y attacher une visite 360°, une vidéo de déambulation, ou les deux."
        />

        {full ? (
          <p className="pro-notice">
            <span>
              <strong>Votre formule est complète.</strong> Elle autorise {limit} bien{limit > 1 ? 's' : ''} et
              vous en avez déjà {properties.length}. Changez de formule depuis{' '}
              <a href="/espace/compte">votre compte</a> pour en ajouter d’autres.
            </span>
          </p>
        ) : (
          <CreationForm />
        )}
      </main>
    </div>
  );
}
