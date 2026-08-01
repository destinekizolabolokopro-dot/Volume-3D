import { redirect } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import { currentAccount } from '@/lib/accounts';
import { AuthForms } from './AuthForms';

export const dynamic = 'force-dynamic';

export default async function ConnexionPage() {
  if (await currentAccount()) redirect('/espace');

  return (
    <div className="auth">
      <aside className="auth-aside">
        <LogoMark size={34} />
        <h2>Votre logement, visitable avant la réservation.</h2>
        <ul>
          <li>Créez vos visites 360° et vos vidéos de déambulation</li>
          <li>Un assistant répond aux questions de vos voyageurs, jour et nuit</li>
          <li>Suivez les vues et ce que les voyageurs demandent vraiment</li>
        </ul>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <LogoMark size={28} />
          <h1>Mon espace</h1>
          <p className="muted">Gérez vos biens, vos visites et vos statistiques.</p>
          <AuthForms />
          <p className="tiny" style={{ marginTop: 20 }}>
            <a href="/">← Retour au site</a>
          </p>
        </div>
      </main>
    </div>
  );
}
