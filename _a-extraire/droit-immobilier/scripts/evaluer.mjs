/**
 * Les évaluations : jouer de vraies questions contre le vrai site, et dire ce
 * qui cloche.
 *
 * POURQUOI CONTRE LE SITE ET NON CONTRE UNE FONCTION. Parce que ce qu'on veut
 * mesurer n'est pas la consigne seule : c'est l'aiguillage, plus le corpus
 * chargé, plus la consigne, plus la veille, plus la mise en forme — la chaîne
 * entière, dans l'ordre où elle produit ce qu'une personne lit. Une évaluation
 * qui appellerait `repondre()` directement passerait à côté de la moitié des
 * régressions possibles, à commencer par un aiguillage qui se met à envoyer
 * les questions de copropriété au spécialiste du bail.
 *
 * CE QUE ÇA COÛTE. Chaque cas est une vraie question : jetons d'entrée
 * (corpus compris, mis en cache une heure), réflexion à effort haut, et
 * jusqu'à cinq recherches en ligne. Douze cas coûtent donc une somme réelle,
 * et le script le dit avant de partir.
 *
 * CE QUE ÇA NE MESURE PAS. La justesse juridique. Aucun programme ne sait
 * dire si « six mois » est le bon préavis — c'est pour cela que les cas
 * portent les réponses attendues, écrites à la main par quelqu'un qui a
 * vérifié. Le barème (lib/bareme.ts) mesure la forme, les articles, les
 * délais et les mots attendus ; le reste se relit.
 *
 *   npm run evaluer                 — tous les cas, contre http://localhost:3000
 *   npm run evaluer -- conge-vente  — un seul, par son identifiant
 *   SITE=https://… npm run evaluer  — contre un site déployé
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { juger, jugerLesMots } from '../lib/bareme.ts';

const RACINE = process.cwd();
const SITE = (process.env.SITE ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const CHOISIS = process.argv.slice(2).filter((a) => !a.startsWith('-'));

/* Chaque cas part avec une adresse différente : sans cela le frein de cadence
   — huit questions par minute, une par jour sans compte — arrêterait
   l'évaluation au deuxième cas. C'est le frein qu'on contourne, pas le quota
   d'un client.

   ET CHAQUE PASSAGE AVEC UNE PLAGE DIFFÉRENTE. Sans cela, relancer
   l'évaluation dans la même journée refait tomber les mêmes adresses sur le
   compteur journalier, et le premier cas revient en 402 — une panne du
   lanceur, présentée comme un échec du produit. C'est arrivé au premier essai.

   La plage 198.18.0.0/15 est celle que la RFC 2544 réserve aux bancs
   d'essai : elle ne désigne personne, et ne peut donc pas entrer en conflit
   avec une adresse réelle. */
const PLAGE = Math.floor(Math.random() * 256);
const origine = (rang) => `198.18.${PLAGE}.${(rang % 254) + 1}`;

async function corpusDu(domaine) {
  if (!domaine) return [];
  try {
    const brut = await readFile(path.join(RACINE, 'corpus', `${domaine}.json`), 'utf8');
    const corpus = JSON.parse(brut);
    return corpus.documents.flatMap((d) => d.articles.map((a) => a.num));
  } catch {
    return [];
  }
}

/**
 * Pose une question et lit le flux jusqu'au bout.
 *
 * Le texte retenu est celui de l'événement « fin », pas celui qu'on a
 * accumulé : c'est ce que le site affiche réellement, coupures et refus
 * compris. Voir lib/flux.ts.
 */
async function poser(cas, rang) {
  const debut = Date.now();
  const reponse = await fetch(`${SITE}/api/consultation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': origine(rang) },
    body: JSON.stringify({ domaine: cas.domaine ?? '', question: cas.question, historique: [] }),
  });

  if (!reponse.ok) {
    const corps = await reponse.text();
    throw new Error(`${reponse.status} — ${corps.slice(0, 200)}`);
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let reste = '';
  let fin = null;
  let cap = null;
  const recherches = [];

  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    const lignes = (reste + decodeur.decode(value, { stream: true })).split('\n');
    reste = lignes.pop();
    for (const ligne of lignes) {
      if (!ligne.trim()) continue;
      let ev;
      try {
        ev = JSON.parse(ligne);
      } catch {
        continue;
      }
      if (ev.t === 'cap') cap = ev;
      if (ev.t === 'etape' && ev.quoi === 'recherche') recherches.push(ev.detail);
      if (ev.t === 'fin') fin = ev;
      if (ev.t === 'erreur') throw new Error(ev.message);
    }
  }

  if (!fin) throw new Error('Le flux s’est fermé sans conclure.');

  return {
    texte: fin.reponse,
    refus: fin.refus,
    precision: fin.precision,
    domaine: fin.domaine || cap?.domaine || '',
    references: fin.references ?? [],
    veille: fin.veille ?? [],
    recherches,
    secondes: Math.round((Date.now() - debut) / 100) / 10,
  };
}

/**
 * Les manquements d'un cas.
 *
 * Trois régimes, parce que trois choses différentes peuvent revenir, et
 * qu'appliquer à chacune le barème d'une réponse de spécialiste produirait
 * des échecs qui n'en sont pas.
 */
function evaluer(cas, resultat, articlesDuCorpus) {
  const manques = [];

  /* 1. UNE QUESTION EN RETOUR n'est pas une réponse. Le spécialiste réclame
        un fait avant de répondre, et il a souvent raison de le faire — le cas
        « manque-un-fait » attend précisément cela. Juger la forme d'un texte
        qui n'est pas encore une réponse n'aurait aucun sens. */
  if (resultat.precision) {
    if (cas.attente.refus) {
      manques.push({ regle: 'refus', detail: 'une question a été posée au lieu d’un refus' });
    }
    if (cas.domaine && resultat.domaine && resultat.domaine !== cas.domaine) {
      manques.push({
        regle: 'aiguillage',
        detail: `attendu « ${cas.domaine} », obtenu « ${resultat.domaine} »`,
      });
    }
    return manques;
  }

  /* 2. AUCUNE SPÉCIALITÉ RECONNUE : la réponse est celle que le site écrit
        lui-même, sans modèle, pour dire qu'il n'a pas reconnu de spécialité.
        Elle n'a ni intertitres ni articles, et c'est voulu — lui réclamer un
        « détail juridique » serait exiger la forme d'une consultation d'un
        texte qui explique justement qu'il n'y en aura pas.

        On juge alors les mots, et rien d'autre : le cas « hors-perimetre »
        veut voir « droit immobilier » et ne pas voir un conseil de
        prud'hommes. */
  if (!resultat.domaine) {
    if (cas.domaine) {
      manques.push({
        regle: 'aiguillage',
        detail: `attendu « ${cas.domaine} », aucune spécialité reconnue`,
      });
    }
    return [...manques, ...jugerLesMots(resultat.texte, cas.attente)];
  }

  /* 3. UNE RÉPONSE DE SPÉCIALISTE : le barème entier s'applique. */
  if (cas.domaine && resultat.domaine !== cas.domaine) {
    manques.push({
      regle: 'aiguillage',
      detail: `attendu « ${cas.domaine} », obtenu « ${resultat.domaine} »`,
    });
  }

  return [...manques, ...juger(resultat.texte, cas.attente, articlesDuCorpus)];
}


/* ================================================================= le tour === */

const brut = await readFile(path.join(RACINE, 'evaluations', 'cas.json'), 'utf8');
const tous = JSON.parse(brut).cas;
const cas = CHOISIS.length > 0 ? tous.filter((c) => CHOISIS.includes(c.id)) : tous;

if (cas.length === 0) {
  console.error(`Aucun cas ne porte ${CHOISIS.join(', ')}. Ils sont dans evaluations/cas.json.`);
  process.exit(2);
}

console.log(`\nÉvaluation — ${cas.length} cas contre ${SITE}\n`);
console.log('Chaque cas est une vraie question, facturée : corpus, réflexion à');
console.log('effort haut, et jusqu’à cinq recherches en ligne.\n');

const rapport = [];
let enDefaut = 0;

for (const [rang, unCas] of cas.entries()) {
  process.stdout.write(`  ${unCas.id.padEnd(24)} `);
  let ligne;
  try {
    const resultat = await poser(unCas, rang);
    const manques = evaluer(unCas, resultat, await corpusDu(resultat.domaine || unCas.domaine));
    ligne = { id: unCas.id, ...resultat, manques };
    if (manques.length > 0) enDefaut += 1;
    console.log(
      `${manques.length === 0 ? '·' : '✗'}  ${String(resultat.secondes).padStart(5)} s  ` +
        `${String(resultat.texte.length).padStart(5)} signes  ` +
        `${resultat.references.length} art.  ${resultat.veille.length} pages  ` +
        (manques.length === 0 ? '' : `${manques.length} manquement(s)`),
    );
    for (const manque of manques) console.log(`      ${manque.regle} : ${manque.detail}`);
  } catch (cause) {
    enDefaut += 1;
    ligne = { id: unCas.id, erreur: String(cause.message ?? cause), manques: [] };
    console.log(`✗  ${ligne.erreur}`);
  }
  rapport.push(ligne);
}

await mkdir(path.join(RACINE, 'evaluations'), { recursive: true });
const fichier = path.join(RACINE, 'evaluations', 'dernier-rapport.json');
await writeFile(fichier, JSON.stringify({ date: new Date().toISOString(), site: SITE, rapport }, null, 2));

console.log(`\n${cas.length - enDefaut} / ${cas.length} sans manquement.`);
console.log(`Le détail, réponses entières comprises : ${path.relative(RACINE, fichier)}\n`);

/* Sortie non nulle quand un cas cloche : de quoi brancher l'évaluation sur ce
   qui refuse de livrer. */
process.exit(enDefaut > 0 ? 1 : 0);
