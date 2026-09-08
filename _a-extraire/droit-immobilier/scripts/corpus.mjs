/**
 * Le corpus : `npm run corpus`.
 *
 * Il télécharge le fonds LEGI de la DILA — celui qui alimente Légifrance,
 * publié en licence ouverte —, y prend les textes déclarés dans
 * `lib/corpus-choix.ts`, et écrit `corpus/<domaine>.json`. Le site ne fait
 * jamais cet appel : il lit les fichiers produits ici. C'est voulu — une
 * réponse juridique ne doit pas dépendre de la disponibilité d'un serveur
 * tiers au moment où quelqu'un pose sa question.
 *
 * ── Ce que le fonds contient et comment il est fait ─────────────────────────
 * Une archive « globale » de 1,1 Go, figée au 13 juillet 2025, puis une
 * archive par jour qui ne porte que les articles modifiés ce jour-là et la
 * liste des dossiers supprimés. L'état courant s'obtient en posant le global,
 * puis en déroulant les quotidiennes dans l'ordre. C'est ce que fait ce
 * script : sans les quotidiennes, le corpus aurait plus d'un an de retard, et
 * un texte périmé présenté comme en vigueur est pire que pas de texte.
 *
 * ── Ce qu'il ne fait pas ────────────────────────────────────────────────────
 * Il ne juge rien. Il ne résume pas, ne reformule pas, ne choisit pas les
 * articles « importants ». Il copie le texte officiel tel quel, avec son
 * numéro, sa place dans le plan, et sa date d'entrée en vigueur. Tout le
 * jugement est dans `lib/corpus-choix.ts`, qui est relisible ; ici il n'y a
 * que de la mécanique.
 *
 *   npm run corpus              construit à partir de ce qui est déjà là
 *   npm run corpus -- --fonds   télécharge d'abord ce qui manque
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHOIX, PLAFOND_CARACTERES } from '../lib/corpus-choix.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RACINE, '.legi');
const FONDS = join(CACHE, 'fonds');
const SORTIE = join(RACINE, 'corpus');
const MIROIR = 'https://echanges.dila.gouv.fr/OPENDATA/LEGI/';

/* Le sous-arbre qui nous intéresse : ce qui est en vigueur, codes et textes
   non codifiés. Le reste de l'archive — l'abrogé, l'historique — pèse la
   moitié du fonds et n'a rien à faire dans une réponse. */
const EN_VIGUEUR = 'code_et_TNC_en_vigueur';

/* ============================================================ le fonds brut === */

function fichiersLocaux() {
  if (!existsSync(CACHE)) return { global: null, deltas: [] };
  const tout = readdirSync(CACHE).filter((nom) => nom.endsWith('.tar.gz'));
  const global = tout.find((nom) => nom.startsWith('Freemium_legi_global_')) ?? null;
  const deltas = tout.filter((nom) => nom.startsWith('LEGI_')).sort();
  return { global, deltas };
}

async function telecharger(nom) {
  const cible = join(CACHE, nom);
  if (existsSync(cible) && statSync(cible).size > 0) return;
  process.stdout.write(`  ↓ ${nom}\n`);
  const reponse = await fetch(MIROIR + nom);
  if (!reponse.ok) throw new Error(`${nom} : ${reponse.status}`);
  const flux = createWriteStream(cible);
  await new Promise((resoudre, rejeter) => {
    reponse.body.pipeTo(new WritableStream({
      write: (morceau) => new Promise((suite) => { flux.write(morceau, suite); }),
      close: () => flux.end(resoudre),
      abort: rejeter,
    })).catch(rejeter);
  });
}

async function completerLeFonds() {
  mkdirSync(CACHE, { recursive: true });
  const page = await fetch(MIROIR).then((r) => r.text());
  const global = [...page.matchAll(/Freemium_legi_global_[0-9]{8}-[0-9]{6}\.tar\.gz/g)].map((m) => m[0]).sort().pop();
  if (!global) throw new Error('aucune archive globale sur le miroir DILA');
  await telecharger(global);

  const horodatage = global.slice('Freemium_legi_global_'.length, -'.tar.gz'.length);
  const deltas = [...new Set([...page.matchAll(/LEGI_[0-9]{8}-[0-9]{6}\.tar\.gz/g)].map((m) => m[0]))]
    .filter((nom) => nom.slice('LEGI_'.length, -'.tar.gz'.length) > horodatage)
    .sort();
  for (const delta of deltas) await telecharger(delta);
}

/* ========================================================== l'extraction === */

/** Sort d'une archive les seuls chemins demandés. Un motif sans correspondance
    n'est pas une erreur : une quotidienne ne touche presque jamais nos textes. */
function extraire(archive, motifs, options = {}) {
  const arguments_ = ['-xzf', join(CACHE, archive), '-C', FONDS, '--wildcards'];
  if (options.strip) arguments_.push(`--strip-components=${options.strip}`);
  arguments_.push(...motifs);
  try {
    execFileSync('tar', arguments_, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (erreur) {
    const message = String(erreur.stderr ?? '');
    if (!message.includes('Not found in archive')) throw erreur;
  }
}

/** Le motif `tar` d’un identifiant de texte, quelle que soit sa profondeur
    dans l’arborescence — le fonds range les textes par tranches de chiffres. */
function motifDuTexte(cid, sousDossier) {
  return `*/${cid}/${sousDossier}`;
}

/* ============================================================== la lecture === */

function balise(xml, nom) {
  const trouve = new RegExp(`<${nom}[^>]*>([\\s\\S]*?)</${nom}>`).exec(xml);
  return trouve ? trouve[1].trim() : '';
}

const ENTITES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': '’', '&#39;': '’', '&nbsp;': ' ' };

function enTexte(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entite) => ENTITES[entite.toLowerCase()] ?? entite)
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t ]+/g, ' ').trim())
    .filter((ligne, index, lignes) => ligne !== '' || lignes[index - 1] !== '')
    .join('\n')
    .trim();
}

/**
 * Les intitulés — titre d'un texte, titre d'une subdivision — sont ramenés à
 * une seule forme avant d'être comparés ou affichés. Le fonds écrit
 * l'apostrophe droite ; le site, et donc `lib/corpus-choix.ts`, écrit
 * l'apostrophe typographique. Sans ce passage, « Code de la construction et de
 * l'habitation » ne reconnaîtrait pas « Code de la construction et de
 * l’habitation », et la sélection ne trouverait rien.
 *
 * Le TEXTE des articles, lui, n'est jamais touché : on le copie tel qu'il est
 * publié.
 */
function normaliserIntitule(valeur) {
  return valeur.replace(/'/g, '\u2019').replace(/\s+/g, ' ').trim();
}

/** Le chemin dans le plan du texte, limité aux subdivisions encore ouvertes. */
function cheminDesTitres(xml, aujourdhui) {
  const chemin = [];
  for (const trouve of xml.matchAll(/<TITRE_TM[^>]*debut="([^"]*)"[^>]*fin="([^"]*)"[^>]*>([\s\S]*?)<\/TITRE_TM>/g)) {
    const [, debut, fin, titre] = trouve;
    if (debut > aujourdhui || fin < aujourdhui) continue;
    const propre = normaliserIntitule(enTexte(titre));
    if (propre && !chemin.includes(propre)) chemin.push(propre);
  }
  return chemin;
}

function lireArticle(xml, aujourdhui) {
  if (balise(xml, 'ETAT') !== 'VIGUEUR') return null;
  const debut = balise(xml, 'DATE_DEBUT');
  if (debut && debut > aujourdhui) return null;

  const contenu = enTexte(balise(balise(xml, 'BLOC_TEXTUEL'), 'CONTENU'));
  if (!contenu) return null;

  return {
    num: balise(xml, 'NUM'),
    chemin: cheminDesTitres(balise(xml, 'CONTEXTE'), aujourdhui),
    debut,
    texte: contenu,
  };
}

/** Le titre officiel d'un texte, pris dans son fichier de version. */
function titreDuTexte(dossier) {
  const version = join(dossier, 'texte', 'version');
  if (!existsSync(version)) return '';
  for (const nom of readdirSync(version)) {
    const xml = readFileSync(join(version, nom), 'utf8');
    const titre = normaliserIntitule(enTexte(balise(xml, 'TITREFULL') || balise(xml, 'TITRE_TXT') || balise(xml, 'TITRE')));
    if (titre) return titre;
  }
  return '';
}

function parcourir(racine, visite) {
  if (!existsSync(racine)) return;
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) parcourir(chemin, visite);
    else visite(chemin);
  }
}

/** Les dossiers de texte présents dans le fonds extrait, par identifiant. */
function dossiersDeTexte() {
  const trouves = new Map();
  const base = join(FONDS, 'legi', 'global', EN_VIGUEUR);
  const descendre = (racine) => {
    if (!existsSync(racine)) return;
    for (const entree of readdirSync(racine, { withFileTypes: true })) {
      if (!entree.isDirectory()) continue;
      if (/^(JORF|LEGI)TEXT\d+$/.test(entree.name)) trouves.set(entree.name, join(racine, entree.name));
      else descendre(join(racine, entree.name));
    }
  };
  descendre(base);
  return trouves;
}

/* ============================================================ la construction === */

/** Ordre naturel : « 15 » avant « 100 », « L. 324-1-1 » après « L. 324-1 ». */
function comparerNumeros(a, b) {
  const morceaux = (valeur) => valeur.split(/([0-9]+)/).map((part) => (/^[0-9]+$/.test(part) ? Number(part) : part));
  const ga = morceaux(a);
  const gb = morceaux(b);
  for (let i = 0; i < Math.max(ga.length, gb.length); i += 1) {
    const x = ga[i];
    const y = gb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y), 'fr');
  }
  return 0;
}

function construireDocument(selection, dossier, aujourdhui) {
  const articles = [];
  parcourir(join(dossier, 'article'), (fichier) => {
    if (!fichier.endsWith('.xml')) return;
    const article = lireArticle(readFileSync(fichier, 'utf8'), aujourdhui);
    if (!article || !article.num) return;
    if (selection.parties && !selection.parties.some((partie) => article.chemin.some((titre) => partie.test(titre)))) return;
    articles.push(article);
  });

  /* Un même numéro peut sortir deux fois quand deux versions se chevauchent au
     jour près. On garde la plus récemment entrée en vigueur. */
  const parNumero = new Map();
  for (const article of articles) {
    const connu = parNumero.get(article.num);
    if (!connu || (article.debut ?? '') > (connu.debut ?? '')) parNumero.set(article.num, article);
  }

  const retenus = [...parNumero.values()].sort((a, b) => {
    const parChemin = a.chemin.join(' > ').localeCompare(b.chemin.join(' > '), 'fr');
    return parChemin !== 0 ? parChemin : comparerNumeros(a.num, b.num);
  });

  return retenus.map((article) => ({
    num: article.num,
    chemin: article.chemin,
    texte: article.texte,
  }));
}

/* ================================================================== la course === */

/**
 * Fait correspondre chaque sélection à un identifiant de texte, par son nom.
 *
 * Renvoie aussi ce qui n'a pas été trouvé, au lieu de s'arrêter : l'appelant
 * décide alors s'il déplie les quotidiennes ou s'il abandonne. Un texte
 * introuvable est toujours une erreur de sélection ou un fonds incomplet,
 * jamais quelque chose qu'on contourne en devinant.
 */
function resoudre() {
  const dossiers = dossiersDeTexte();
  const titres = new Map();
  for (const [cid, dossier] of dossiers) titres.set(cid, titreDuTexte(dossier));

  const retenus = new Set();
  const manquants = [];

  for (const [domaineId, selections] of Object.entries(CHOIX)) {
    for (const selection of selections) {
      const trouves = [...titres.entries()].filter(([, titre]) => selection.texte.test(titre));
      if (trouves.length === 0) {
        manquants.push(`${domaineId} : ${selection.nom} (${selection.texte})`);
        continue;
      }
      /* Plusieurs versions d'un même texte peuvent coexister ; le titre le plus
         long est celui du texte consolidé courant, les autres sont des
         abrégés. */
      const [cid] = trouves.sort((a, b) => b[1].length - a[1].length)[0];
      retenus.add(cid);
      selection.cid = cid;
    }
  }

  return { titres, retenus, manquants };
}



async function principal() {
  const options = new Set(process.argv.slice(2));
  const aujourdhui = new Date().toISOString().slice(0, 10);

  if (options.has('--fonds')) {
    console.log('Fonds LEGI — téléchargement de ce qui manque');
    await completerLeFonds();
  }

  const { global, deltas } = fichiersLocaux();
  if (!global) {
    console.error('Aucune archive globale dans .legi/. Lancez : npm run corpus -- --fonds');
    process.exit(1);
  }

  mkdirSync(FONDS, { recursive: true });

  /* Premier passage : les fiches d'identité des textes. Elles sont minuscules
     et il en faut la totalité, puisqu'on cherche des textes par leur nom. */
  const indexPose = join(FONDS, '.index-pose');
  if (!existsSync(indexPose)) {
    console.log(`Index des textes (${global})…`);
    extraire(global, [`*/${EN_VIGUEUR}/*/texte/version/*.xml`]);
    writeFileSync(indexPose, aujourdhui);
  }

  /* On résout chaque sélection en identifiants avant de sortir le moindre
     article : une expression qui ne trouve rien doit se voir tout de suite, pas
     après vingt minutes d'extraction. */
  let voulus = resoudre();
  if (voulus.manquants.length > 0) {
    /* Un texte introuvable dans l'archive globale a pu naître depuis. On ne
       déplie l'index des quotidiennes QUE dans ce cas : quatre cent vingt
       archives coûtent vingt minutes, et les textes suivis ici existaient tous
       avant. */
    console.log(`${voulus.manquants.length} texte(s) absent(s) du global — index des quotidiennes…`);
    for (const delta of deltas) {
      const marque = join(FONDS, `.index-${delta}`);
      if (existsSync(marque)) continue;
      extraire(delta, [`*/${EN_VIGUEUR}/*/texte/version/*.xml`], { strip: 1 });
      writeFileSync(marque, aujourdhui);
    }
    voulus = resoudre();
  }

  if (voulus.manquants.length > 0) {
    console.error('\nTextes introuvables dans le fonds :');
    for (const ligne of voulus.manquants) console.error(`  — ${ligne}`);
    process.exit(1);
  }

  const { titres, retenus } = voulus;
  console.log(`  ${retenus.size} textes retenus`);

  /* Second passage : les articles, pour les seuls textes retenus. */
  const motifs = [...retenus].map((cid) => motifDuTexte(cid, 'article/*'));
  const articlesPoses = join(FONDS, '.articles-pose');
  if (!existsSync(articlesPoses)) {
    console.log(`Articles (${retenus.size} textes)…`);
    extraire(global, motifs);
    writeFileSync(articlesPoses, aujourdhui);
  }

  console.log(`Mises à jour quotidiennes (${deltas.length})…`);
  for (const delta of deltas) {
    const marque = join(FONDS, `.articles-${delta}`);
    if (existsSync(marque)) continue;
    extraire(delta, motifs, { strip: 1 });
    appliquerLesSuppressions(delta);
    writeFileSync(marque, aujourdhui);
  }

  /* Le fonds a bougé : les identifiants peuvent avoir changé de dossier. */
  const aJour = dossiersDeTexte();

  mkdirSync(SORTIE, { recursive: true });
  const resume = [];

  for (const [domaineId, selections] of Object.entries(CHOIX)) {
    const documents = [];
    for (const selection of selections) {
      const dossier = aJour.get(selection.cid);
      if (!dossier) throw new Error(`${selection.nom} : dossier disparu (${selection.cid})`);
      const articles = construireDocument(selection, dossier, aujourdhui);
      if (articles.length === 0) throw new Error(`${selection.nom} : aucun article retenu — la sélection des parties ne correspond à rien`);
      documents.push({ nom: selection.nom, titre: titres.get(selection.cid), cid: selection.cid, articles });
    }

    const taille = documents.reduce((total, doc) => total + doc.articles.reduce((n, a) => n + a.texte.length, 0), 0);
    if (taille > PLAFOND_CARACTERES) {
      throw new Error(
        `${domaineId} : ${taille} caractères, plafond ${PLAFOND_CARACTERES}. Resserrez les parties dans lib/corpus-choix.ts.`,
      );
    }

    writeFileSync(
      join(SORTIE, `${domaineId}.json`),
      `${JSON.stringify({ domaine: domaineId, arrete: aujourdhui, documents }, null, 1)}\n`,
    );
    const nombre = documents.reduce((n, doc) => n + doc.articles.length, 0);
    resume.push({ domaine: domaineId, articles: nombre, caracteres: taille });
    console.log(`  ${domaineId.padEnd(18)} ${String(nombre).padStart(5)} articles  ${String(taille).padStart(8)} car.`);
  }

  writeFileSync(
    join(SORTIE, 'index.json'),
    `${JSON.stringify({ arrete: aujourdhui, source: MIROIR, global, quotidiennes: deltas.length, domaines: resume }, null, 1)}\n`,
  );
  console.log(`\nCorpus arrêté au ${aujourdhui} — ${resume.reduce((n, d) => n + d.articles, 0)} articles.`);
}

/** Les dossiers que la DILA déclare supprimés ce jour-là. */
function appliquerLesSuppressions(delta) {
  const temporaire = join(CACHE, '.suppressions');
  rmSync(temporaire, { recursive: true, force: true });
  mkdirSync(temporaire, { recursive: true });
  try {
    execFileSync('tar', ['-xzf', join(CACHE, delta), '-C', temporaire, '--wildcards', '--strip-components=1', '*/liste_suppression_legi_dossier.dat'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch {
    return;
  }
  const liste = join(temporaire, 'liste_suppression_legi_dossier.dat');
  if (!existsSync(liste)) return;
  for (const ligne of readFileSync(liste, 'utf8').split('\n')) {
    const chemin = ligne.trim().replace(/\s+[A-Z]$/, '');
    if (!chemin.startsWith('legi/')) continue;
    rmSync(join(FONDS, chemin), { recursive: true, force: true });
  }
  rmSync(temporaire, { recursive: true, force: true });
}

principal().catch((erreur) => {
  console.error(erreur.message);
  process.exit(1);
});
