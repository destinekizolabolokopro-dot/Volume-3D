import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Barre } from '@/components/Barre';
import { Pied } from '@/components/Pied';
import { formuleDuCompte, paiementConfigure, prixLisible, quotaLisible } from '@/lib/abonnements';
import { compteCourant } from '@/lib/comptes';
import { consultationsDuCompte, questionsDuMois } from '@/lib/consultations';
import { deconnexion } from '@/app/compte/actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mon compte',
  robots: { index: false, follow: false },
};

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/**
 * Le compte : la formule, ce qu'il en reste, et la sortie.
 *
 * La consommation est affichée avant tout le reste. Un quota qu'on découvre
 * au moment où il bloque est une mauvaise surprise ; un quota qu'on voit
 * descendre est une information — et, le cas échéant, la seule raison
 * honnête de proposer une formule supérieure.
 */
export default async function Compte() {
  const compte = await compteCourant();
  if (!compte) redirect('/compte/connexion');

  const formule = formuleDuCompte(compte.abonnement);
  const [utilisees, fils] = await Promise.all([
    questionsDuMois(compte.id),
    consultationsDuCompte(compte.id),
  ]);

  const illimite = !Number.isFinite(formule.quota);
  const restant = illimite ? null : Math.max(0, formule.quota - utilisees);
  const part = illimite ? 0 : Math.min(100, Math.round((utilisees / formule.quota) * 100));

  return (
    <>
      <Barre retour={{ href: '/', label: 'L’assistant' }} />

      <main className="jur-page jur-etroit">
        <p className="jur-oeil">Mon compte</p>
        <h1 className="jur-h1 jur-h1-moyen">{compte.nom || compte.email}</h1>
        <p className="jur-lede">{compte.email}</p>

        <section className="jur-carte-compte">
          <div className="jur-carte-compte-tete">
            <div>
              <p className="jur-oeil">Formule</p>
              <p className="jur-formule-nom">{formule.nom}</p>
            </div>
            <p className="jur-formule-prix">
              {prixLisible(formule)}
              {formule.prix > 0 && <span> / mois</span>}
            </p>
          </div>

          <p className="jur-formule-pour">{quotaLisible(formule)}.</p>

          {!illimite && (
            <div className="jur-jauge" role="img" aria-label={`${utilisees} questions posées sur ${formule.quota}`}>
              <span style={{ width: `${part}%` }} />
            </div>
          )}

          <p className="jur-compteur">
            {illimite
              ? `Questions sans limite. ${utilisees} posées en ${MOIS.format(new Date())}.`
              : `${utilisees} question${utilisees > 1 ? 's' : ''} posée${utilisees > 1 ? 's' : ''} en ${MOIS.format(new Date())}, ${restant} restante${(restant ?? 0) > 1 ? 's' : ''}. Le compteur repart le 1ᵉʳ du mois.`}
          </p>

          <div className="jur-carte-compte-actions">
            <a className="btn btn-accent btn-sm" href="/abonnement">
              {formule.id === 'cabinet' ? 'Voir les formules' : 'Changer de formule'}
            </a>
            <a className="btn btn-ghost btn-sm" href="/dossiers">
              Mes consultations ({fils.length})
            </a>
          </div>
        </section>

        {!paiementConfigure() && (
          <p className="jur-note-paiement">
            Aucun prestataire de paiement n’est branché sur ce site : les formules payantes
            s’activent immédiatement et gratuitement. C’est écrit ici plutôt que caché derrière une
            page de carte bancaire qui n’encaisserait rien.
          </p>
        )}

        <form action={deconnexion} className="jur-section">
          <button className="btn btn-ghost btn-sm" type="submit">
            Se déconnecter
          </button>
        </form>
      </main>

      <Pied />
    </>
  );
}
