import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { effacer } from '@/app/juridique/dossiers/actions';
import { Barre } from '@/components/juridique/Barre';
import { Consultation, type Tour } from '@/components/juridique/Consultation';
import { currentAccount } from '@/lib/accounts';
import { consultationDuCompte, toursDeConsultation } from '@/lib/consultations';
import { domaineOuNull } from '@/lib/domaines';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Consultation',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

/**
 * Une consultation reprise.
 *
 * Le fil repart avec le même spécialiste et le même identifiant : la suite
 * s'ajoute au dossier au lieu d'en ouvrir un second. Les documents déposés à
 * l'époque n'y sont plus — seul leur nom subsiste, et il faut les redéposer
 * pour qu'ils soient relus.
 */
export default async function PageConsultation({ params }: Params) {
  const account = await currentAccount();
  if (!account) redirect('/espace/connexion');

  const { id } = await params;
  const consultation = await consultationDuCompte(id, account.id);
  if (!consultation) notFound();

  const fiche = domaineOuNull(consultation.domaine);
  if (!fiche) notFound();

  const tours = await toursDeConsultation(consultation.id);
  const initiaux: Tour[] = tours.map((tour) => ({
    role: tour.role === 'assistant' ? 'assistant' : 'user',
    content: tour.content,
    piece: tour.piece || undefined,
  }));

  return (
    <>
      <Barre retour={{ href: '/juridique/dossiers', label: 'Mes consultations' }} />

      <main className="jur-page jur-narrow">
        <h1 className="jur-h1" style={{ fontSize: 26 }}>
          {consultation.titre}
        </h1>
        <p className="jur-sub">
          {fiche.label} · <a href={`/juridique/${fiche.id}`}>fiche du spécialiste</a>
        </p>

        <Consultation
          domaine={fiche.id}
          label={fiche.label}
          exemples={fiche.exemples}
          consultationInitiale={consultation.id}
          toursInitiaux={initiaux}
          connecte
        />

        <form action={effacer} style={{ marginTop: 28 }}>
          <input type="hidden" name="id" value={consultation.id} />
          <button className="btn btn-ghost btn-danger btn-sm" type="submit">
            Effacer cette consultation
          </button>
        </form>
      </main>
    </>
  );
}
