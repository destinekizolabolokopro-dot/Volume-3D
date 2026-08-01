import { LogoMark } from '@/components/Logo';
import { isConfigured } from '@/lib/require-auth';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const configured = isConfigured();

  return (
    <div className="login-page">
      <div className="login-card">
        <LogoMark size={30} />
        <h1>Back-office Volume3D</h1>

        {configured ? (
          <>
            <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
              Espace réservé. Les propriétaires n’ont pas de compte : ils reçoivent un simple lien.
            </p>
            <LoginForm />
          </>
        ) : (
          <div className="callout-box" style={{ marginTop: 16 }}>
            <strong>Configuration incomplète.</strong>
            <p style={{ margin: '8px 0 0' }}>
              Créez un fichier <code>.env.local</code> à la racine du projet avec :
            </p>
            <pre style={{ margin: '10px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {'ADMIN_PASSWORD=votre-mot-de-passe\nAUTH_SECRET=une-chaine-aleatoire-de-32-caracteres'}
            </pre>
            <p style={{ margin: '10px 0 0' }}>Puis redémarrez le serveur.</p>
          </div>
        )}
      </div>
    </div>
  );
}
