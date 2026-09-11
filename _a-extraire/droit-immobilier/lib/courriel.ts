import 'server-only';
import { desceller } from './coffre';
import { MARQUE } from './copie';
import { getStore } from './store';

/**
 * L'envoi des courriels.
 *
 * Ce site n'envoie que trois messages, et aucun n'est une lettre
 * d'information : confirmer une adresse, réinitialiser un mot de passe,
 * accuser réception d'un compte créé. Un service qui n'écrit qu'à cela n'a pas
 * besoin d'une file d'attente, d'un moteur de gabarits ni d'un suivi
 * d'ouverture — il a besoin que le message parte, et qu'on sache s'il n'est
 * pas parti.
 *
 * ── Pourquoi Resend et pas SMTP ────────────────────────────────────────────
 * Parce qu'une clé suffit, et qu'il n'y a rien à installer. SMTP demande un
 * hôte, un port, un identifiant, un mot de passe, et une configuration DNS
 * qu'on découvre en voyant ses messages partir en indésirables. Le jour où ce
 * choix ne convient plus, tout ce qu'il y a à réécrire est `expedier()` : le
 * reste du site appelle `envoyerLeCourriel` et ignore par où ça passe.
 *
 * ── Quand rien n'est configuré ─────────────────────────────────────────────
 * Le site ne tombe pas et ne fait pas semblant. `courrielConfigure()` répond
 * non, les écrans qui en dépendent le disent en toutes lettres, et en
 * développement le lien est écrit dans la console du serveur pour qu'on puisse
 * suivre le parcours sans clé. C'est la seule concession, et elle ne vaut
 * qu'hors production.
 */

const CLE_COURRIEL = 'cle-courriel';
const EXPEDITEUR_DEFAUT = 'onboarding@resend.dev';

/**
 * La clé Resend : variable d'environnement d'abord, réglages ensuite.
 *
 * Le même ordre que pour la clé du modèle, et pour la même raison — voir
 * l'en-tête de lib/reglages.ts.
 */
export async function cleDuCourriel(): Promise<string | null> {
  const variable = process.env.RESEND_API_KEY?.trim();
  if (variable) return variable;

  try {
    const ligne = await getStore().get('reglages', CLE_COURRIEL);
    return ligne ? desceller(ligne.valeur) : null;
  } catch {
    return null;
  }
}

export async function courrielConfigure(): Promise<boolean> {
  return (await cleDuCourriel()) !== null;
}

/**
 * L'adresse d'expédition.
 *
 * Sans `COURRIEL_EXPEDITEUR`, on retombe sur le domaine de bac à sable de
 * Resend : il fonctionne sans vérifier un domaine, mais il n'écrit qu'à
 * l'adresse du titulaire du compte. C'est assez pour essayer, jamais pour
 * ouvrir aux clients — et l'espace des réglages le dit.
 */
export function expediteur(): string {
  const pose = process.env.COURRIEL_EXPEDITEUR?.trim();
  if (pose) return pose;
  return `${MARQUE.nom} <${EXPEDITEUR_DEFAUT}>`;
}

export function expediteurEstProvisoire(): boolean {
  return !process.env.COURRIEL_EXPEDITEUR?.trim();
}

export interface Courriel {
  a: string;
  objet: string;
  /** Le corps, en texte simple. Une ligne par paragraphe. */
  texte: string;
}

export type ResultatEnvoi =
  | { envoye: true }
  | { envoye: false; raison: 'non-configure' | 'refus'; detail?: string };

/**
 * Envoie, ou dit pourquoi il n'a pas envoyé.
 *
 * Ne lève jamais. Un courriel qui ne part pas ne doit pas faire échouer la
 * création d'un compte : la personne est déjà entrée, et on lui proposera de
 * renvoyer le message. Ce qui serait grave, c'est de ne pas le savoir — d'où
 * le retour explicite plutôt qu'un booléen.
 */
export async function envoyerLeCourriel(courriel: Courriel): Promise<ResultatEnvoi> {
  const cle = await cleDuCourriel();
  if (!cle) {
    tracer(courriel);
    return { envoye: false, raison: 'non-configure' };
  }

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: expediteur(),
        to: [courriel.a],
        subject: courriel.objet,
        text: courriel.texte,
      }),
    });

    if (!reponse.ok) {
      /* Le corps de la réponse nomme la cause — domaine non vérifié, clé
         révoquée, adresse refusée. Il part dans le journal du serveur et
         jamais à l'écran : il peut contenir l'adresse d'un tiers. */
      const detail = await reponse.text().catch(() => '');
      console.error(`[courriel] refus ${reponse.status}`, detail.slice(0, 500));
      return { envoye: false, raison: 'refus', detail: String(reponse.status) };
    }

    return { envoye: true };
  } catch (cause) {
    console.error('[courriel] envoi impossible', cause);
    return { envoye: false, raison: 'refus' };
  }
}

/**
 * Hors production et sans clé, le message est écrit dans la console.
 *
 * C'est ce qui permet de suivre une inscription ou une réinitialisation de
 * bout en bout sur une machine de développement, sans compte chez personne.
 * En production, rien n'est écrit : un lien de réinitialisation dans un
 * journal est un mot de passe dans un journal.
 */
function tracer(courriel: Courriel): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info(
    `\n[courriel] aucune clé RESEND_API_KEY — message NON envoyé\n  à      : ${courriel.a}\n  objet  : ${courriel.objet}\n${courriel.texte
      .split('\n')
      .map((l) => `  | ${l}`)
      .join('\n')}\n`,
  );
}

/** L'adresse publique du site, pour fabriquer les liens d'un courriel. */
export function adresseDuSite(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
