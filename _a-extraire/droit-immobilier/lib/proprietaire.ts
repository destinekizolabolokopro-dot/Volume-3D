import 'server-only';
import { cookies } from 'next/headers';
import { memeSecret } from './coffre';
import { emettreJeton, lireJeton, optionsDuCookie } from './sessions';

/**
 * La porte des réglages.
 *
 * Elle ne s'ouvre pas avec un compte client. C'est délibéré : un compte client
 * se crée librement, et si l'un d'eux était compromis — mot de passe réutilisé
 * ailleurs, hameçonnage —, la clé d'API partirait avec. Les réglages ont donc
 * leur propre mot de passe, `ADMIN_PASSWORD`, qui ne sert qu'à ça et qui n'est
 * jamais saisi sur une page publique.
 *
 * Trois précautions valent d'être dites.
 *
 * `ADMIN_PASSWORD` doit faire douze caractères au minimum, sinon la porte
 * refuse de s'ouvrir pour tout le monde. Un espace d'administration derrière
 * « admin » serait pire que pas d'espace du tout — il n'y aurait plus qu'une
 * seule porte à pousser, et elle serait ouverte.
 *
 * La comparaison est à temps constant (voir `memeSecret`). Un `===` sur un mot
 * de passe s'arrête au premier caractère faux, et le temps de réponse dit
 * alors combien de caractères sont justes.
 *
 * Le jeton porte sa propre portée, « reglages » : un cookie de session client
 * ne vaut rien ici, même signé du même `AUTH_SECRET`.
 */

export const COOKIE = 'jur_reglages';
const PORTEE = 'reglages';
const LONGUEUR_MINIMALE = 12;

export function reglagesConfigures(): boolean {
  const valeur = process.env.ADMIN_PASSWORD;
  return Boolean(valeur && valeur.length >= LONGUEUR_MINIMALE);
}

/** Ce qui manque à l'hébergement pour que la porte existe, en une phrase. */
export function obstacle(): string {
  const valeur = process.env.ADMIN_PASSWORD;
  if (!valeur) {
    return 'Cet espace est fermé : la variable ADMIN_PASSWORD n’est pas posée sur ce site. Ajoutez-la dans la configuration de l’hébergeur, puis rechargez cette page.';
  }
  if (valeur.length < LONGUEUR_MINIMALE) {
    return `Cet espace est fermé : ADMIN_PASSWORD fait ${valeur.length} caractères, il en faut ${LONGUEUR_MINIMALE} au minimum. Un mot de passe court sur une page d’administration vaut moins que pas de page du tout.`;
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    return 'Cet espace est fermé : la variable AUTH_SECRET est absente ou trop courte (seize caractères au minimum). C’est elle qui signe les sessions et qui chiffre la clé enregistrée.';
  }
  return '';
}

export function motDePasseJuste(fourni: string): boolean {
  const attendu = process.env.ADMIN_PASSWORD;
  if (!attendu || attendu.length < LONGUEUR_MINIMALE) return false;
  return memeSecret(fourni, attendu);
}

export function emettreSession(now = Date.now()): string {
  return emettreJeton(PORTEE, 'proprietaire', now);
}

export const optionsSession = optionsDuCookie;

/** Vrai si la session en cours est celle du propriétaire. Ne lève jamais. */
export async function estProprietaire(): Promise<boolean> {
  try {
    if (!reglagesConfigures()) return false;
    const jar = await cookies();
    return lireJeton(PORTEE, jar.get(COOKIE)?.value) === 'proprietaire';
  } catch {
    return false;
  }
}
