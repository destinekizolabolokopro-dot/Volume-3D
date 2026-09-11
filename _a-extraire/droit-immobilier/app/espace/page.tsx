import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Assistant } from '@/components/Assistant';
import { formuleDuCompte, quotaLisible } from '@/lib/abonnements';
import { compteCourant } from '@/lib/comptes';
import { consultationsDuCompte, questionsDuMois } from '@/lib/consultations';
import { ESPACE } from '@/lib/copie';
import { DOMAINES, domaine } from '@/lib/domaines';
import { estJuristeConfigure } from '@/lib/juriste';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Poser une question',
  robots: { index: false, follow: false },
};

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/**
 * L'assistant, dans l'espace de travail.
 *
 * C'est la même conversation que sur l'accueil, et c'est le même composant —
 * mais ici rien ne vend. Pas de grille de spécialités à parcourir, pas de
 * formules, pas d'appel à créer un compte : celui qui arrive ici a déjà
 * décidé, il vient poser une question. Ce qui l'accompagne à la place est ce
 * dont il a besoin pour continuer : ce qu'il lui reste ce mois-ci, et ses
 * trois derniers fils, pour reprendre là où il s'était arrêté.
 */
export default async function Espace() {
  const compte = await compteCourant();
  if (!compte) redirect('/entrer');

  const fiches = DOMAINES.map((fiche) => ({
    id: fiche.id,
    label: fiche.label,
    resume: fiche.resume,
    delais: fiche.delais,
    verifications: fiche.verifications,
  }));

  const exemples = (['bail-habitation', 'courte-duree', 'travaux', 'profession'] as const).map(
    (id) => domaine(id).exemples[0],
  );

  const formule = formuleDuCompte(compte.abonnement);
  const [posees, fils] = await Promise.all([
    questionsDuMois(compte.id),
    consultationsDuCompte(compte.id),
  ]);
  const illimite = !Number.isFinite(formule.quota);
  const restant = illimite ? null : Math.max(0, formule.quota - posees);
  const recents = fils.slice(0, 3);

  return (
    <Assistant
      fiches={fiches}
      exemples={exemples}
      connecte
      actif={await estJuristeConfigure()}
      entete={ESPACE}
      /* La `key` sur ce cartouche n'est pas une coquetterie.
      
         Il est rendu par le serveur, puis passé en PROPRIÉTÉ à un composant
         client, où il devient l'un des deux enfants du haut de page. React
         marque comme « vérifiés » les éléments qu'il voit naître dans un JSX
         statique, et sait alors qu'ils n'ont pas besoin de clé ; celui-ci
         traverse la frontière serveur-client et arrive sans cette marque. Sans
         la clé, la console de chaque visiteur se remplissait d'un
         avertissement portant sur du code sans défaut — et une console qui
         crie pour rien est une console qu'on cesse de lire. */
      preuve={
        <aside className="jur-preuve-carte" aria-label="Votre formule" key="cartouche">
          <p className="jur-oeil">Votre formule</p>

          <dl className="jur-etat-formule">
            <div>
              <dt>{formule.nom}</dt>
              <dd>{quotaLisible(formule)}</dd>
            </div>
            <div>
              <dt>{restant === null ? 'Sans limite' : restant}</dt>
              <dd>
                {restant === null
                  ? 'questions ce mois-ci'
                  : `question${restant > 1 ? 's' : ''} restante${restant > 1 ? 's' : ''} ce mois-ci`}
              </dd>
            </div>
          </dl>

          {recents.length > 0 && (
            <div className="jur-recents">
              <p className="jur-recents-titre">Reprendre</p>
              <ul>
                {recents.map((fil) => (
                  <li key={fil.id}>
                    <a href={`/espace/dossiers/${fil.id}`}>{fil.titre}</a>
                    <span>{JOUR.format(new Date(fil.updatedAt))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      }
    >
      {null}
    </Assistant>
  );
}
