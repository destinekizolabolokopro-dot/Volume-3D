import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Barre } from '@/components/juridique/Barre';
import { Questionnaire } from '@/components/juridique/Questionnaire';
import { currentAccount } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre profil',
  robots: { index: false, follow: false },
};

export default async function Profil() {
  const account = await currentAccount();
  if (!account) redirect('/juridique/compte/connexion');

  return (
    <>
      <Barre retour={{ href: '/juridique/compte', label: 'Mon compte' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Trois questions, une fois</p>
        <h1 className="jur-h1 jur-h1-moyen">D’où parlez-vous ?</h1>
        <p className="jur-lede">
          La même règle ne se joue pas de la même façon des deux côtés d’un bail, et un agent
          immobilier n’attend pas ce qu’attend un particulier. Dites-le une fois : le spécialiste
          n’aura plus à le deviner.
        </p>

        <Questionnaire
          profil={{
            metier: account.metier ?? '',
            volume: account.volume ?? '',
            usage: account.usage ?? '',
          }}
        />
      </main>
    </>
  );
}
