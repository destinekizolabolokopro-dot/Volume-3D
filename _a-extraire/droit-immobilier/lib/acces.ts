import 'server-only';
import { MARQUE } from './copie';
import { adresseDuSite, envoyerLeCourriel, type ResultatEnvoi } from './courriel';
import { randomId } from './ids';
import {
  empreinteDuJeton,
  etatDuJeton,
  expirationDepuis,
  fabriquerJeton,
  type EtatJeton,
  type UsageJeton,
} from './jetons';
import { hashPassword } from './sessions';
import { getStore } from './store';
import type { CompteJuridique, JetonCompte } from './types';

/**
 * Confirmer une adresse, reprendre la main sur un compte.
 *
 * Les deux parcours ont la même mécanique — on tire un jeton, on en garde
 * l'empreinte, on envoie le lien, on le consomme une fois — et c'est pour
 * cela qu'ils vivent dans le même fichier : deux implémentations séparées de
 * la même chose finissent toujours par diverger sur le détail qui compte.
 *
 * ── Ce qui n'est jamais dit à l'écran ──────────────────────────────────────
 * Qu'une adresse a un compte ou non. « Aucun compte à cette adresse » est un
 * outil de reconnaissance d'adresses offert à qui en essaie mille : il dit qui
 * est client d'un service juridique, ce qui est en soi une information. Les
 * deux parcours répondent donc exactement la même chose dans les deux cas —
 * « si un compte existe, le message est parti » — et seul le contenu de la
 * boîte mail fait la différence.
 *
 * ── Pourquoi les anciens jetons meurent ────────────────────────────────────
 * Demander un second lien annule le premier. Sans cela, dix demandes laissent
 * dix liens vivants pendant une heure, et il suffit qu'un seul traîne dans un
 * historique ou un journal de serveur mandataire pour que le compte soit
 * ouvert.
 */

interface Demande {
  compte: CompteJuridique;
  usage: UsageJeton;
}

/** Émet un jeton, éteint les précédents du même usage, et renvoie le lien. */
async function emettre({ compte, usage }: Demande): Promise<string> {
  const store = getStore();

  const anciens = await store.list('jetonsCompte', { compteId: compte.id, usage });
  for (const ancien of anciens) {
    if (!ancien.utiliseA) await store.update('jetonsCompte', ancien.id, { utiliseA: new Date().toISOString() });
  }

  const jeton = fabriquerJeton();
  const ligne: JetonCompte = {
    id: randomId(),
    compteId: compte.id,
    usage,
    empreinte: empreinteDuJeton(jeton),
    expireA: expirationDepuis(),
    utiliseA: '',
    createdAt: new Date().toISOString(),
  };
  await store.insert('jetonsCompte', ligne);

  const chemin = usage === 'verification' ? 'verifier' : 'mot-de-passe';
  return `${adresseDuSite()}/${chemin}/${jeton}`;
}

/**
 * Relit un jeton reçu dans un lien et dit ce qu'il vaut.
 *
 * La lecture se fait par empreinte, jamais en parcourant les lignes : le
 * chemin est le même qu'il y ait dix jetons ou dix mille, et l'index de la
 * base le rend constant.
 */
export async function relireJeton(
  jeton: string,
  usage: UsageJeton,
): Promise<{ etat: EtatJeton; ligne: JetonCompte | null; compte: CompteJuridique | null }> {
  if (!jeton) return { etat: 'inconnu', ligne: null, compte: null };

  const store = getStore();
  const trouves = await store.list('jetonsCompte', { empreinte: empreinteDuJeton(jeton), usage });
  const ligne = trouves[0] ?? null;
  const etat = etatDuJeton(ligne);
  if (etat !== 'valide' || !ligne) return { etat, ligne, compte: null };

  const compte = await store.get('comptesJuridiques', ligne.compteId);
  /* Le compte a pu être effacé entre l'envoi du lien et le clic. Un jeton qui
     ne mène à personne n'est pas « expiré » : il est inconnu. */
  if (!compte || compte.statut !== 'active') return { etat: 'inconnu', ligne, compte: null };

  return { etat: 'valide', ligne, compte };
}

async function consommer(ligne: JetonCompte): Promise<void> {
  await getStore().update('jetonsCompte', ligne.id, { utiliseA: new Date().toISOString() });
}

/* ------------------------------------------------------ confirmer l'adresse */

export async function envoyerLaVerification(compte: CompteJuridique): Promise<ResultatEnvoi> {
  if (compte.emailVerifieA) return { envoye: true };

  const lien = await emettre({ compte, usage: 'verification' });
  return envoyerLeCourriel({
    a: compte.email,
    objet: `Confirmez votre adresse — ${MARQUE.nom}`,
    texte: [
      `Bonjour${compte.nom ? ` ${compte.nom}` : ''},`,
      '',
      `Votre compte ${MARQUE.nom} est ouvert : vous pouvez déjà poser vos questions.`,
      '',
      'Confirmez votre adresse pour pouvoir passer à une formule payante et pour pouvoir reprendre la main sur votre compte si vous en perdez le mot de passe :',
      lien,
      '',
      'Ce lien est valable une heure. Passé ce délai, demandez-en un autre depuis votre espace.',
      '',
      'Si vous n’avez pas créé de compte, ignorez ce message : sans ce lien, rien ne se passe.',
    ].join('\n'),
  });
}

export async function confirmerLAdresse(jeton: string): Promise<EtatJeton> {
  const { etat, ligne, compte } = await relireJeton(jeton, 'verification');
  if (etat !== 'valide' || !ligne || !compte) return etat;

  await consommer(ligne);
  /* Déjà confirmée : on consomme quand même le jeton et on répond « valide ».
     Un lien cliqué deux fois doit rassurer, pas inquiéter. */
  if (!compte.emailVerifieA) {
    await getStore().update('comptesJuridiques', compte.id, { emailVerifieA: new Date().toISOString() });
  }
  return 'valide';
}

/* ----------------------------------------------------- mot de passe oublié */

export async function envoyerLaReinitialisation(compte: CompteJuridique): Promise<ResultatEnvoi> {
  const lien = await emettre({ compte, usage: 'mot-de-passe' });
  return envoyerLeCourriel({
    a: compte.email,
    objet: `Reprendre la main sur votre compte — ${MARQUE.nom}`,
    texte: [
      `Bonjour${compte.nom ? ` ${compte.nom}` : ''},`,
      '',
      'Quelqu’un a demandé un nouveau mot de passe pour ce compte. Si c’est vous, choisissez-en un ici :',
      lien,
      '',
      'Ce lien est valable une heure et ne sert qu’une fois. Demander un nouveau lien annule celui-ci.',
      '',
      'Si ce n’est pas vous, ignorez ce message. Votre mot de passe actuel reste valable et personne n’a eu accès à votre compte.',
    ].join('\n'),
  });
}

/**
 * Pose le nouveau mot de passe et referme tout le reste.
 *
 * Les autres jetons du compte sont éteints au passage : quelqu'un qui reprend
 * la main sur son compte le fait souvent PARCE QUE quelque chose lui a
 * échappé, et laisser vivre un lien émis entre-temps reviendrait à ne rien
 * avoir refermé.
 */
export async function poserLeMotDePasse(jeton: string, motDePasse: string): Promise<EtatJeton> {
  const { etat, ligne, compte } = await relireJeton(jeton, 'mot-de-passe');
  if (etat !== 'valide' || !ligne || !compte) return etat;

  const store = getStore();
  await store.update('comptesJuridiques', compte.id, { passwordHash: await hashPassword(motDePasse) });
  await consommer(ligne);

  const restants = await store.list('jetonsCompte', { compteId: compte.id });
  for (const autre of restants) {
    if (!autre.utiliseA) await store.update('jetonsCompte', autre.id, { utiliseA: new Date().toISOString() });
  }

  return 'valide';
}
