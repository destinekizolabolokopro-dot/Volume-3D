'use server';

import Anthropic from '@anthropic-ai/sdk';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cadence } from '@/lib/cadence';
import { effacerLeSecret, enregistrerLeSecret } from '@/lib/reglages';
import {
  COOKIE,
  emettreSession,
  estProprietaire,
  motDePasseJuste,
  obstacle,
  optionsSession,
} from '@/lib/proprietaire';

/**
 * Les actions de l'espace de réglages.
 *
 * Trois choses s'y font : entrer, poser une clé, la retirer. Chacune vérifie
 * la session avant d'agir — une action serveur est une URL comme une autre,
 * et se protéger uniquement en n'affichant pas le bouton ne protège de rien.
 */

export interface Resultat {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Cinq tentatives par minute et par instance.
 *
 * Le frein est là parce que `ADMIN_PASSWORD` est le seul secret qui garde
 * cette porte : sans lui, un mot de passe de douze caractères tombe en
 * quelques heures d'essais automatisés. Il est volontairement global et non
 * par adresse — une attaque par force brute vient rarement d'une seule.
 */
const FREIN = cadence(5, 60_000);

export async function entrer(_precedent: Resultat | null, formData: FormData): Promise<Resultat> {
  const empeche = obstacle();
  if (empeche) return { ok: false, error: empeche };

  if (FREIN.depasse('reglages')) {
    return { ok: false, error: 'Trop de tentatives. Attendez une minute avant de réessayer.' };
  }

  const fourni = String(formData.get('motdepasse') ?? '');
  if (!motDePasseJuste(fourni)) {
    /* Le même message quoi qu'il arrive, et aucune indication de longueur ou
       de préfixe juste : chaque détail rend l'essai suivant meilleur. */
    return { ok: false, error: 'Mot de passe incorrect.' };
  }

  const jar = await cookies();
  jar.set(COOKIE, emettreSession(), optionsSession);
  redirect('/reglages');
}

export async function sortir(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect('/');
}

/**
 * Enregistre la clé — après l'avoir essayée pour de bon.
 *
 * L'essai n'est pas un luxe : une clé fausse enregistrée sans contrôle ne se
 * découvre qu'à la première question posée par un client, sous la forme d'un
 * message d'erreur générique. `models.list()` est un appel authentifié qui ne
 * produit aucun jeton, donc l'essai ne coûte rien.
 */
export async function poserLaCle(_precedent: Resultat | null, formData: FormData): Promise<Resultat> {
  if (!(await estProprietaire())) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  const cle = String(formData.get('cle') ?? '').trim();
  if (!cle) return { ok: false, error: 'Collez la clé avant d’enregistrer.' };
  if (!cle.startsWith('sk-ant-')) {
    return { ok: false, error: 'Ce n’est pas une clé Anthropic : elles commencent toutes par « sk-ant- ».' };
  }

  try {
    await new Anthropic({ apiKey: cle }).models.list({ limit: 1 });
  } catch (cause) {
    const statut = (cause as { status?: number }).status;
    if (statut === 401) {
      return { ok: false, error: 'Anthropic refuse cette clé. Vérifiez qu’elle a été copiée en entier et qu’elle n’a pas été révoquée.' };
    }
    if (statut === 403) {
      return { ok: false, error: 'Cette clé existe mais n’a pas les droits nécessaires. Vérifiez son périmètre dans la console Anthropic.' };
    }
    return {
      ok: false,
      error: 'Impossible de joindre Anthropic pour vérifier la clé. Elle n’a pas été enregistrée — réessayez dans un instant.',
    };
  }

  await enregistrerLeSecret('cle-modele', cle);
  return { ok: true, message: 'Clé vérifiée auprès d’Anthropic et enregistrée. L’assistant répond dès maintenant.' };
}

export async function retirerLaCle(): Promise<void> {
  if (!(await estProprietaire())) redirect('/reglages');
  await effacerLeSecret('cle-modele');
  redirect('/reglages');
}

/**
 * La clé d'envoi de courriels, essayée avant d'être gardée.
 *
 * Même principe que pour la clé du modèle, et pour la même raison : une clé
 * fausse enregistrée sans contrôle ne se découvre qu'au moment où un client
 * a perdu son mot de passe et n'arrive pas à le reprendre. `GET /domains`
 * est un appel authentifié qui n'envoie aucun message et ne coûte rien.
 */
export async function poserLaCleCourriel(
  _precedent: Resultat | null,
  formData: FormData,
): Promise<Resultat> {
  if (!(await estProprietaire())) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  const cle = String(formData.get('cle') ?? '').trim();
  if (!cle) return { ok: false, error: 'Collez la clé avant d’enregistrer.' };
  if (!cle.startsWith('re_')) {
    return { ok: false, error: 'Ce n’est pas une clé Resend : elles commencent toutes par « re_ ».' };
  }

  let reponse: Response;
  try {
    reponse = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${cle}` },
    });
  } catch {
    return {
      ok: false,
      error: 'Impossible de joindre Resend pour vérifier la clé. Elle n’a pas été enregistrée — réessayez dans un instant.',
    };
  }

  if (reponse.status === 401 || reponse.status === 403) {
    return { ok: false, error: 'Resend refuse cette clé. Vérifiez qu’elle a été copiée en entier et qu’elle n’a pas été révoquée.' };
  }
  if (!reponse.ok) {
    return { ok: false, error: `Resend répond ${reponse.status}. La clé n’a pas été enregistrée.` };
  }

  await enregistrerLeSecret('cle-courriel', cle);
  return {
    ok: true,
    message: 'Clé vérifiée auprès de Resend et enregistrée. Les confirmations d’adresse et les mots de passe oubliés partent dès maintenant.',
  };
}

export async function retirerLaCleCourriel(): Promise<void> {
  if (!(await estProprietaire())) redirect('/reglages');
  await effacerLeSecret('cle-courriel');
  redirect('/reglages');
}
