/**
 * Ce qui manque encore pour ouvrir au public.
 *
 * Le site est écrit pour fonctionner à moitié configuré, et pour le DIRE :
 * sans clé de courriel, la page d'oubli de mot de passe affiche qu'elle ne
 * peut rien envoyer ; sans prestataire de paiement, les formules payantes
 * s'activent gratuitement et l'écran l'annonce ; sans mentions d'éditeur, la
 * page légale liste ce qui manque au lieu de l'inventer.
 *
 * C'est la bonne façon de se comporter, et c'est aussi la raison d'être de ce
 * script : un site qui ne casse nulle part ne signale pas non plus qu'il n'est
 * pas prêt. Celui-ci rassemble tous ces états en une page, et classe chacun
 * par ce qu'il empêche vraiment.
 *
 *   npm run avant-lancement
 *
 * Il ne modifie rien, n'appelle aucun service, et sort en échec s'il reste un
 * point bloquant — de quoi le brancher sur ce qui refuse de déployer.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

/* Les variables sont lues depuis l'environnement ET depuis .env.local, parce
   que c'est là qu'elles vivent pendant qu'on prépare un lancement, et qu'un
   script qui répondrait « tout manque » sur un poste correctement réglé ne
   serait jamais relu. */
const fichier = path.join(process.cwd(), '.env.local');
let local = {};
try {
  local = Object.fromEntries(
    readFileSync(fichier, 'utf8')
      .split('\n')
      .filter((ligne) => /^\s*[A-Z_]+\s*=/.test(ligne))
      .map((ligne) => {
        const rang = ligne.indexOf('=');
        return [ligne.slice(0, rang).trim(), ligne.slice(rang + 1).trim()];
      }),
  );
} catch {
  /* Pas de .env.local : c'est le cas normal en production, où tout vient de
     l'environnement. */
}

const lire = (nom) => (process.env[nom] ?? local[nom] ?? '').trim();
const pose = (nom) => lire(nom).length > 0;

const BLOQUANT = 'bloquant';
const SERIEUX = 'sérieux';
const CONFORT = 'confort';

const points = [
  {
    quoi: 'Les comptes (AUTH_SECRET)',
    niveau: BLOQUANT,
    ok: lire('AUTH_SECRET').length >= 16,
    manque: 'Personne ne peut ouvrir de compte ni se connecter. Le site reste consultable, c’est tout.',
    comment: 'Une valeur aléatoire d’au moins 16 caractères, gardée secrète. Changer cette valeur déconnecte tout le monde.',
  },
  {
    quoi: 'La base de données (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
    niveau: BLOQUANT,
    ok: pose('SUPABASE_URL') && pose('SUPABASE_SERVICE_ROLE_KEY'),
    manque:
      'Les comptes seraient écrits dans un fichier local et perdus au premier redéploiement. Le site refuse d’ailleurs d’en créer en production — voir app/entrer/actions.ts.',
    comment: 'Et rejouer supabase/schema.sql, qui ajoute aussi les colonnes d’abonnement.',
  },
  {
    quoi: 'Le modèle (ANTHROPIC_API_KEY)',
    niveau: BLOQUANT,
    ok: pose('ANTHROPIC_API_KEY'),
    manque: 'Aucune question ne reçoit de réponse : la consultation renvoie 503.',
    comment: 'Peut aussi être posée depuis /reglages, chiffrée en base, sans redéployer.',
  },
  {
    quoi: 'Le courriel (RESEND_API_KEY)',
    niveau: BLOQUANT,
    ok: pose('RESEND_API_KEY'),
    manque:
      'Un mot de passe perdu ne se reprend plus : la page d’oubli n’affiche même pas de formulaire. Et les adresses ne se confirment pas.',
    comment: 'Vérifier aussi le domaine d’envoi : une adresse « onboarding@resend.dev » part en indésirables.',
  },
  {
    quoi: 'L’adresse publique (NEXT_PUBLIC_SITE_URL)',
    niveau: BLOQUANT,
    ok: /^https?:\/\/.+/.test(lire('NEXT_PUBLIC_SITE_URL')) && !lire('NEXT_PUBLIC_SITE_URL').includes('localhost'),
    manque:
      'Les liens de confirmation et de réinitialisation pointeraient vers localhost, donc vers nulle part pour celui qui les reçoit.',
    comment: 'L’adresse exacte du site en ligne, sans barre oblique finale.',
  },
  {
    quoi: 'L’identité de l’éditeur (EDITEUR_*)',
    niveau: BLOQUANT,
    ok: ['EDITEUR_NOM', 'EDITEUR_STATUT', 'EDITEUR_ADRESSE', 'EDITEUR_SIREN', 'EDITEUR_DIRECTEUR', 'EDITEUR_COURRIEL'].every(pose),
    manque:
      'Les mentions légales affichent la liste de ce qui manque. Publier un service payant sans elles est une infraction (LCEN, article 6-III).',
    comment: 'Rien n’est deviné ici : le site réclame ces valeurs plutôt que de les inventer.',
  },
  {
    quoi: 'L’hébergeur (HEBERGEUR_*)',
    niveau: BLOQUANT,
    ok: ['HEBERGEUR_NOM', 'HEBERGEUR_ADRESSE', 'HEBERGEUR_TELEPHONE'].every(pose),
    manque: 'Mention obligatoire : la loi impose de nommer qui héberge, avec son adresse et son téléphone.',
    comment: 'Ceux que l’hébergeur publie lui-même, pas les vôtres.',
  },
  {
    quoi: 'Le médiateur de la consommation (MEDIATEUR_*)',
    niveau: BLOQUANT,
    ok: ['MEDIATEUR_NOM', 'MEDIATEUR_ADRESSE', 'MEDIATEUR_SITE'].every(pose),
    manque:
      'Obligatoire dès la première vente à un particulier (code de la consommation, article L612-1). Y adhérer prend quelques jours : à lancer avant le reste.',
    comment: 'L’adhésion se fait auprès d’un médiateur référencé par la CECMC.',
  },
  {
    quoi: 'Le régime de TVA (EDITEUR_TVA_REGIME)',
    niveau: BLOQUANT,
    ok: pose('EDITEUR_TVA_REGIME'),
    manque: 'La phrase de TVA n’apparaît pas sous les prix, et un prix annoncé doit dire ce qu’il comprend.',
    comment: 'En franchise : « TVA non applicable, article 293 B du CGI ». Sinon : « Prix TTC, TVA au taux de 20 % ».',
  },
  {
    quoi: 'L’encaissement (STRIPE_*)',
    niveau: SERIEUX,
    ok: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRIX_PRO', 'STRIPE_PRIX_CABINET'].every(pose),
    manque:
      'Les formules payantes s’activent gratuitement, et chaque écran l’écrit noir sur blanc. Le site fonctionne, il ne gagne rien.',
    comment:
      'Les quatre ensemble ou aucune. Le point de réception est /api/paiement/retour, abonné à customer.subscription.created / .updated / .deleted.',
  },
  {
    quoi: 'L’accès à l’espace de réglages (ADMIN_PASSWORD)',
    niveau: SERIEUX,
    ok: lire('ADMIN_PASSWORD').length >= 12,
    manque: '/reglages reste fermé — c’est là qu’on pose la clé du modèle sans redéployer.',
    comment: 'Douze caractères au moins. Ce n’est pas un compte client, c’est la porte de service.',
  },
  {
    quoi: 'Le téléphone de l’éditeur (EDITEUR_TELEPHONE)',
    niveau: CONFORT,
    ok: pose('EDITEUR_TELEPHONE'),
    manque: 'Facultatif si l’adresse électronique est réellement relevée.',
    comment: '',
  },
];

const RANGS = { [BLOQUANT]: 0, [SERIEUX]: 1, [CONFORT]: 2 };
const manquants = points.filter((p) => !p.ok).sort((a, b) => RANGS[a.niveau] - RANGS[b.niveau]);
const bloquants = manquants.filter((p) => p.niveau === BLOQUANT);

console.log('\nAvant lancement\n');
console.log(`  ${points.length - manquants.length} points sur ${points.length} sont en place.\n`);

for (const point of points.filter((p) => p.ok)) console.log(`  ·  ${point.quoi}`);

for (const niveau of [BLOQUANT, SERIEUX, CONFORT]) {
  const lot = manquants.filter((p) => p.niveau === niveau);
  if (lot.length === 0) continue;
  console.log(`\n  ${niveau.toUpperCase()}\n`);
  for (const point of lot) {
    console.log(`  ✗  ${point.quoi}`);
    console.log(`     ${point.manque}`);
    if (point.comment) console.log(`     → ${point.comment}`);
    console.log('');
  }
}

if (bloquants.length === 0) {
  console.log('\n  Rien de bloquant. Relisez les points « sérieux » avant d’ouvrir au public.\n');
} else {
  console.log(`  ${bloquants.length} point(s) bloquant(s) : le site ne peut pas encore ouvrir au public.\n`);
}

/* Ce que ce script NE VÉRIFIE PAS, et qui reste à faire à la main :
   que la clé du modèle réponde vraiment (npm run evaluer), que le courriel
   arrive dans une boîte et non en indésirables, et qu'un paiement d'essai
   remonte bien par le point de réception. Aucune variable d'environnement ne
   dit cela. */
process.exit(bloquants.length > 0 ? 1 : 0);
