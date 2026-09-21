'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { envoyerLaReinitialisation, envoyerLaVerification, poserLeMotDePasse } from '@/lib/acces';
import {
  COOKIE,
  compteCourant,
  creerCompte,
  emettreSession,
  optionsSession,
  sessionsConfigurees,
  trouverParEmail,
  verifyPassword,
} from '@/lib/comptes';
import { cadence } from '@/lib/cadence';
import { isLocalStore } from '@/lib/store';
import { ValidationError, email as champEmail, text } from '@/lib/validation';

/**
 * Entrer : se connecter, ouvrir un compte, ou reprendre la main sur le sien.
 *
 * Toutes ces actions ont la même forme — vérifier que l'hébergement peut tenir
 * un compte, valider ce qui arrive, écrire, puis renvoyer là où la personne
 * voulait aller. Les erreurs remontent en français, jamais en trace de pile.
 *
 * ── Ce qui n'est jamais dit ici ────────────────────────────────────────────
 * Qu'une adresse a un compte ou non. Un message qui distingue les deux cas est
 * un outil de reconnaissance d'adresses : il dit qui est client d'un service
 * juridique, et c'est déjà une information sur les gens. La connexion répond
 * donc la même chose pour un mot de passe faux et pour une adresse inconnue,
 * et le mot de passe oublié répond la même chose dans les deux cas aussi.
 *
 * L'inscription fait exception, et il n'y a pas moyen de faire autrement :
 * refuser une adresse déjà prise, c'est révéler qu'elle l'est. Le seul choix
 * serait de laisser créer un doublon, ce qui casserait la connexion de
 * quelqu'un qui a déjà un compte — un vrai dommage pour une fuite que le
 * formulaire d'inscription livre de toute façon.
 */

export interface Resultat {
  ok: boolean;
  error?: string;
  /** Rendu après une demande de lien : le message reste à l'écran. */
  message?: string;
}

async function executer(fn: () => Promise<Resultat>): Promise<Resultat> {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof ValidationError) return { ok: false, error: cause.message };
    /* `redirect` lève une exception porteuse d'un `digest` : elle doit
       remonter, sinon la navigation n'a pas lieu. */
    if (cause && typeof cause === 'object' && 'digest' in cause) throw cause;
    console.error('[entrer] action en échec', cause);
    return { ok: false, error: 'Opération impossible. Réessayez dans un instant.' };
  }
}

/**
 * Ce que l'hébergement doit fournir pour qu'un compte existe.
 *
 * La vérification a lieu AVANT la moindre écriture, et c'est tout l'intérêt :
 * sans elle, `creerCompte` écrivait la ligne puis la signature du jeton
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

/**
 * Un frein sur les tentatives, par adresse visée.
 *
 * Il ne remplace pas un mot de passe solide, il rend la force brute lente : au
 * bout de dix essais en un quart d'heure, l'adresse ne répond plus, que le mot
 * de passe soit bon ou non. La clé est l'adresse et non l'appelant — c'est
 * elle qu'on attaque, et elle ne se change pas d'une requête à l'autre comme
 * une adresse IP annoncée.
 */
const FREIN_ENTREE = cadence(10, 15 * 60 * 1000);
/** Les envois de courriel sont plus chers : trois par quart d'heure et par adresse. */
const FREIN_COURRIEL = cadence(3, 15 * 60 * 1000);

export async function connexion(_precedent: Resultat | null, formData: FormData): Promise<Resultat> {
  return executer(async () => {
    verifierHebergement();
    const adresse = champEmail(formData.get('email'));
    const motDePasse = String(formData.get('password') ?? '');

    if (FREIN_ENTREE.depasse(`entree:${adresse}`)) {
      throw new ValidationError(
        'Trop de tentatives sur cette adresse. Attendez un quart d’heure, ou demandez un nouveau mot de passe.',
      );
    }

    const compte = await trouverParEmail(adresse);
    if (!compte || !(await verifyPassword(motDePasse, compte.passwordHash))) {
      throw new ValidationError('Adresse ou mot de passe incorrect.');
    }
    if (compte.statut !== 'active') {
      throw new ValidationError('Ce compte est suspendu. Écrivez-nous.');
    }

    const jar = await cookies();
    jar.set(COOKIE, emettreSession(compte.id), optionsSession);
    redirect('/espace');
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
    if (await trouverParEmail(adresse)) {
      throw new ValidationError('Un compte existe déjà avec cette adresse. Connectez-vous.');
    }

    const compte = await creerCompte({
      email: adresse,
      motDePasse,
      nom: text(formData.get('name'), 'nom', { max: 140 }),
    });

    /* Le courriel de confirmation part, et son échec n'arrête rien : le compte
       existe, la personne est dedans, et l'espace lui proposera de renvoyer le
       message. Bloquer ici reviendrait à perdre un client parce qu'une clé
       d'API tierce a hoqueté. */
    await envoyerLaVerification(compte);

    const jar = await cookies();
    jar.set(COOKIE, emettreSession(compte.id), optionsSession);
    /* Le profil se demande juste après, sur son propre écran : trois questions
       de plus dans le formulaire d'inscription feraient trois occasions
       d'abandonner avant d'avoir vu la première réponse. */
    redirect('/espace/compte/profil');
  });
}

/**
 * Demander un lien de réinitialisation.
 *
 * Répond la même chose que l'adresse ait un compte ou non, et prend le même
 * temps : la réponse est écrite avant de savoir, et l'envoi n'a lieu qu'après.
 */
export async function demanderLeLien(
  _precedent: Resultat | null,
  formData: FormData,
): Promise<Resultat> {
  return executer(async () => {
    verifierHebergement();
    const adresse = champEmail(formData.get('email'));

    const reponse: Resultat = {
      ok: true,
      message:
        'Si un compte existe à cette adresse, un lien vient d’y être envoyé. Il est valable une heure. Pensez à regarder vos indésirables.',
    };

    if (FREIN_COURRIEL.depasse(`oubli:${adresse}`)) return reponse;

    const compte = await trouverParEmail(adresse);
    if (compte && compte.statut === 'active') await envoyerLaReinitialisation(compte);

    return reponse;
  });
}

/** Poser le nouveau mot de passe, au bout du lien reçu. */
export async function reinitialiser(
  _precedent: Resultat | null,
  formData: FormData,
): Promise<Resultat> {
  return executer(async () => {
    verifierHebergement();
    const jeton = String(formData.get('jeton') ?? '');
    const motDePasse = String(formData.get('password') ?? '');
    const confirmation = String(formData.get('password2') ?? '');

    if (motDePasse.length < 10) {
      throw new ValidationError('Choisissez un mot de passe d’au moins dix caractères.');
    }
    if (motDePasse !== confirmation) {
      throw new ValidationError('Les deux mots de passe ne sont pas identiques.');
    }

    const etat = await poserLeMotDePasse(jeton, motDePasse);
    if (etat === 'expire') {
      throw new ValidationError('Ce lien a expiré. Demandez-en un nouveau, il est valable une heure.');
    }
    if (etat === 'deja-utilise') {
      throw new ValidationError('Ce lien a déjà servi. Demandez-en un nouveau si vous en avez besoin.');
    }
    if (etat !== 'valide') {
      throw new ValidationError('Ce lien n’est pas valable. Demandez-en un nouveau.');
    }

    /* Pas de connexion automatique : quelqu'un vient de changer un mot de
       passe, il doit pouvoir vérifier tout de suite qu'il fonctionne. Et si le
       lien avait été intercepté, l'attaquant n'obtient pas une session au
       passage. */
    redirect('/entrer?repris=1');
  });
}
