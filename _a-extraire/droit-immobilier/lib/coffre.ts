import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Le coffre : chiffrer une valeur avant de l'écrire en base.
 *
 * Il existe pour une seule chose — la clé d'API du modèle, saisie depuis
 * l'espace de réglages. Une clé d'API est un moyen de paiement : qui la lit
 * peut dépenser. Écrite en clair, elle serait lisible par toute personne ayant
 * accès à la base, par une sauvegarde oubliée sur un disque, par un export
 * CSV, ou par n'importe quelle faille qui laisse lire une table.
 *
 * ── Ce que ça protège, et ce que ça ne protège pas ──────────────────────────
 * Ça protège d'une fuite de la BASE SEULE : un vidage de table ne donne rien
 * d'exploitable sans `AUTH_SECRET`, qui vit dans les variables
 * d'environnement, pas en base.
 *
 * Ça ne protège PAS d'une compromission du serveur : qui exécute du code chez
 * vous lit `AUTH_SECRET` et déchiffre. Aucun chiffrement applicatif ne protège
 * de ça, et prétendre le contraire serait pire que ne rien chiffrer — on
 * cesserait de surveiller le reste. La vraie parade y est ailleurs : la clé
 * n'est jamais renvoyée au navigateur, jamais journalisée, jamais réaffichée
 * en entier, et elle se révoque en une minute chez Anthropic.
 *
 * ── Le format ──────────────────────────────────────────────────────────────
 * `sel.iv.étiquette.chiffré`, quatre parts en base64url. Le sel est tiré au
 * hasard à chaque écriture : deux clés identiques donnent deux scellés
 * différents, et personne ne peut deviner par comparaison que la clé n'a pas
 * changé. AES-256-GCM est authentifié : un scellé modifié d'un seul bit ne
 * déchiffre pas, il échoue.
 */

const ALGO = 'aes-256-gcm';

function secret(): string {
  const valeur = process.env.AUTH_SECRET;
  if (!valeur || valeur.length < 16) {
    throw new Error('AUTH_SECRET manquant ou trop court (16 caractères minimum).');
  }
  return valeur;
}

/** scrypt à chaque opération : c'est lent par construction, et c'est le but. */
function cle(sel: Buffer): Buffer {
  return scryptSync(secret(), sel, 32);
}

export function sceller(clair: string): string {
  const sel = randomBytes(16);
  const iv = randomBytes(12);
  const chiffreur = createCipheriv(ALGO, cle(sel), iv);
  const chiffre = Buffer.concat([chiffreur.update(clair, 'utf8'), chiffreur.final()]);
  return [sel, iv, chiffreur.getAuthTag(), chiffre].map((b) => b.toString('base64url')).join('.');
}

/**
 * Renvoie `null` plutôt que de lever, dans tous les cas d'échec : scellé
 * tronqué, `AUTH_SECRET` changé depuis l'écriture, étiquette invalide. Une clé
 * illisible doit se comporter comme une clé absente — le site le dit alors et
 * propose de la ressaisir, au lieu de rendre une erreur 500 sur chaque page.
 */
export function desceller(scelle: string): string | null {
  try {
    const parts = scelle.split('.');
    if (parts.length !== 4) return null;
    const [sel, iv, etiquette, chiffre] = parts.map((p) => Buffer.from(p, 'base64url'));
    if (sel.length !== 16 || iv.length !== 12 || etiquette.length !== 16) return null;
    const dechiffreur = createDecipheriv(ALGO, cle(sel), iv);
    dechiffreur.setAuthTag(etiquette);
    return Buffer.concat([dechiffreur.update(chiffre), dechiffreur.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Comparaison à temps constant de deux chaînes.
 *
 * `a === b` sur un mot de passe s'arrête au premier caractère qui diffère : le
 * temps de réponse renseigne alors sur le nombre de caractères justes. Le
 * hachage préalable égalise aussi les longueurs, que `timingSafeEqual` exige.
 */
export function memeSecret(fourni: string, attendu: string): boolean {
  const sel = Buffer.from('comparaison');
  const a = scryptSync(fourni, sel, 32);
  const b = scryptSync(attendu, sel, 32);
  return timingSafeEqual(a, b);
}
