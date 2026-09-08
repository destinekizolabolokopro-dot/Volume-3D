/**
 * La page unique : `npm run page`.
 *
 * Un seul fichier HTML qui s'ouvre par double-clic, sans serveur, sans réseau,
 * sans installation. Le pendant de ce que le dépôt Volume3D fait pour ses
 * visites 3D.
 *
 * ── À quoi elle sert ────────────────────────────────────────────────────────
 * À montrer. Un site déployé demande une adresse, un hébergeur et une clé
 * d'API ; un fichier se met sur une clé USB, s'envoie par courriel, s'ouvre
 * dans un train sans réseau. C'est ce qu'on tend à un agent immobilier au
 * rendez-vous, ou ce qu'on joint à un dossier.
 *
 * ── Ce qu'elle contient, et d'où ça vient ───────────────────────────────────
 * Rien n'est réécrit pour l'occasion : les dix fiches viennent de
 * `lib/domaines.ts`, la copie de `lib/copie.ts`, les diagnostics de
 * `lib/diagnostics.ts`, les chiffres du corpus de `corpus/index.json`, et
 * l'échange donné en exemple cite des articles lus dans `corpus/*.json`. Si le
 * site change, cette page change avec lui — c'est tout l'intérêt de la
 * produire plutôt que de l'écrire.
 *
 * ── Ce qu'elle ne fait pas, et le dit ───────────────────────────────────────
 * Elle ne répond à aucune question : il n'y a pas de modèle derrière un
 * fichier. L'échange qu'elle montre est présenté comme enregistré, en toutes
 * lettres et à l'écran. Une démonstration qui laisse croire qu'elle répond en
 * direct est un mensonge qu'on découvre à la deuxième question, devant la
 * personne qu'on voulait convaincre.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DIAGNOSTICS } from '../lib/diagnostics.ts';
import { DOMAINES } from '../lib/domaines.ts';
import { ACCUEIL, LIMITES, MARQUE, ORIENTATION, SPECIALISTE } from '../lib/copie.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(RACINE, 'standalone', 'droit-immobilier.html');

const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');
const lireJson = (chemin) => JSON.parse(lire(chemin));

/** Le texte traverse le HTML comme du texte, jamais comme du balisage. */
function e(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const liste = (items, classe = '') =>
  `<ul${classe ? ` class="${classe}"` : ''}>${items.map((i) => `<li>${e(i)}</li>`).join('')}</ul>`;

/* ============================================================== l'exemple === */

/**
 * L'échange montré en exemple.
 *
 * La question et la réponse sont écrites ici — c'est une démonstration, elle
 * est assumée comme telle. Les ARTICLES, eux, sont lus dans le corpus : leur
 * numéro, leur place dans le plan et leur texte sortent du fonds LEGI, pas
 * d'ici. Montrer une citation inventée pour vanter un produit dont l'argument
 * est de ne pas en inventer serait difficile à défendre.
 */
const EXEMPLE = {
  domaine: 'bail-habitation',
  question:
    'Je veux vendre mon appartement, qui est loué vide depuis 2021. Le bail arrive à échéance en mars. Comment donner congé ?',
  reponse: [
    ['titre', 'Le délai'],
    ['texte',
      'Six mois avant l’échéance, pour un logement vide. Si le bail se termine en mars, le congé doit être reçu par le locataire au plus tard fin septembre. Un jour de retard et il ne vaut rien : le bail se reconduit pour trois ans.'],
    ['titre', 'Ce que dit la règle'],
    ['texte',
      'Le congé pour vendre doit indiquer le motif, le prix et les conditions de la vente. Il vaut offre de vente au profit du locataire, qui dispose de deux mois pour l’accepter. Ce n’est pas une formalité : un congé qui omet le prix est nul, et la nullité se soulève des années plus tard.'],
    ['titre', 'Ce que vous pouvez faire'],
    ['liste', [
      'compter six mois pleins depuis la date d’échéance portée au contrat, pas depuis la signature ;',
      'faire délivrer le congé par commissaire de justice — la preuve de réception est ce qui se conteste le plus ;',
      'y porter le prix et les conditions, faute de quoi il est nul.',
    ]],
    ['titre', 'Quand il faut un professionnel'],
    ['texte',
      'Si le locataire a plus de soixante-cinq ans et des ressources modestes, la protection légale peut vous interdire le congé sauf à lui proposer un relogement. C’est le cas où une erreur coûte trois ans : faites vérifier la situation avant d’envoyer quoi que ce soit.'],
  ],
  /** Les articles à citer, par numéro. Leur texte est lu dans le corpus. */
  citations: [
    { texte: 'loi du 6 juillet 1989', num: '15' },
    { texte: 'code civil', num: '1743' },
  ],
};

function citationsReelles() {
  const corpus = lireJson(`corpus/${EXEMPLE.domaine}.json`);
  return EXEMPLE.citations.map(({ texte, num }) => {
    const document = corpus.documents.find((d) => d.nom === texte);
    if (!document) throw new Error(`corpus : texte « ${texte} » introuvable`);
    const article = document.articles.find((a) => a.num === num);
    if (!article) throw new Error(`corpus : ${texte} n’a pas d’article ${num}`);
    /* Le premier alinéa suffit : une citation qui dépasse quelques lignes
       cesse d'être une preuve et redevient un paragraphe. */
    const extrait = article.texte.split('\n')[0].slice(0, 340);
    return {
      source: document.nom,
      article: /^(article|annexe)/i.test(article.num) ? article.num : `Article ${article.num}`,
      chemin: article.chemin.join(' › '),
      extrait: extrait.length < article.texte.length ? `${extrait.trimEnd()}…` : extrait,
    };
  });
}

/* ================================================================== le rendu === */

function fiche(domaine) {
  const renvois = domaine.renvois.map(
    (r) => `${r.quand} → « ${DOMAINES.find((d) => d.id === r.vers)?.label ?? r.vers} »`,
  );
  return `
<article class="fiche" id="fiche-${e(domaine.id)}" hidden>
  <button class="retour" data-retour>← Toutes les spécialités</button>
  <h2 class="jur-h1 jur-h1-moyen">${e(domaine.label)}</h2>
  <p class="jur-lede">${e(domaine.resume)}</p>

  <section class="jur-bloc jur-delais">
    <h3>Délais à ne pas manquer</h3>
    ${liste(domaine.delais)}
    <p class="hint">${e(SPECIALISTE.delaisNote)}</p>
  </section>

  <section class="jur-bloc">
    <h3>À réunir avant d’agir</h3>
    ${liste(domaine.verifications)}
  </section>

  <div class="deux">
    <section class="jur-bloc">
      <h3>Ce qu’il traite</h3>
      ${liste(domaine.matieres)}
    </section>
    <section class="jur-bloc">
      <h3>Ce qu’il ne traite pas</h3>
      ${liste(renvois)}
    </section>
  </div>

  <section class="jur-bloc">
    <h3>Textes de référence</h3>
    ${liste(domaine.sources)}
  </section>

  ${domaine.exemples?.length ? `<section class="jur-bloc">
    <h3>Des questions qu’on lui pose</h3>
    ${liste(domaine.exemples)}
  </section>` : ''}
</article>`;
}

function construire() {
  const index = lireJson('corpus/index.json');
  const totalArticles = index.domaines.reduce((n, d) => n + d.articles, 0);
  const parDomaine = Object.fromEntries(index.domaines.map((d) => [d.domaine, d.articles]));
  const citations = citationsReelles();

  const police = readFileSync(join(RACINE, 'public/fonts/inter-400-latin.woff2')).toString('base64');
  const socle = lire('app/socle.css');
  const feuille = lire('app/assistant.css');

  const cartes = DOMAINES.map((d) => `
    <button class="carte" data-ouvre="${e(d.id)}">
      <span class="carte-titre">${e(d.label)}</span>
      <span class="carte-resume">${e(d.resume)}</span>
      <span class="carte-chiffre">${parDomaine[d.id] ?? 0} articles joints</span>
    </button>`).join('');

  const reponse = EXEMPLE.reponse.map(([type, valeur]) =>
    type === 'titre' ? `<p class="jur-intertitre">${e(valeur)}</p>`
    : type === 'liste' ? liste(valeur, 'jur-liste')
    : `<p>${e(valeur)}</p>`).join('');

  const sources = citations.map((c) => `
    <li>
      <p class="jur-source-titre">${e(c.article)}<span class="jur-source-texte"> — ${e(c.source)}</span></p>
      <p class="jur-source-chemin">${e(c.chemin)}</p>
      <blockquote>${e(c.extrait)}</blockquote>
    </li>`).join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(MARQUE.nom)} — dix spécialités du droit immobilier</title>
<meta name="description" content="${e(ACCUEIL.lede.slice(0, 155))}">
<style>
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(data:font/woff2;base64,${police}) format('woff2');
}
${socle}
${feuille}

/* ---- propre à la page unique : elle n'a ni serveur ni navigation ---- */
.page-unique { max-width: 960px; margin: 0 auto; padding: 0 calc(var(--pas) * 3) calc(var(--pas) * 10); }
.grille { display: grid; gap: calc(var(--pas) * 2); grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.carte { text-align: left; display: flex; flex-direction: column; gap: calc(var(--pas) * 0.75);
  background: #fff; border: 1px solid var(--line); border-radius: var(--radius);
  padding: calc(var(--pas) * 2.5); cursor: pointer; font: inherit;
  transition: border-color .15s ease, box-shadow .15s ease; }
.carte:hover { border-color: var(--accent); box-shadow: var(--pose); }
.carte-titre { font-size: 16px; font-weight: 600; color: var(--ink-strong); }
.carte-resume { font-size: 13.5px; line-height: 1.5; color: var(--ink-soft); }
.carte-chiffre { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-faint); margin-top: auto; }
.retour { background: none; border: 0; font: inherit; color: var(--accent); cursor: pointer;
  padding: 0; margin-bottom: calc(var(--pas) * 2); }
.deux { display: grid; gap: calc(var(--pas) * 2); }
@media (min-width: 760px) { .deux { grid-template-columns: 1fr 1fr; } }
.enregistre { display: inline-block; font-size: 12px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--ink-on-dark-soft); background: var(--dark); border-radius: 999px;
  padding: calc(var(--pas) * .5) calc(var(--pas) * 1.5); margin-bottom: calc(var(--pas) * 2); }
.chiffres { display: flex; flex-wrap: wrap; gap: calc(var(--pas) * 4); margin: calc(var(--pas) * 3) 0 0; }
.chiffre strong { display: block; font-size: 30px; letter-spacing: -.02em; color: var(--ink-strong); }
.chiffre span { font-size: 13px; color: var(--ink-soft); }
</style>
</head>
<body>
<div class="jur">

<header class="jur-bar">
  <span class="jur-bar-brand">${e(MARQUE.nom)}<small>${e(MARQUE.accroche)}</small></span>
</header>

<div class="page-unique">

<main id="accueil">
  <section class="jur-page">
    <p class="jur-oeil">${e(ACCUEIL.oeil)}</p>
    <h1 class="jur-h1">${ACCUEIL.titreLignes.map(e).join('<br>')}</h1>
    <p class="jur-lede">${e(ACCUEIL.lede)}</p>

    <div class="chiffres">
      <div class="chiffre"><strong>${DOMAINES.length}</strong><span>spécialités</span></div>
      <div class="chiffre"><strong>${totalArticles.toLocaleString('fr-FR')}</strong><span>articles en vigueur joints aux réponses</span></div>
      <div class="chiffre"><strong>${index.quotidiennes}</strong><span>mises à jour du fonds appliquées</span></div>
      <div class="chiffre"><strong>${DIAGNOSTICS.length}</strong><span>diagnostics et leurs durées</span></div>
    </div>
  </section>

  <section class="jur-page">
    <span class="enregistre">Échange enregistré · cette page ne répond pas</span>
    <div class="jur-fil">
      <div class="jur-tour jur-de-vous"><p>${e(EXEMPLE.question)}</p></div>
      <div class="jur-tour jur-de-lui">
        ${reponse}
        <details class="jur-sources" open>
          <summary>Les ${citations.length} textes cités</summary>
          <ul>${sources}</ul>
        </details>
      </div>
    </div>
    <p class="hint">${e(SPECIALISTE.avertissement)}</p>
  </section>

  <section class="jur-page">
    <h2 class="jur-h2">${e(ACCUEIL.grilleTitre)}</h2>
    <p class="jur-lede">${e(ACCUEIL.grilleSous)}</p>
    <div class="grille">${cartes}</div>
  </section>

  <section class="jur-page">
    <h2 class="jur-h2">${e(ACCUEIL.limitesTitre)}</h2>
    <p class="jur-lede">${e(ACCUEIL.limitesSous)}</p>
    ${LIMITES.map((l) => `<p><strong>${e(l.amorce)}</strong> ${e(l.suite)}</p>`).join('')}
  </section>
</main>

<div id="fiches">${DOMAINES.map(fiche).join('')}</div>

<footer class="jur-pied">
  <div class="jur-pied-corps"><p>${e(ACCUEIL.piedMention)}</p></div>
</footer>

</div>
</div>

<script>
/* Toute la navigation de ce fichier : montrer une fiche, revenir. Il n'y a
   rien d'autre à faire ici — pas de réseau, pas de compte, pas de modèle. */
(function () {
  var accueil = document.getElementById('accueil');
  var fiches = document.getElementById('fiches');

  function montrer(id) {
    accueil.hidden = Boolean(id);
    Array.prototype.forEach.call(fiches.children, function (f) {
      f.hidden = f.id !== 'fiche-' + id;
    });
    window.scrollTo(0, 0);
    location.hash = id ? id : '';
  }

  document.addEventListener('click', function (ev) {
    var ouvre = ev.target.closest('[data-ouvre]');
    if (ouvre) return montrer(ouvre.getAttribute('data-ouvre'));
    if (ev.target.closest('[data-retour]')) return montrer('');
  });

  if (location.hash) montrer(location.hash.slice(1));
})();
</script>
</body>
</html>
`;
}

mkdirSync(join(RACINE, 'standalone'), { recursive: true });
const html = construire();
writeFileSync(DEST, html);
console.log(`${DEST} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko`);
