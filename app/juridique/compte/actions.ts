'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { estFormuleId, formuleDuCompte } from '@/lib/abonnements';
import {
  OWNER_COOKIE,
  createAccount,
  sessionsConfigurees,
  currentAccount,
  findAccountByEmail,
  issueOwnerToken,
  ownerCookieOptions,
  verifyPassword,
} from '@/lib/accounts';
import { QUESTIONS } from '@/lib/profils';
import { getStore, isLocalStore } from '@/lib/store';
import { ValidationError, email as champEmail, text } from '@/lib/validation';

/**
 * Le compte, vu depuis l'assistant juridique.
 *
 * Les comptes sont ceux de Volume3D — même table, même cookie, même
 * empreinte scrypt. Ce qui change ici, c'est où l'on revient après :
 * quelqu'un qui s'inscrit pour poser une question de droit n'a rien à faire
 * dans l'espace des visites 3D, et le renvoyer là-bas serait le meilleur
 * moyen de le perdre.
 */

export interface Resultat {
  ok: boolean;
  error?: string;
}

async function executer(fn: () => Promise<Resultat>): Promise<Resultat> {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof ValidationError) return { ok: false, error: cause.message };
    /* `redirect` lève une exception porteuse d'un `digest` : elle doit
       remonter, sinon la navigation n'a pas lieu. */
    if (cause && typeof cause === 'object' && 'digest' in cause) throw cause;
    console.error('[juridique] action en échec', cause);
    return { ok: false, error: 'Opération impossible. Réessayez dans un instant.' };
  }
}

/**
 * Ce que l'hébergement doit fournir pour qu'un compte existe.
 *
 * La vérification a lieu AVANT la moindre écriture, et c'est tout l'intérêt :
 * sans elle, `createAccount` écrivait la ligne puis la signature du jeton
 * levait, laissant un compte orphelin en base et un message générique à
 * l'écran. La personne réessayait et s'entendait répondre qu'elle avait déjà
 * un compte — sans jamais pouvoir y entrer.
 *
 * Le message nomme la variable manquante. C'est un site qu'on installe
 * soi-même : celui qui le lit est aussi celui qui peut la poser.
 */
function verifierHebergement(): void {
  if (!sessionsConfigurees()) {
    throw new ValidationError(
      'Ce site n’est pas encore configuré pour tenir des comptes : la variable AUTH_SECRET est absente ou trop courte. Les fiches, les délais et le tableau des diagnostics restent consultables sans compte.',
    );
  }
  if (isLocalStore() && process.env.NODE_ENV === 'production') {
    throw new ValidationError(
      'Ce site n’est pas encore relié à une base de données : les comptes créés seraient perdus au premier redéploiement. Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis rejouez supabase/schema.sql.',
    );
  }
}

export async function connexion(_precedent: Resultat | null, formData: FormData): Promise<Resultat> {
  return executer(async () => {
    verifierHebergement();
    const adresse = champEmail(formData.get('email'));
    const motDePasse = String(formData.get('password') ?? '');
    const account = await findAccountByEmail(adresse);

    /* Le même message dans les deux cas : dire « cette adresse n'existe pas »
       révèle qui est client, et une question de droit dit déjà beaucoup de
       celui qui la pose. */
    if (!account || !(await verifyPassword(motDePasse, account.passwordHash))) {
      throw new ValidationError('Adresse ou mot de passe incorrect.');
    }
    if (account.status !== 'active') {
      throw new ValidationError('Ce compte est suspendu. Écrivez-nous.');
    }

    const jar = await cookies();
    jar.set(OWNER_COOKIE, issueOwnerToken(account.id), ownerCookieOptions);
    redirect('/juridique/compte');
  });
}

export async function inscription(_precedent: Resultat | null, formData: FormData): Promise<Resultat> {
  return executer(async () => {
    verifierHebergement();
    const adresse = champEmail(formData.get('email'));
    const motDePasse = String(formData.get('password') ?? '');
    if (motDePasse.length < 10) {
      throw new ValidationError('Choisissez un mot de passe d’au moins dix caractères.');
    }
    if (await findAccountByEmail(adresse)) {
      throw new ValidationError('Un compte existe déjà avec cette adresse. Connectez-vous.');
    }

    const account = await createAccount({
      email: adresse,
      password: motDePasse,
      name: text(formData.get('name'), 'nom', { max: 140 }),
      company: text(formData.get('company'), 'société', { max: 140, required: false }),
      phone: '',
      /* La formule des visites 3D n'est pas choisie ici : le compte est ouvert
         pour le droit, et l'autre produit reste à son entrée de gamme tant que
         personne n'y touche. */
      plan: 'essentiel',
      abonnement: 'decouverte',
    });

    const jar = await cookies();
    jar.set(OWNER_COOKIE, issueOwnerToken(account.id), ownerCookieOptions);
    /* Le profil se demande juste après, sur son propre écran : trois questions
       de plus dans le formulaire d'inscription feraient trois occasions
       d'abandonner avant d'avoir vu la première réponse. */
    redirect('/juridique/compte/profil');
  });
}

/**
 * Enregistrer le profil.
 *
 * Rien n'est obligatoire, et un choix inconnu est ignoré plutôt que refusé :
 * ce formulaire ne garde pas la porte, il renseigne le spécialiste.
 */
export async function enregistrerProfil(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/juridique/compte/connexion');

  const reponses: Record<string, string> = {};
  for (const question of QUESTIONS) {
    const donnee = formData.get(question.cle);
    const valide = question.choix.some((choix) => choix.id === donnee);
    reponses[question.cle] = valide ? String(donnee) : '';
  }

  await getStore().update('accounts', account.id, reponses);
  redirect('/juridique/compte');
}

export async function deconnexion(): Promise<void> {
  const jar = await cookies();
  jar.delete(OWNER_COOKIE);
  redirect('/juridique');
}

/**
 * Changer de formule.
 *
 * Tant qu'aucun prestataire de paiement n'est branché, le changement est
 * immédiat et gratuit — et chaque écran qui le propose l'écrit. C'est le seul
 * comportement honnête : simuler une page de carte bancaire pour une caisse
 * qui n'existe pas serait pire que de ne rien encaisser du tout.
 *
 * Le jour où `STRIPE_SECRET_KEY` existe, c'est ici que la redirection vers la
 * page de paiement remplace l'écriture directe, et rien d'autre ne bouge :
 * les formules, les quotas et leur application sont déjà en place.
 */
export async function changerFormule(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect('/juridique/compte/connexion');

  const demandee = formData.get('formule');
  if (!estFormuleId(demandee)) redirect('/juridique/abonnement');

  if (formuleDuCompte(account.abonnement).id !== demandee) {
    await getStore().update('accounts', account.id, {
      abonnement: demandee,
      abonnementDepuis: new Date().toISOString(),
    });
  }

  redirect('/juridique/compte');
}
