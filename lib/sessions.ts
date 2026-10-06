import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

/**
 * La mécanique des sessions : scrypt pour les mots de passe, HMAC pour les
 * jetons. Rien du produit n'entre ici.
 *
 * ── Pourquoi un jeton porte une PORTÉE ──────────────────────────────────────
 * `AUTH_SECRET` est une variable d'environnement, et une variable
 * d'environnement se recopie. Le jour où le même secret sert à un second
 * service — un autre déploiement, un outil interne, une reprise de ce code —,
 * un cookie émis là-bas aurait exactement la forme d'un cookie d'ici, et
 * ouvrirait une session sur un compte du même identifiant.
 *
 * La portée entre dans la signature, ce qui rend cela impossible : un jeton
 * signé pour autre chose ne valide pas ici, même avec le bon secret. Ça ne
 * coûte rien et ça ferme une porte qu'on ne pense à regarder qu'après.
 *
 * ── Pourquoi ce fichier ne porte pas `server-only` ──────────────────────────
 * Il le portait, et la marque rendait `tests/sessions.test.ts` impossible à
 * écrire : le module refuse de se charger hors d'un rendu serveur. Or une
 * barrière qu'on ne peut pas tester n'est pas une barrière.
 *
 * Ce qu'on perd est faible : lib/comptes.ts, seul appelant de ces fonctions,
 * porte la marque, donc toute chaîne d'import partie d'un composant client
 * casse encore à la compilation. Et `AUTH_SECRET` n'est pas préfixé
 * `NEXT_PUBLIC_` : dans un paquet client, il vaudrait `undefined`, jamais le
 * secret.
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

/**
 * L'empreinte d'un mot de passe, telle qu'elle entre dans la portée du jeton.
 *
 * ELLE RÉPOND À UN DÉFAUT PRÉCIS. Le jeton ne portait que l'identifiant et une
 * expiration : changer de mot de passe ne faisait donc rien aux sessions déjà
 * ouvertes. Quelqu'un dont le compte venait d'être pris faisait exactement le
 * bon geste — il changeait son mot de passe — et celui qui était entré gardait
 * son accès trente jours, sur un service où l'on dépose des baux et où l'on
 * raconte des litiges.
 *
 * Mettre l'empreinte du mot de passe dans la portée suffit : la signature
 * cesse de valider dès que l'empreinte stockée change, donc dès qu'un mot de
 * passe est modifié ou réinitialisé. Aucune table de sessions à tenir, aucune
 * liste de révocation — ce qui invalide est le changement lui-même.
 *
 * C'est une empreinte du HACHAGE, jamais du mot de passe : ce qui est déjà en
 * base passe par un HMAC et ressort en douze caractères. Même si un jeton
 * fuyait, il ne dirait rien de plus que ce que la base contient déjà.
 */
export function empreinteDuMotDePasse(passwordHash: string): string {
  return createHmac('sha256', secret()).update(`empreinte.${passwordHash}`).digest('base64url').slice(0, 12);
}

/**
 * L'identifiant porté par un jeton, SANS vérifier la signature.
 *
 * Il faut bien lire l'identifiant avant de pouvoir vérifier quoi que ce soit :
 * la portée dépend du mot de passe, le mot de passe est en base, et on ne peut
 * pas lire la base sans savoir quelle ligne lire. L'ordre est donc : extraire
 * l'identifiant, charger le compte, PUIS vérifier la signature avec la portée
 * complète.
 *
 * Ce qui sort d'ici n'ouvre rien. C'est une chaîne non vérifiée, bonne à
 * désigner une ligne, et tout ce qui suit dépend de la vérification qui vient
 * après. L'appelant qui s'en servirait autrement commettrait une faute : le
 * nom le dit.
 */
export function identifiantNonVerifie(jeton: string | undefined): string | null {
  if (!jeton) return null;
  const parts = jeton.split('.');
  return parts.length === 3 && parts[0] ? parts[0] : null;
}

export const optionsDuCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: JOURS * 24 * 60 * 60,
};
