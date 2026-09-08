import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Barre } from '@/components/juridique/Barre';
import { Portail } from '@/components/juridique/Portail';
import { currentAccount } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entrer',
  robots: { index: false, follow: false },
};

type Params = { searchParams: Promise<{ mode?: string }> };

export default async function Connexion({ searchParams }: Params) {
  if (await currentAccount()) redirect('/juridique/compte');
  const { mode } = await searchParams;

  return (
    <>
      <Barre retour={{ href: '/juridique', label: 'L’assistant' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Votre compte</p>
        <h1 className="jur-h1 jur-h1-moyen">Vos consultations, retrouvées.</h1>
        <p className="jur-lede">
          Un compte sert à trois choses : conserver vos échanges et les rouvrir, déposer un document
          à faire lire, et lever la limite de trois questions par jour. Rien n’y est demandé de plus
          que votre nom et une adresse.
        </p>

        <Portail depart={mode === 'inscription' ? 'inscription' : 'connexion'} />
      </main>
    </>
  );
}
