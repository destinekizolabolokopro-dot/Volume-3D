import 'server-only';
import { desceller, sceller } from './coffre';
import { empreinte } from './reglages-empreinte';
import { getStore } from './store';
import type { Reglage } from './types';

/**
 * Là où vit la clé du modèle, et d'où elle vient.
 *
 * Deux sources, dans cet ordre :
 *
 * 1. `ANTHROPIC_API_KEY`, la variable d'environnement. Elle gagne toujours.
 * 2. Le réglage posé depuis `/reglages`, chiffré en base.
 *
 * Cet ordre n'est pas arbitraire. La variable d'environnement est le moyen
 * standard, celui que connaissent les hébergeurs et les outils de rotation de
 * secrets ; si quelqu'un prend la peine de la poser, c'est qu'il veut qu'elle
 * s'applique, et la voir silencieusement écrasée par une valeur en base serait
 * le genre de surprise qu'on met une journée à comprendre. L'espace de
 * réglages sert à qui n'a pas envie d'ouvrir un tableau de bord d'hébergeur —
 * et à changer de clé sans redéployer.
 *
 * La clé ne sort d'ici qu'à destination du SDK. Elle n'est jamais renvoyée au
 * navigateur, jamais journalisée, jamais réaffichée en entier : `empreinte()`
 * est la seule forme qui remonte à l'écran.
 */

/**
 * Les secrets que le propriétaire peut poser depuis l'écran, et leur variable
 * d'environnement équivalente.
 *
 * Deux aujourd'hui : la clé du modèle, sans laquelle rien ne répond, et celle
 * de l'envoi de courriels, sans laquelle un mot de passe perdu ne se reprend
 * pas. Elles se comportent EXACTEMENT pareil — variable d'environnement
 * d'abord, réglage chiffré ensuite, empreinte à l'écran, retrait possible — et
 * c'est pour cela qu'elles partagent ce fichier plutôt que d'en avoir chacune
 * une copie qui finirait par diverger sur le détail qui compte.
 */
export const SECRETS = {
  'cle-modele': 'ANTHROPIC_API_KEY',
  'cle-courriel': 'RESEND_API_KEY',
} as const;

export type SecretId = keyof typeof SECRETS;

const CLE_MODELE: SecretId = 'cle-modele';

export type Source = 'environnement' | 'reglages' | null;

export interface EtatDeLaCle {
  source: Source;
  /** « sk-ant-…4f21 » : de quoi reconnaître SA clé, pas de quoi s'en servir. */
  empreinte: string;
  /** Quand elle a été posée depuis les réglages. Vide pour une variable. */
  depuis: string;
  /**
   * Vrai quand une valeur existe en base mais ne se déchiffre pas — typiquement
   * après un changement d'`AUTH_SECRET`. La page le dit et propose de
   * ressaisir, au lieu de laisser croire qu'une clé est en place.
   */
  illisible: boolean;
}

export { empreinte } from './reglages-empreinte';

/**
 * La valeur d'un secret, variable d'environnement d'abord.
 *
 * `process.env[nom]` est lu par un accès dynamique, ce qui suffit ici : ces
 * deux variables sont lues côté serveur uniquement, jamais inlinées dans un
 * paquet client — elles ne portent pas le préfixe `NEXT_PUBLIC_`.
 */
export async function secret(id: SecretId): Promise<string | null> {
  const variable = process.env[SECRETS[id]]?.trim();
  if (variable) return variable;

  try {
    const ligne = await getStore().get('reglages', id);
    if (!ligne) return null;
    return desceller(ligne.valeur);
  } catch {
    /* Base injoignable : c'est une panne, pas une absence de clé. On répond
       comme si elle manquait — le site reste consultable et le dit. */
    return null;
  }
}

export function cleDuModele(): Promise<string | null> {
  return secret(CLE_MODELE);
}

export async function etatDuSecret(id: SecretId): Promise<EtatDeLaCle> {
  const variable = process.env[SECRETS[id]]?.trim();
  if (variable) {
    return { source: 'environnement', empreinte: empreinte(variable), depuis: '', illisible: false };
  }

  /* La base est lue sous garde. /reglages est la page où l'on vient RÉPARER
     ce qui ne va pas ; la voir tomber en erreur 500 parce que la base ne
     répond pas ferme la porte au moment précis où il faut l'ouvrir. Une
     lecture impossible se raconte donc comme une absence de clé, et la page
     reste affichable. */
  let ligne: Reglage | null = null;
  try {
    ligne = await getStore().get('reglages', id);
  } catch {
    return { source: null, empreinte: '', depuis: '', illisible: false };
  }

  if (!ligne) return { source: null, empreinte: '', depuis: '', illisible: false };

  const clair = desceller(ligne.valeur);
  if (!clair) return { source: null, empreinte: '', depuis: ligne.majAt, illisible: true };

  return { source: 'reglages', empreinte: empreinte(clair), depuis: ligne.majAt, illisible: false };
}

export function etatDeLaCle(): Promise<EtatDeLaCle> {
  return etatDuSecret(CLE_MODELE);
}

export async function enregistrerLeSecret(id: SecretId, valeur: string): Promise<void> {
  const store = getStore();
  const ligne = { id, valeur: sceller(valeur.trim()), majAt: new Date().toISOString() };
  const existante = await store.get('reglages', id);
  if (existante) await store.update('reglages', id, ligne);
  else await store.insert('reglages', ligne);
}

export async function effacerLeSecret(id: SecretId): Promise<void> {
  await getStore().remove('reglages', { id });
}
