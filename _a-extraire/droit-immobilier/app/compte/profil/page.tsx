import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Barre } from '@/components/Barre';
import { Questionnaire } from '@/components/Questionnaire';
import { compteCourant } from '@/lib/comptes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre profil',
  robots: { index: false, follow: false },
};

export default async function Profil() {
  const compte = await compteCourant();
  if (!compte) redirect('/compte/connexion');

  return (
    <>
      <Barre retour={{ href: '/compte', label: 'Mon compte' }} />

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
            metier: compte.metier ?? '',
            volume: compte.volume ?? '',
            usage: compte.usage ?? '',
          }}
        />
      </main>
    </>
  );
}
