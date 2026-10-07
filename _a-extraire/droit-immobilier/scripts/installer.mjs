/**
 * L'installateur : poser, une fois, tout ce que le site réclame.
 *
 * `npm run avant-lancement` dit ce qui manque. Celui-ci le demande, le
 * vérifie, et l'écrit — parce qu'entre lire une liste de douze variables dans
 * un fichier d'exemple et les poser correctement, il y a une demi-heure de
 * flottement et deux occasions de se tromper sur un SIREN.
 *
 *   npm run installer
 *
 * TROIS RÈGLES QU'IL S'IMPOSE.
 *
 * Il ne remplace jamais une valeur déjà posée sans le demander : relancer
 * l'installateur après coup ne doit pas effacer une clé de production.
 *
 * Il ne réaffiche jamais un secret en entier. Une clé d'API qui défile dans un
 * terminal finit dans un historique, puis dans une capture d'écran.
 *
 * Il n'invente rien. Un SIREN, un médiateur, une adresse d'hébergeur : ce sont
 * des faits, et le site entier est construit sur la règle qu'on les réclame
 * plutôt que de les deviner.
 */

import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FICHIER = path.join(process.cwd(), '.env.local');
const rl = createInterface({ input: process.stdin, output: process.stdout });

/**
 * Une question, qui rend la main même si l'entrée se ferme.
 *
 * `rl.question` ne se résout jamais quand stdin se termine : le script reste
 * alors suspendu sur une promesse que rien n'achèvera, et Node le signale par
 * un avertissement incompréhensible au lieu de rendre la main. On écoute donc
 * la fermeture — et ON RETIRE CET ÉCOUTEUR dès que la réponse arrive, sans
 * quoi il s'en accumule un par question et Node finit par avertir d'une fuite.
 */
let entreeFermee = false;
rl.once('close', () => { entreeFermee = true; });

async function demander(invite) {
  if (entreeFermee) return '';
  return new Promise((resoudre) => {
    let fini = false;
    const achever = (valeur) => {
      if (fini) return;
      fini = true;
      rl.off('close', surFermeture);
      resoudre(valeur);
    };
    const surFermeture = () => achever('');
    rl.once('close', surFermeture);
    rl.question(invite).then(achever, surFermeture);
  });
}

/* ------------------------------------------------------- ce qui existe --- */

const existant = {};
if (existsSync(FICHIER)) {
  for (const ligne of readFileSync(FICHIER, 'utf8').split('\n')) {
    const rang = ligne.indexOf('=');
    if (rang > 0 && /^[A-Z_]+$/.test(ligne.slice(0, rang).trim())) {
      existant[ligne.slice(0, rang).trim()] = ligne.slice(rang + 1).trim();
    }
  }
}

/* --------------------------------------------------------- les champs --- */

const siren = (v) => (/^\d{9}$/.test(v.replace(/\s/g, '')) ? '' : 'Un SIREN fait neuf chiffres.');
const courriel = (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'Cette adresse n’a pas la forme d’une adresse.');
const adresseWeb = (v) =>
  !/^https?:\/\/.+/.test(v) ? 'Commencez par https://'
  : v.includes('localhost') ? 'C’est l’adresse publique du site qu’il faut, pas localhost.'
  : v.endsWith('/') ? 'Sans barre oblique finale.'
  : '';
const longueur = (n) => (v) => (v.length >= n ? '' : `Au moins ${n} caractères.`);

const SECTIONS = [
  {
    titre: 'Le socle technique',
    pourquoi: 'Sans ces trois-là, personne ne peut ouvrir de compte ni poser de question.',
    champs: [
      { nom: 'AUTH_SECRET', libelle: 'Secret de signature des sessions', secret: true,
        engendre: () => randomBytes(32).toString('hex'),
        aide: 'Peut être engendré ici. Le changer déconnecte tout le monde.' },
      { nom: 'NEXT_PUBLIC_SITE_URL', libelle: 'Adresse publique du site', valide: adresseWeb,
        aide: 'Celle que vos visiteurs taperont. Elle sert aux liens envoyés par courriel.' },
      { nom: 'ANTHROPIC_API_KEY', libelle: 'Clé du modèle', secret: true,
        aide: 'Peut aussi se poser depuis /reglages plus tard, sans redéployer.' },
    ],
  },
  {
    titre: 'La base de données',
    pourquoi: 'Sans elle, les comptes seraient perdus au premier redéploiement — le site refuse d’ailleurs d’en créer.',
    champs: [
      { nom: 'SUPABASE_URL', libelle: 'Adresse du projet Supabase', valide: (v) => (v.startsWith('https://') ? '' : 'Commencez par https://') },
      { nom: 'SUPABASE_SERVICE_ROLE_KEY', libelle: 'Clé de service Supabase', secret: true,
        aide: 'La clé « service_role », pas la clé publique. Elle ne doit jamais atteindre un navigateur.' },
    ],
    apres: 'N’oubliez pas de rejouer supabase/schema.sql dans l’éditeur SQL de Supabase.',
  },
  {
    titre: 'Le courriel',
    pourquoi: 'Sans lui, un mot de passe perdu ne se reprend plus et les adresses ne se confirment pas.',
    champs: [
      { nom: 'RESEND_API_KEY', libelle: 'Clé Resend', secret: true },
      { nom: 'COURRIEL_EXPEDITEUR', libelle: 'Adresse d’expédition', valide: courriel, facultatif: true,
        aide: 'Sur votre domaine, vérifié chez Resend. Une adresse « @resend.dev » part en indésirables.' },
    ],
  },
  {
    titre: 'L’éditeur du site',
    pourquoi: 'Mentions obligatoires (LCEN, article 6-III). Rien n’est deviné : le site les réclame.',
    champs: [
      { nom: 'EDITEUR_NOM', libelle: 'Dénomination ou nom et prénom' },
      { nom: 'EDITEUR_STATUT', libelle: 'Forme juridique', aide: 'Entreprise individuelle, SASU, SARL…' },
      { nom: 'EDITEUR_ADRESSE', libelle: 'Adresse du siège' },
      { nom: 'EDITEUR_SIREN', libelle: 'SIREN', valide: siren },
      { nom: 'EDITEUR_DIRECTEUR', libelle: 'Directeur de la publication', aide: 'La personne physique qui répond du contenu.' },
      { nom: 'EDITEUR_COURRIEL', libelle: 'Adresse de contact', valide: courriel, aide: 'Réellement relevée : les demandes RGPD y arrivent.' },
      { nom: 'EDITEUR_TVA_REGIME', libelle: 'Phrase de TVA affichée près des prix',
        aide: 'En franchise : « TVA non applicable, article 293 B du CGI ». Sinon : « Prix TTC, TVA au taux de 20 % ».' },
      { nom: 'EDITEUR_TELEPHONE', libelle: 'Téléphone', facultatif: true },
      { nom: 'EDITEUR_RCS', libelle: 'RCS (ville d’immatriculation)', facultatif: true },
      { nom: 'EDITEUR_CAPITAL', libelle: 'Capital social', facultatif: true },
      { nom: 'EDITEUR_TVA', libelle: 'Numéro de TVA intracommunautaire', facultatif: true },
    ],
  },
  {
    titre: 'L’hébergeur',
    pourquoi: 'La loi impose de le nommer, avec son adresse et son téléphone — ceux qu’il publie, pas les vôtres.',
    champs: [
      { nom: 'HEBERGEUR_NOM', libelle: 'Nom', aide: 'Vercel, OVH, Scaleway…' },
      { nom: 'HEBERGEUR_ADRESSE', libelle: 'Adresse' },
      { nom: 'HEBERGEUR_TELEPHONE', libelle: 'Téléphone' },
    ],
  },
  {
    titre: 'Le médiateur de la consommation',
    pourquoi:
      'Obligatoire dès la première vente à un particulier (article L612-1). L’adhésion prend quelques jours ouvrés : si vous ne l’avez pas encore, passez, mais lancez-la aujourd’hui.',
    champs: [
      { nom: 'MEDIATEUR_NOM', libelle: 'Nom du médiateur' },
      { nom: 'MEDIATEUR_ADRESSE', libelle: 'Adresse postale' },
      { nom: 'MEDIATEUR_SITE', libelle: 'Adresse de son formulaire de saisine', valide: adresseWeb },
    ],
  },
  {
    titre: 'L’encaissement',
    pourquoi:
      'Les quatre ensemble, ou aucune. Sans elles, les formules payantes s’activent gratuitement et chaque écran l’écrit.',
    champs: [
      { nom: 'STRIPE_SECRET_KEY', libelle: 'Clé secrète Stripe', secret: true },
      { nom: 'STRIPE_WEBHOOK_SECRET', libelle: 'Secret de vérification du point de réception', secret: true,
        aide: 'Point de réception : <votre-site>/api/paiement/retour, abonné à customer.subscription.created / .updated / .deleted' },
      { nom: 'STRIPE_PRIX_PRO', libelle: 'Identifiant du tarif « Pro »', aide: 'Commence par price_' },
      { nom: 'STRIPE_PRIX_CABINET', libelle: 'Identifiant du tarif « Cabinet »', aide: 'Commence par price_' },
    ],
  },
  {
    titre: 'L’espace de réglages',
    pourquoi: 'La porte de service : c’est là qu’on pose la clé du modèle sans redéployer.',
    champs: [
      { nom: 'ADMIN_PASSWORD', libelle: 'Mot de passe de /reglages', secret: true, valide: longueur(12) },
    ],
  },
];

/* ------------------------------------------------------------ l'entretien --- */

const masquer = (v) => (v.length <= 8 ? '•'.repeat(v.length) : `${v.slice(0, 4)}${'•'.repeat(8)}${v.slice(-2)}`);

console.log('\nInstallation d’Immolex\n');
console.log('Entrée vide : on passe. « ! » : on arrête et on garde ce qui a été posé.');
console.log('Rien n’est envoyé nulle part : tout est écrit dans .env.local.\n');

const valeurs = { ...existant };
let arrete = false;

for (const section of SECTIONS) {
  if (arrete) break;
  console.log(`\n── ${section.titre} ${'─'.repeat(Math.max(0, 58 - section.titre.length))}`);
  console.log(`   ${section.pourquoi}\n`);

  for (const champ of section.champs) {
    if (arrete) break;
    let deja = valeurs[champ.nom];
    if (deja) {
      const garde = await demander(
        `   ${champ.libelle}\n   déjà posé (${champ.secret ? masquer(deja) : deja}) — remplacer ? [n] `,
      );
      if (!/^o|^y/i.test(garde.trim())) { console.log(''); continue; }
      /* Il a dit oui : à partir d'ici, la valeur en place ne compte plus. Sans
         cette ligne, choisir de remplacer AUTH_SECRET sautait la proposition
         de l'engendrer et obligeait à en inventer un à la main — exactement
         ce que l'installateur est censé éviter. */
      deja = '';
    }

    if (champ.aide) console.log(`   ${champ.aide}`);
    if (champ.engendre && !deja) {
      const veut = await demander(`   ${champ.libelle} — l’engendrer ici ? [O] `);
      if (!/^n/i.test(veut.trim())) {
        valeurs[champ.nom] = champ.engendre();
        console.log(`   · engendré (${masquer(valeurs[champ.nom])})\n`);
        continue;
      }
    }

    for (;;) {
      const saisie = (await demander(`   ${champ.libelle}${champ.facultatif ? ' (facultatif)' : ''} : `)).trim();
      if (saisie === '!') { arrete = true; break; }
      if (!saisie) { console.log(''); break; }
      const souci = champ.valide ? champ.valide(saisie) : '';
      if (souci) { console.log(`   ✗ ${souci}`); continue; }
      valeurs[champ.nom] = saisie;
      console.log('');
      break;
    }
  }
  if (section.apres && !arrete) console.log(`   → ${section.apres}`);
}

rl.close();

/* --------------------------------------------------------------- l'écriture --- */

const lignes = [
  '# Écrit par « npm run installer ». Ce fichier contient des secrets :',
  '# il est ignoré par git, et il ne doit jamais être partagé ni copié dans un ticket.',
  '',
  ...SECTIONS.flatMap((section) => {
    const posees = section.champs.filter((c) => valeurs[c.nom]);
    if (posees.length === 0) return [];
    return [`# ${section.titre}`, ...posees.map((c) => `${c.nom}=${valeurs[c.nom]}`), ''];
  }),
];

writeFileSync(FICHIER, lignes.join('\n'));
console.log(`\n${Object.keys(valeurs).length} valeurs écrites dans .env.local\n`);
console.log('Pour la mise en ligne, reportez ces mêmes variables chez votre hébergeur.');
console.log('Puis : npm run avant-lancement — il dira ce qui manque encore.\n');
