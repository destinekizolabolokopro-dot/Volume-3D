import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

/**
 * La mécanique des sessions, sans le produit.
 *
 * Volume3D et l'assistant juridique sont deux services distincts : deux
 * marques, deux clientèles, deux facturations, deux tables de comptes, et deux
 * cookies qui ne s'ouvrent pas l'un l'autre. Ce fichier est la seule chose
 * qu'ils partagent, et c'est délibéré — ce n'est pas du produit, c'est de
 * l'arithmétique.
 *
 * Dupliquer scrypt et le HMAC dans chaque service serait la mauvaise sorte de
 * séparation : deux copies d'un code de sécurité, dont une seule serait
 * corrigée le jour où il faudra la corriger. Ce qui doit rester séparé, c'est
 * ce qui identifie un client — pas la façon de vérifier un mot de passe.
 *
 * Ce fichier ne porte PAS `server-only`, et c'est un choix. Il le portait, et
 * la marque rendait `tests/sessions.test.ts` impossible à écrire : le module
 * refuse de se charger hors d'un rendu serveur. Or l'invariant que ce test
 * vérifie — un jeton d'un service n'ouvre pas de session dans l'autre — est la
 * seule chose qui sépare vraiment les deux clientèles, et une barrière qu'on
 * ne peut pas tester n'est pas une barrière.
 *
 * Ce qu'on perd est faible : les deux seuls modules qui appellent ces
 * fonctions, lib/accounts.ts et lib/juridique/comptes.ts, portent la marque,
 * donc toute chaîne d'import partie d'un composant client casse encore à la
 * compilation. Et AUTH_SECRET n'est pas préfixé NEXT_PUBLIC_ : dans un paquet
 * client, il vaudrait `undefined`, jamais le secret.
 */

const JOURS = 30;

/**
 * Les sessions sont-elles seulement possibles ?
 *
 * `secret()` lève, et c'est ce qu'on veut au moment de signer un jeton. Mais
 * une page qui veut savoir si elle peut proposer un formulaire de connexion
 * n'a pas à attraper une exception pour l'apprendre — d'où cette lecture qui
 * ne lève jamais.
 */
export function sessionsConfigurees(): boolean {
  const valeur = process.env.AUTH_SECRET;
  return Boolean(valeur && valeur.length >= 16);
}

function secret(): string {
  const valeur = process.env.AUTH_SECRET;
  if (!valeur || valeur.length < 16) {
    throw new Error('AUTH_SECRET manquant ou trop court (16 caractères minimum).');
  }
  return valeur;
}

export async function hashPassword(password: string): Promise<string> {
  const sel = randomBytes(16).toString('hex');
  const derive = (await scrypt(password, sel, 64)) as Buffer;
  return `${sel}:${derive.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [sel, attendu] = stored.split(':');
  if (!sel || !attendu) return false;
  const derive = (await scrypt(password, sel, 64)) as Buffer;
  const attenduBuffer = Buffer.from(attendu, 'hex');
  if (attenduBuffer.length !== derive.length) return false;
  return timingSafeEqual(attenduBuffer, derive);
}

/**
 * Jeton « identifiant.expiration.signature ». Aucune donnée sensible dedans.
 *
 * `portee` entre dans la signature. C'est ce qui empêche un jeton émis par un
 * service d'ouvrir une session dans l'autre : les deux cookies sont signés par
 * le même secret, mais un jeton « v3d » présenté au juridique ne valide pas.
 * Sans cette portée, deux services partageant AUTH_SECRET partageraient de
 * fait leurs sessions, et la séparation ne serait qu'une apparence.
 */
export function emettreJeton(portee: string, id: string, now = Date.now()): string {
  const corps = `${id}.${now + JOURS * 24 * 60 * 60 * 1000}`;
  const signature = createHmac('sha256', secret()).update(`${portee}.${corps}`).digest('base64url');
  return `${corps}.${signature}`;
}

export function lireJeton(portee: string, jeton: string | undefined, now = Date.now()): string | null {
  if (!jeton) return null;
  const parts = jeton.split('.');
  if (parts.length !== 3) return null;
  const [id, expiration, signature] = parts;
  const attendu = createHmac('sha256', secret()).update(`${portee}.${id}.${expiration}`).digest('base64url');
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Number(expiration) > now ? id : null;
}

export const optionsDuCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: JOURS * 24 * 60 * 60,
};
