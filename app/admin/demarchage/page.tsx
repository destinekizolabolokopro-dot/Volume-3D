import { headers } from 'next/headers';
import { LogoMark } from '@/components/Logo';
import { requireAuth } from '@/lib/require-auth';
import { logout } from '../actions';
import { PitchSheet } from './PitchSheet';

export const dynamic = 'force-dynamic';

/** Reconstruit l'origine publique : c'est elle que le QR fera ouvrir. */
async function currentOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const protocol = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

/**
 * La fiche de démarchage.
 *
 * Réservée à l'administrateur : c'est son outil de vente, pas une page du
 * produit. On la prépare à l'écran, on l'imprime en A4, on la laisse sur la
 * table du propriétaire.
 */
export default async function DemarchagePage() {
  await requireAuth();
  const origin = await currentOrigin();
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'scan@volume3d.fr';

  return (
    <div className="admin">
      <header className="admin-bar no-print">
        <div className="admin-bar-brand">
          <LogoMark size={20} />
          <span>
            Volume<span>3D</span>
          </span>
        </div>
        <nav className="admin-nav">
          <a href="/admin">← Tableau de bord</a>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost btn-sm" style={{ color: '#e6dcce', borderColor: '#4a4038' }}>
              Déconnexion
            </button>
          </form>
        </nav>
      </header>

      <main className="admin-main">
        <h1 className="admin-h1 no-print">Fiche de démarchage</h1>
        <p className="admin-sub no-print">
          Ce qu’on laisse au propriétaire après lui avoir montré une visite. Le QR ouvre la visite sur son
          téléphone : c’est elle qui vend, pas la feuille.
        </p>

        <PitchSheet defaultLink={origin} contactEmail={contact} />
      </main>
    </div>
  );
}
